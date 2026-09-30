import { HttpStatus } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception.js';

/** Normalized provider error codes; the original provider code is kept alongside. */
export const PaymentErrorCodes = {
  ProviderUnavailable: 'PROVIDER_UNAVAILABLE',
  InvalidCredentials: 'INVALID_CREDENTIALS',
  ProviderRejected: 'PROVIDER_REJECTED',
  InvalidResponse: 'INVALID_RESPONSE',
  NetworkError: 'NETWORK_ERROR',
  Timeout: 'TIMEOUT',
  AmountMismatch: 'AMOUNT_MISMATCH',
  TransactionMismatch: 'TRANSACTION_MISMATCH',
  PaymentFailed: 'PAYMENT_FAILED',
  UserCancelled: 'USER_CANCELLED',
  NotSupported: 'NOT_SUPPORTED',
  Misconfigured: 'MISCONFIGURED',
} as const;
export type PaymentErrorCode = (typeof PaymentErrorCodes)[keyof typeof PaymentErrorCodes];

/**
 * Thrown by adapters. Carries a normalized code for business logic and the
 * raw provider code for diagnostics. Never contains credentials.
 */
export class PaymentProviderError extends Error {
  constructor(
    readonly code: PaymentErrorCode,
    message: string,
    readonly providerCode: string | null = null,
    readonly retryable = false,
    readonly raw?: unknown,
  ) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}

/** Surfaced to API clients as HTTP 502 with a stable code. */
export class PaymentGatewayAppException extends AppException {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, HttpStatus.BAD_GATEWAY, details);
  }
}
