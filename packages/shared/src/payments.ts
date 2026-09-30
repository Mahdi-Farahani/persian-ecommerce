/**
 * Payment gateway contracts shared between the API and the admin/storefront UI.
 * Money is an integer in IRR unless a field says otherwise.
 */
import type {
  PaymentEnvironment,
  PaymentProviderName,
  PaymentStatus,
  PaymentView,
} from './orders.js';

export const ProviderCapabilities = [
  'create',
  'verify',
  'settle',
  'refund',
  'reverse',
  'inquiry',
] as const;
export type ProviderCapability = (typeof ProviderCapabilities)[number];

/** How much of the adapter could be checked against the provider's official documentation. */
export type ProviderDocsStatus = 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED';

export interface ProviderCredentialFieldView {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
  help?: string;
  /** True when a value is stored; secrets are never returned, only masked. */
  configured: boolean;
  /** Masked value for secrets (`••••1234`), the plain value for non-secret keys. */
  maskedValue: string | null;
}

export interface ProviderSettingFieldView {
  key: string;
  label: string;
  type: 'text' | 'url' | 'select' | 'number';
  options?: Array<{ value: string; label: string }>;
  help?: string;
  defaultValue: string | null;
  value: string | null;
}

export interface PaymentGatewayAdminView {
  provider: PaymentProviderName;
  displayName: string;
  description: string;
  enabled: boolean;
  isDefault: boolean;
  environment: PaymentEnvironment;
  supportsSandbox: boolean;
  capabilities: ProviderCapability[];
  docsStatus: ProviderDocsStatus;
  /** False when the runtime refuses the provider (e.g. mock in production). */
  available: boolean;
  unavailableReason: string | null;
  credentialFields: ProviderCredentialFieldView[];
  settingFields: ProviderSettingFieldView[];
  lastTestedAt: string | null;
  lastTestSucceeded: boolean | null;
  lastTestMessage: string | null;
  updatedAt: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  testedAt: string;
}

export interface TestPaymentResult {
  supported: boolean;
  redirectUrl: string | null;
  authority: string | null;
  message: string;
}

export interface PaymentTransactionView {
  id: string;
  type: 'PAYMENT' | 'REFUND' | 'REVERSE' | 'SETTLEMENT' | 'INQUIRY';
  amount: number;
  succeeded: boolean;
  providerReference: string | null;
  errorCode: string | null;
  createdAt: string;
}

export interface AdminPaymentSummary extends PaymentView {
  orderStatus: string;
  customer: { id: string; email: string | null; phone: string | null; name: string };
  callbackAt: string | null;
  redirectedAt: string | null;
  updatedAt: string;
}

export interface AdminPaymentDetail extends AdminPaymentSummary {
  requestId: string;
  transactions: PaymentTransactionView[];
  callbackPayload: unknown;
  verificationPayload: unknown;
}

export interface ReconcileResult {
  payment: AdminPaymentDetail;
  providerStatus: 'PAID' | 'FAILED' | 'PENDING' | 'UNKNOWN';
  changed: boolean;
  message: string;
}

/** Outcome the payment result page renders after querying the backend. */
export type PaymentOutcome = 'success' | 'failure' | 'pending';

export function paymentOutcomeOf(status: PaymentStatus): PaymentOutcome {
  switch (status) {
    case 'PAID':
    case 'REFUNDED':
      return 'success';
    case 'FAILED':
    case 'CANCELLED':
    case 'EXPIRED':
      return 'failure';
    default:
      return 'pending';
  }
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  INITIATED: 'ایجادشده',
  REDIRECTED: 'انتقال به درگاه',
  CALLBACK_RECEIVED: 'بازگشت از درگاه',
  VERIFYING: 'در حال تأیید',
  PAID: 'پرداخت‌شده',
  FAILED: 'ناموفق',
  CANCELLED: 'لغوشده',
  EXPIRED: 'منقضی‌شده',
  REFUNDED: 'بازپرداخت‌شده',
};

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProviderName, string> = {
  ZARINPAL: 'زرین‌پال',
  SNAPP_PAY: 'اسنپ‌پی',
  DIGIPAY: 'دیجی‌پی',
  TOROB_PAY: 'ترب‌پی',
  MOCK: 'درگاه آزمایشی',
};

export const PAYMENT_ENVIRONMENT_LABELS: Record<PaymentEnvironment, string> = {
  SANDBOX: 'آزمایشی (Sandbox)',
  PRODUCTION: 'عملیاتی (Production)',
};
