import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  PaymentEnvironments,
  PaymentProviders,
  type PaymentEnvironment,
  type PaymentGatewayAdminView,
  type PaymentProviderInfo,
  type PaymentProviderName,
} from '@pe/shared';
import { NotFoundAppException, UnprocessableAppException } from '../common/errors/app.exception.js';
import { AppConfigService } from '../config/app-config.service.js';
import type { PaymentProviderConfig, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CredentialsCryptoService, maskSecret } from './credentials-crypto.service.js';
import type { ProviderContext, ProviderDefinition } from './payment-provider.types.js';
import { PaymentErrorCodes, PaymentProviderError } from './payment.errors.js';
import { envKeyFor, PROVIDER_DEFINITIONS, PROVIDER_ENV_PREFIXES } from './provider-definitions.js';
import { CONTRACT_DOCS_CONFIRMED_KEY } from './providers/oauth-bearer.support.js';

export interface UpdateGatewayInput {
  enabled?: boolean;
  isDefault?: boolean;
  environment?: PaymentEnvironment;
  /** Only keys present are changed; masked/empty secret values keep the stored value. */
  credentials?: Record<string, string>;
  settings?: Record<string, string>;
  confirmProduction?: boolean;
}

export interface GatewayChange {
  field: string;
  from: unknown;
  to: unknown;
}

const MASK_SENTINEL_PATTERN = /^•+/;

/**
 * Database-backed provider registry. Rows are created for every known
 * provider on boot; environment variables seed a row the first time it is
 * created (bootstrap only, never overriding admin edits).
 */
@Injectable()
export class ProviderRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ProviderRegistryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialsCryptoService,
    private readonly config: AppConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.bootstrap(process.env);
  }

  definition(provider: PaymentProviderName): ProviderDefinition {
    return PROVIDER_DEFINITIONS[provider];
  }

  /** Creates missing rows, seeding from environment variables when present. */
  async bootstrap(env: NodeJS.ProcessEnv): Promise<void> {
    for (const provider of PaymentProviders) {
      const existing = await this.prisma.paymentProviderConfig.findUnique({ where: { provider } });
      if (existing) continue;
      const definition = PROVIDER_DEFINITIONS[provider];
      const prefix = PROVIDER_ENV_PREFIXES[provider];
      const credentials: Record<string, string> = {};
      for (const field of definition.credentialFields) {
        const value = env[envKeyFor(provider, field.key)];
        if (value) credentials[field.key] = value;
      }
      const settings: Record<string, string> = {};
      for (const field of definition.settingFields) {
        const value = env[envKeyFor(provider, field.key)];
        if (value) settings[field.key] = value;
      }
      const environment = parseEnvironment(env[`${prefix}_ENVIRONMENT`]);
      const enabled = env[`${prefix}_ENABLED`] === 'true';
      const isDefault = env[`${prefix}_DEFAULT`] === 'true';
      const missing = definition.credentialFields.filter((f) => f.required && !credentials[f.key]);
      const canEnable = enabled && missing.length === 0;
      if (enabled && !canEnable) {
        this.logger.warn(
          `${provider}: ${prefix}_ENABLED=true ignored, missing ${missing.map((f) => f.key).join(', ')}`,
        );
      }
      await this.prisma.paymentProviderConfig.create({
        data: {
          provider,
          displayName: definition.displayName,
          enabled: canEnable,
          isDefault: canEnable && isDefault,
          environment,
          credentialsEncrypted:
            Object.keys(credentials).length > 0 ? this.crypto.encryptJson(credentials) : null,
          configuration: settings,
        },
      });
      this.logger.log(`registered payment provider ${provider} (enabled=${canEnable})`);
    }
    await this.ensureSingleDefault();
  }

  private async ensureSingleDefault(): Promise<void> {
    const defaults = await this.prisma.paymentProviderConfig.findMany({
      where: { isDefault: true },
      orderBy: { updatedAt: 'asc' },
    });
    if (defaults.length > 1) {
      await this.prisma.paymentProviderConfig.updateMany({
        where: { id: { in: defaults.slice(1).map((d) => d.id) } },
        data: { isDefault: false },
      });
    }
  }

  // --- runtime ---------------------------------------------------------------

  /**
   * True when the runtime allows this provider at all: the mock is dev/test
   * only, and adapters built on unverified documentation stay unavailable
   * until an operator confirms the contract documentation.
   */
  isRuntimeAvailable(
    provider: PaymentProviderName,
    settings: Record<string, string>,
  ): { ok: boolean; reason: string | null } {
    if (provider === 'MOCK' && !this.config.payments.mockEnabled) {
      return { ok: false, reason: 'درگاه آزمایشی فقط در محیط توسعه/آزمون فعال می‌شود' };
    }
    const definition = PROVIDER_DEFINITIONS[provider];
    if (!definition.capabilities.includes('create')) {
      return {
        ok: false,
        reason: 'این درگاه هنوز مستندات رسمی تأییدشده ندارد و قابل استفاده نیست',
      };
    }
    const gate = definition.settingFields.find((f) => f.key === CONTRACT_DOCS_CONFIRMED_KEY);
    if (gate && (settings[CONTRACT_DOCS_CONFIRMED_KEY] ?? gate.defaultValue) !== 'yes') {
      return {
        ok: false,
        reason:
          'مستندات فنی این درگاه به‌صورت عمومی منتشر نشده است؛ پس از تطبیق تنظیمات با مستندات قرارداد، گزینهٔ «تأیید مستندات قرارداد» را فعال کنید',
      };
    }
    return { ok: true, reason: null };
  }

  /** Providers a customer may pick at checkout, default first. */
  async availableForCheckout(): Promise<PaymentProviderInfo[]> {
    const rows = await this.prisma.paymentProviderConfig.findMany({
      where: { enabled: true },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'asc' }],
    });
    return rows
      .filter((row) => this.isRuntimeAvailable(row.provider, readSettings(row.configuration)).ok)
      .map((row) => ({
        provider: row.provider,
        displayName: row.displayName,
        description: PROVIDER_DEFINITIONS[row.provider].description,
        environment: row.environment,
        isDefault: row.isDefault,
      }));
  }

  /**
   * Resolves the provider to use for a new payment. No silent fallback: a
   * disabled default yields a clear error unless the caller picked another
   * enabled provider explicitly.
   */
  async resolveForCheckout(requested: PaymentProviderName | undefined): Promise<ProviderContext> {
    const available = await this.availableForCheckout();
    if (available.length === 0) {
      throw new UnprocessableAppException(
        'PAYMENT_PROVIDER_UNAVAILABLE',
        'در حال حاضر هیچ درگاه پرداختی فعال نیست',
      );
    }
    const chosen = requested
      ? available.find((p) => p.provider === requested)
      : (available.find((p) => p.isDefault) ?? null);
    if (!chosen) {
      throw new UnprocessableAppException(
        'PAYMENT_PROVIDER_UNAVAILABLE',
        requested ? 'درگاه انتخاب‌شده فعال نیست' : 'درگاه پیش‌فرض تنظیم نشده است',
        { available: available.map((p) => p.provider) },
      );
    }
    return this.contextFor(chosen.provider);
  }

  /** Decrypted context for adapters; the only place credentials are read. */
  async contextFor(provider: PaymentProviderName): Promise<ProviderContext> {
    const row = await this.requireRow(provider);
    const availability = this.isRuntimeAvailable(provider, readSettings(row.configuration));
    if (!availability.ok) {
      throw new PaymentProviderError(
        PaymentErrorCodes.ProviderUnavailable,
        availability.reason ?? 'درگاه در دسترس نیست',
      );
    }
    return this.buildContext(row);
  }

  /** Context for admin operations (test connection) even when disabled. */
  async contextForAdmin(provider: PaymentProviderName): Promise<ProviderContext> {
    return this.buildContext(await this.requireRow(provider));
  }

  private buildContext(row: PaymentProviderConfig): ProviderContext {
    const definition = PROVIDER_DEFINITIONS[row.provider];
    const settings = { ...defaultSettings(definition), ...readSettings(row.configuration) };
    return {
      provider: row.provider,
      environment: row.environment,
      credentials: this.crypto.decryptJson(row.credentialsEncrypted),
      settings,
      callbackUrl: this.callbackUrlFor(row.provider),
    };
  }

  callbackUrlFor(provider: PaymentProviderName): string {
    const slug = provider.toLowerCase().replace('_', '-');
    return `${this.config.payments.publicApiUrl}/payments/${slug}/callback`;
  }

  // --- administration ----------------------------------------------------------

  async listAdmin(): Promise<PaymentGatewayAdminView[]> {
    const rows = await this.prisma.paymentProviderConfig.findMany();
    const byProvider = new Map(rows.map((r) => [r.provider, r] as const));
    return PaymentProviders.filter((p) => byProvider.has(p)).map((p) =>
      this.toAdminView(byProvider.get(p)!),
    );
  }

  async getAdmin(provider: PaymentProviderName): Promise<PaymentGatewayAdminView> {
    return this.toAdminView(await this.requireRow(provider));
  }

  /** Applies an admin update; returns the view and a redacted change list for auditing. */
  async update(
    provider: PaymentProviderName,
    input: UpdateGatewayInput,
  ): Promise<{ view: PaymentGatewayAdminView; changes: GatewayChange[] }> {
    const row = await this.requireRow(provider);
    const definition = PROVIDER_DEFINITIONS[provider];
    const changes: GatewayChange[] = [];

    const stored = this.crypto.decryptJson(row.credentialsEncrypted);
    const credentials = { ...stored };
    for (const field of definition.credentialFields) {
      if (!input.credentials || !(field.key in input.credentials)) continue;
      const incoming = input.credentials[field.key]?.trim() ?? '';
      if (incoming === '' || MASK_SENTINEL_PATTERN.test(incoming)) continue; // keep stored value
      if (field.pattern && !field.pattern.test(incoming)) {
        throw new UnprocessableAppException(
          'PAYMENT_GATEWAY_INVALID_CREDENTIAL',
          `مقدار «${field.label}» معتبر نیست`,
          { field: field.key },
        );
      }
      if (credentials[field.key] !== incoming) {
        credentials[field.key] = incoming;
        changes.push({ field: `credentials.${field.key}`, from: '[redacted]', to: '[redacted]' });
      }
    }
    if (input.credentials) {
      for (const key of Object.keys(input.credentials)) {
        if (!definition.credentialFields.some((f) => f.key === key)) {
          throw new UnprocessableAppException(
            'PAYMENT_GATEWAY_UNKNOWN_FIELD',
            `فیلد «${key}» برای این درگاه تعریف نشده است`,
          );
        }
      }
    }

    const settings = { ...readSettings(row.configuration) };
    if (input.settings) {
      for (const [key, value] of Object.entries(input.settings)) {
        const field = definition.settingFields.find((f) => f.key === key);
        if (!field) {
          throw new UnprocessableAppException(
            'PAYMENT_GATEWAY_UNKNOWN_FIELD',
            `تنظیم «${key}» برای این درگاه تعریف نشده است`,
          );
        }
        const trimmed = value.trim();
        if (
          field.type === 'select' &&
          trimmed &&
          !field.options?.some((o) => o.value === trimmed)
        ) {
          throw new UnprocessableAppException(
            'PAYMENT_GATEWAY_INVALID_SETTING',
            `مقدار «${field.label}» معتبر نیست`,
          );
        }
        if (field.type === 'url' && trimmed && !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmed)) {
          throw new UnprocessableAppException(
            'PAYMENT_GATEWAY_INVALID_SETTING',
            `«${field.label}» باید یک آدرس معتبر باشد`,
          );
        }
        if (field.type === 'number' && trimmed && !/^\d+$/.test(trimmed)) {
          throw new UnprocessableAppException(
            'PAYMENT_GATEWAY_INVALID_SETTING',
            `«${field.label}» باید عدد باشد`,
          );
        }
        if ((settings[key] ?? '') !== trimmed) {
          changes.push({ field: `settings.${key}`, from: settings[key] ?? null, to: trimmed });
          if (trimmed) settings[key] = trimmed;
          else delete settings[key];
        }
      }
    }

    const environment = input.environment ?? row.environment;
    if (environment !== row.environment) {
      if (environment === 'SANDBOX' && !definition.supportsSandbox) {
        throw new UnprocessableAppException(
          'PAYMENT_GATEWAY_NO_SANDBOX',
          'این درگاه محیط آزمایشی ندارد',
        );
      }
      changes.push({ field: 'environment', from: row.environment, to: environment });
    }

    const enabled = input.enabled ?? row.enabled;
    if (enabled) {
      const availability = this.isRuntimeAvailable(provider, settings);
      if (!availability.ok) {
        throw new UnprocessableAppException(
          'PAYMENT_GATEWAY_UNAVAILABLE',
          availability.reason ?? 'درگاه قابل فعال‌سازی نیست',
        );
      }
      const missing = definition.credentialFields.filter((f) => f.required && !credentials[f.key]);
      if (missing.length > 0) {
        throw new UnprocessableAppException(
          'PAYMENT_GATEWAY_INCOMPLETE',
          `برای فعال‌سازی، ${missing.map((f) => f.label).join('، ')} لازم است`,
          { missing: missing.map((f) => f.key) },
        );
      }
    }
    if (enabled !== row.enabled) changes.push({ field: 'enabled', from: row.enabled, to: enabled });

    const goingLive =
      environment === 'PRODUCTION' &&
      enabled &&
      (row.environment !== 'PRODUCTION' ||
        !row.enabled ||
        changes.some((c) => c.field.startsWith('credentials.')));
    if (goingLive && !input.confirmProduction) {
      throw new UnprocessableAppException(
        'PAYMENT_GATEWAY_CONFIRM_PRODUCTION',
        'فعال‌سازی در محیط عملیاتی نیاز به تأیید صریح دارد',
        { confirmProduction: true },
      );
    }

    const isDefault = input.isDefault ?? row.isDefault;
    if (isDefault && !enabled) {
      throw new UnprocessableAppException(
        'PAYMENT_GATEWAY_DEFAULT_DISABLED',
        'درگاه پیش‌فرض باید فعال باشد',
      );
    }
    if (isDefault !== row.isDefault)
      changes.push({ field: 'isDefault', from: row.isDefault, to: isDefault });

    const updated = await this.prisma.$transaction(async (tx) => {
      if (isDefault && !row.isDefault) {
        await tx.paymentProviderConfig.updateMany({
          where: { isDefault: true, NOT: { provider } },
          data: { isDefault: false },
        });
      }
      return tx.paymentProviderConfig.update({
        where: { provider },
        data: {
          enabled,
          isDefault,
          environment,
          credentialsEncrypted:
            Object.keys(credentials).length > 0 ? this.crypto.encryptJson(credentials) : null,
          configuration: settings,
          // Credentials or environment changes invalidate the last test result.
          ...(changes.some((c) => c.field.startsWith('credentials.') || c.field === 'environment')
            ? { lastTestedAt: null, lastTestSucceeded: null, lastTestMessage: null }
            : {}),
        },
      });
    });
    return { view: this.toAdminView(updated), changes };
  }

  async recordTest(
    provider: PaymentProviderName,
    result: { ok: boolean; message: string },
  ): Promise<PaymentGatewayAdminView> {
    const row = await this.prisma.paymentProviderConfig.update({
      where: { provider },
      data: {
        lastTestedAt: new Date(),
        lastTestSucceeded: result.ok,
        lastTestMessage: result.message.slice(0, 500),
      },
    });
    return this.toAdminView(row);
  }

  private async requireRow(provider: PaymentProviderName): Promise<PaymentProviderConfig> {
    const row = await this.prisma.paymentProviderConfig.findUnique({ where: { provider } });
    if (!row) throw new NotFoundAppException('PAYMENT_GATEWAY_NOT_FOUND', 'درگاه پیدا نشد');
    return row;
  }

  private toAdminView(row: PaymentProviderConfig): PaymentGatewayAdminView {
    const definition = PROVIDER_DEFINITIONS[row.provider];
    const credentials = this.crypto.decryptJson(row.credentialsEncrypted);
    const settings = readSettings(row.configuration);
    const availability = this.isRuntimeAvailable(row.provider, settings);
    return {
      provider: row.provider,
      displayName: row.displayName,
      description: definition.description,
      enabled: row.enabled,
      isDefault: row.isDefault,
      environment: row.environment,
      supportsSandbox: definition.supportsSandbox,
      capabilities: definition.capabilities,
      docsStatus: definition.docsStatus,
      available: availability.ok,
      unavailableReason: availability.reason,
      credentialFields: definition.credentialFields.map((field) => {
        const value = credentials[field.key];
        return {
          key: field.key,
          label: field.label,
          secret: field.secret,
          required: field.required,
          help: field.help,
          configured: Boolean(value),
          maskedValue: value ? (field.secret ? maskSecret(value) : value) : null,
        };
      }),
      settingFields: definition.settingFields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        options: field.options,
        help: field.help,
        defaultValue: field.defaultValue ?? null,
        value: settings[field.key] ?? null,
      })),
      lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
      lastTestSucceeded: row.lastTestSucceeded,
      lastTestMessage: row.lastTestMessage,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function parseEnvironment(value: string | undefined): PaymentEnvironment {
  const upper = (value ?? '').toUpperCase();
  return (PaymentEnvironments as readonly string[]).includes(upper)
    ? (upper as PaymentEnvironment)
    : 'SANDBOX';
}

function readSettings(configuration: Prisma.JsonValue | null): Record<string, string> {
  if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration))
    return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(configuration)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

function defaultSettings(definition: ProviderDefinition): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of definition.settingFields) {
    if (field.defaultValue !== undefined) out[field.key] = field.defaultValue;
  }
  return out;
}
