'use client';

import {
  PAYMENT_ENVIRONMENT_LABELS,
  PaymentEnvironments,
  formatJalaliDateTime,
  type ConnectionTestResult,
  type PaymentEnvironment,
  type PaymentGatewayAdminView,
  type TestPaymentResult,
} from '@pe/shared';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { Badge } from '@/components/admin/badge';
import { Checkbox } from '@/components/admin/checkbox';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SelectField, TextField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import { browserApi } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { providerSlug } from '@/lib/payments/gateways';

const copy = adminFa.gateways;
const CONFIRM_PRODUCTION_CODE = 'PAYMENT_GATEWAY_CONFIRM_PRODUCTION';

export interface GatewayPermissions {
  update: boolean;
  test: boolean;
}

interface GatewayCardProps {
  gateway: PaymentGatewayAdminView;
  permissions: GatewayPermissions;
}

type Busy = 'save' | 'test' | 'testPayment' | 'default' | null;

interface GatewayPatch {
  enabled?: boolean;
  isDefault?: boolean;
  environment?: PaymentEnvironment;
  credentials?: Record<string, string>;
  settings?: Record<string, string>;
  confirmProduction?: boolean;
}

function initialCredentials(gateway: PaymentGatewayAdminView): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of gateway.credentialFields) {
    // Secrets start empty (placeholder shows the mask); plain keys are prefilled.
    values[field.key] = field.secret ? '' : (field.maskedValue ?? '');
  }
  return values;
}

function initialSettings(gateway: PaymentGatewayAdminView): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of gateway.settingFields) {
    values[field.key] = field.value ?? field.defaultValue ?? '';
  }
  return values;
}

const environmentOptions = PaymentEnvironments.map((environment) => ({
  value: environment,
  label: PAYMENT_ENVIRONMENT_LABELS[environment],
}));

/**
 * Configuration card for one payment provider. Untouched secret inputs are
 * sent as empty strings, which the API treats as "keep the stored value".
 */
export function GatewayCard({ gateway: initial, permissions }: GatewayCardProps) {
  const router = useRouter();
  const headingId = useId();
  const [gateway, setGateway] = useState(initial);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [environment, setEnvironment] = useState<PaymentEnvironment>(initial.environment);
  const [credentials, setCredentials] = useState(() => initialCredentials(initial));
  const [settings, setSettings] = useState(() => initialSettings(initial));
  const [busy, setBusy] = useState<Busy>(null);
  const [confirmingProduction, setConfirmingProduction] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const slug = providerSlug(gateway.provider);
  const canEdit = permissions.update && gateway.available;
  const canTest = permissions.test && gateway.available;

  const applyView = (view: PaymentGatewayAdminView) => {
    setGateway(view);
    setEnabled(view.enabled);
    setEnvironment(view.environment);
    setCredentials(initialCredentials(view));
    setSettings(initialSettings(view));
  };

  const patch = async (body: GatewayPatch, kind: Exclude<Busy, null>) => {
    setBusy(kind);
    setNotice(null);
    try {
      const view = await browserApi.patch<PaymentGatewayAdminView>(
        `/admin/payment-gateways/${slug}`,
        body,
      );
      applyView(view);
      setConfirmingProduction(false);
      setNotice({ tone: 'success', message: copy.saved });
      router.refresh();
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.code === CONFIRM_PRODUCTION_CODE) {
        setConfirmingProduction(true);
      } else {
        setNotice({ tone: 'error', message: adminErrorMessage(error) });
      }
      return false;
    } finally {
      setBusy(null);
    }
  };

  const formPayload = (confirmProduction = false): GatewayPatch => ({
    enabled,
    environment,
    credentials,
    settings,
    ...(confirmProduction ? { confirmProduction: true } : {}),
  });

  const save = (event: FormEvent) => {
    event.preventDefault();
    void patch(formPayload(), 'save');
  };

  const testConnection = async () => {
    setBusy('test');
    setNotice(null);
    try {
      const result = await browserApi.post<ConnectionTestResult>(
        `/admin/payment-gateways/${slug}/test`,
        {},
      );
      setGateway((current) => ({
        ...current,
        lastTestedAt: result.testedAt,
        lastTestSucceeded: result.ok,
        lastTestMessage: result.message,
      }));
      setNotice({ tone: result.ok ? 'success' : 'error', message: result.message });
    } catch (error) {
      setNotice({ tone: 'error', message: adminErrorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const testPayment = async () => {
    setBusy('testPayment');
    setNotice(null);
    try {
      const result = await browserApi.post<TestPaymentResult>(
        `/admin/payment-gateways/${slug}/test-payment`,
        {},
      );
      if (!result.supported) {
        setNotice({ tone: 'error', message: result.message || copy.testPaymentUnsupported });
        return;
      }
      if (result.redirectUrl) window.open(result.redirectUrl, '_blank', 'noopener,noreferrer');
      setNotice({ tone: 'success', message: result.message || copy.testPaymentStarted });
    } catch (error) {
      setNotice({ tone: 'error', message: adminErrorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby={headingId}>
      <Card className="flex flex-col gap-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id={headingId} className="text-lg font-bold">
              {gateway.displayName}
            </h2>
            <p className="text-sm text-ink-muted">{gateway.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {gateway.isDefault ? <Badge tone="info">{copy.default}</Badge> : null}
            <Badge tone={gateway.enabled ? 'success' : 'neutral'}>
              {gateway.enabled ? copy.enabled : copy.disabled}
            </Badge>
            <Badge tone={gateway.environment === 'PRODUCTION' ? 'warning' : 'neutral'}>
              {gateway.environment === 'PRODUCTION'
                ? copy.productionWarning
                : PAYMENT_ENVIRONMENT_LABELS[gateway.environment]}
            </Badge>
            <Badge
              tone={
                gateway.docsStatus === 'VERIFIED'
                  ? 'success'
                  : gateway.docsStatus === 'PARTIAL'
                    ? 'warning'
                    : 'danger'
              }
            >
              {copy.docsStatuses[gateway.docsStatus] ?? gateway.docsStatus}
            </Badge>
          </div>
        </header>

        {!gateway.available ? (
          <Alert tone="warning">
            {copy.unavailable}
            {gateway.unavailableReason ? ` — ${gateway.unavailableReason}` : ''}
          </Alert>
        ) : null}

        <p className="text-xs text-ink-muted">
          {copy.capabilities}:{' '}
          {gateway.capabilities.map((c) => copy.capabilityLabels[c] ?? c).join('، ')}
        </p>

        {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}

        {confirmingProduction ? (
          <div
            role="dialog"
            aria-modal="false"
            aria-label={copy.confirmProductionTitle}
            className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <p className="font-bold">{copy.confirmProductionTitle}</p>
            <p className="mt-1">{copy.confirmProductionBody}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="danger"
                size="sm"
                loading={busy === 'save'}
                onClick={() => void patch(formPayload(true), 'save')}
              >
                {copy.confirmProduction}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => setConfirmingProduction(false)}
              >
                {t.common.cancel}
              </Button>
            </div>
          </div>
        ) : null}

        <form onSubmit={save} className="flex flex-col gap-4">
          <fieldset disabled={!canEdit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label={copy.environment}
                name={`${slug}-environment`}
                value={environment}
                options={
                  gateway.supportsSandbox
                    ? environmentOptions
                    : environmentOptions.filter((o) => o.value === 'PRODUCTION')
                }
                hint={gateway.supportsSandbox ? undefined : copy.sandboxOnly}
                onChange={(event) => setEnvironment(event.target.value as PaymentEnvironment)}
              />
              <Checkbox
                label={copy.enable}
                name={`${slug}-enabled`}
                checked={enabled}
                containerClassName="self-end pb-3"
                onChange={(event) => setEnabled(event.target.checked)}
              />
            </div>

            {gateway.credentialFields.length > 0 ? (
              <div>
                <h3 className="mb-2 text-sm font-bold">{copy.credentials}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {gateway.credentialFields.map((field) => (
                    <TextField
                      key={field.key}
                      label={field.label}
                      name={`${slug}-credential-${field.key}`}
                      type={field.secret ? 'password' : 'text'}
                      autoComplete="off"
                      dir="ltr"
                      optional={!field.required}
                      placeholder={
                        field.secret ? (field.maskedValue ?? copy.secretPlaceholder) : undefined
                      }
                      hint={
                        field.help ??
                        (field.secret
                          ? field.configured
                            ? copy.configured
                            : copy.notConfigured
                          : undefined)
                      }
                      value={credentials[field.key] ?? ''}
                      onChange={(event) =>
                        setCredentials((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {gateway.settingFields.length > 0 ? (
              <div>
                <h3 className="mb-2 text-sm font-bold">{copy.settings}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {gateway.settingFields.map((field) =>
                    field.type === 'select' ? (
                      <SelectField
                        key={field.key}
                        label={field.label}
                        name={`${slug}-setting-${field.key}`}
                        hint={field.help}
                        options={field.options ?? []}
                        value={settings[field.key] ?? ''}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      <TextField
                        key={field.key}
                        label={field.label}
                        name={`${slug}-setting-${field.key}`}
                        type={
                          field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'
                        }
                        dir="ltr"
                        hint={field.help}
                        placeholder={field.defaultValue ?? undefined}
                        value={settings[field.key] ?? ''}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                      />
                    ),
                  )}
                </div>
              </div>
            ) : null}
          </fieldset>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            {canEdit ? (
              <Button type="submit" loading={busy === 'save'} disabled={busy !== null}>
                {copy.save}
              </Button>
            ) : null}
            {canTest ? (
              <>
                <Button
                  variant="outline"
                  loading={busy === 'test'}
                  disabled={busy !== null}
                  onClick={() => void testConnection()}
                >
                  {busy === 'test' ? copy.testing : copy.testConnection}
                </Button>
                <Button
                  variant="outline"
                  loading={busy === 'testPayment'}
                  disabled={busy !== null}
                  onClick={() => void testPayment()}
                >
                  {copy.testPayment}
                </Button>
              </>
            ) : null}
            {canEdit && !gateway.isDefault ? (
              <Button
                variant="ghost"
                loading={busy === 'default'}
                disabled={busy !== null}
                onClick={() => void patch({ isDefault: true }, 'default')}
              >
                {copy.setDefault}
              </Button>
            ) : null}
            <span className="ms-auto text-xs text-ink-muted">
              {copy.lastTest}:{' '}
              {gateway.lastTestedAt ? (
                <>
                  <Badge tone={gateway.lastTestSucceeded ? 'success' : 'danger'}>
                    {gateway.lastTestSucceeded ? copy.lastTestOk : copy.lastTestFailed}
                  </Badge>{' '}
                  {formatJalaliDateTime(gateway.lastTestedAt)}
                  {gateway.lastTestMessage ? ` — ${gateway.lastTestMessage}` : ''}
                </>
              ) : (
                copy.neverTested
              )}
            </span>
          </div>
        </form>
      </Card>
    </section>
  );
}
