import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnvironment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export enum LogLevel {
  Fatal = 'fatal',
  Error = 'error',
  Warn = 'warn',
  Log = 'log',
  Debug = 'debug',
  Verbose = 'verbose',
}

const toBoolean = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? ['true', '1', 'yes'].includes(value.toLowerCase()) : value;

const toInt = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

const MIN_SECRET_LENGTH = 32;

/**
 * Strongly typed, validated environment. The application refuses to boot
 * when a required variable is missing or malformed.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT = 4000;

  @IsString()
  API_GLOBAL_PREFIX = 'api/v1';

  @IsUrl({ require_tld: false, require_protocol: true })
  APP_URL = 'http://localhost:3000';

  @IsString()
  CORS_ORIGINS = 'http://localhost:3000';

  @Transform(toBoolean)
  @IsBoolean()
  @IsOptional()
  SWAGGER_ENABLED?: boolean;

  @IsEnum(LogLevel)
  LOG_LEVEL: LogLevel = LogLevel.Log;

  @IsString()
  @MinLength(1)
  DATABASE_URL: string;

  @Transform(toBoolean)
  @IsBoolean()
  TRUST_PROXY = true;

  /** Directory for locally stored uploads (images). */
  @IsString()
  UPLOADS_DIR = 'uploads';

  /** Disables application-level rate limiting (integration tests only). */
  @Transform(toBoolean)
  @IsBoolean()
  THROTTLE_DISABLED = false;

  // --- authentication -------------------------------------------------------

  /** HMAC secret for access tokens. Must be long and random. */
  @IsString()
  @MinLength(MIN_SECRET_LENGTH)
  JWT_ACCESS_SECRET: string;

  @Transform(toInt)
  @IsInt()
  @Min(60)
  @Max(86_400)
  JWT_ACCESS_TTL_SECONDS = 900;

  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(365)
  REFRESH_TOKEN_TTL_DAYS = 30;

  /** Defaults to true in production. */
  @Transform(toBoolean)
  @IsBoolean()
  @IsOptional()
  COOKIE_SECURE?: boolean;

  @IsString()
  @IsOptional()
  COOKIE_DOMAIN?: string;

  @Transform(toInt)
  @IsInt()
  @Min(5)
  @Max(1_440)
  PASSWORD_RESET_TTL_MINUTES = 30;

  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(60)
  VERIFICATION_CODE_TTL_MINUTES = 10;

  @Transform(toInt)
  @IsInt()
  @Min(3)
  @Max(20)
  LOGIN_MAX_FAILED_ATTEMPTS = 5;

  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(1_440)
  LOGIN_LOCK_MINUTES = 15;

  // --- orders & payments ---------------------------------------------------

  /** Minutes a PENDING_PAYMENT order keeps its stock reservation. */
  @Transform(toInt)
  @IsInt()
  @Min(5)
  @Max(1_440)
  ORDER_PAYMENT_TIMEOUT_MINUTES = 30;

  /** Public base URL of the API for provider callbacks (defaults to APP_URL + /api/v1). */
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  API_PUBLIC_URL?: string;

  /** 32-byte key (base64 or hex) used to encrypt payment credentials at rest. */
  @IsString()
  @MinLength(32)
  PAYMENT_ENCRYPTION_KEY: string;

  /** Default platform commission for new sellers, in basis points (1000 = 10%). */
  @Transform(toInt)
  @IsInt()
  @Min(0)
  @Max(5_000)
  MARKETPLACE_DEFAULT_COMMISSION_BPS = 1_000;

  /** Enables the mock payment provider (development/tests only; refused in production). */
  @Transform(toBoolean)
  @IsBoolean()
  PAYMENT_MOCK_ENABLED = false;
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
    exposeDefaultValues: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false, whitelist: false });
  if (errors.length > 0) {
    const messages = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('; ');
    throw new Error(`Invalid environment configuration — ${messages}`);
  }
  return validated;
}
