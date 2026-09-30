import type {
  PaymentEnvironment,
  PaymentProviderName,
  ProviderCapability,
  ProviderDocsStatus,
} from '@pe/shared';

/**
 * Provider abstraction. Business code (orders/checkout) only talks to
 * PaymentsService, which talks to this interface; only adapters know
 * provider HTTP details.
 */

export interface ProviderCredentialField {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
  help?: string;
  /** Pattern the value must match (validated on save). */
  pattern?: RegExp;
}

export interface ProviderSettingField {
  key: string;
  label: string;
  type: 'text' | 'url' | 'select' | 'number';
  options?: Array<{ value: string; label: string }>;
  help?: string;
  defaultValue?: string;
}

export interface ProviderDefinition {
  provider: PaymentProviderName;
  displayName: string;
  /** Customer-facing description shown at checkout. */
  description: string;
  credentialFields: ProviderCredentialField[];
  settingFields: ProviderSettingField[];
  capabilities: ProviderCapability[];
  supportsSandbox: boolean;
  docsStatus: ProviderDocsStatus;
  /** Smallest amount (IRR) the provider accepts, used for admin test payments. */
  minAmount: number;
}

export interface ProviderContext {
  provider: PaymentProviderName;
  environment: PaymentEnvironment;
  credentials: Record<string, string>;
  settings: Record<string, string>;
  /** Absolute callback URL for this provider (API side). */
  callbackUrl: string;
}

export interface CreatePaymentRequest {
  paymentId: string;
  /** Per-attempt idempotency key. */
  requestId: string;
  orderId: string;
  orderNumber: string;
  /** Integer IRR. */
  amount: number;
  currency: 'IRR';
  description: string;
  customer: { mobile: string | null; email: string | null; name: string | null };
  callbackUrl: string;
  items: Array<{ title: string; quantity: number; unitPrice: number }>;
}

export interface CreatePaymentResult {
  /** Provider token/authority/ticket identifying the attempt at the provider. */
  authority: string;
  redirectUrl: string;
  redirectMethod: 'GET' | 'POST';
  redirectFields?: Record<string, string>;
  expiresAt?: Date;
  raw: unknown;
}

export interface CallbackPayload {
  method: 'GET' | 'POST';
  query: Record<string, unknown>;
  body: Record<string, unknown>;
}

export type CallbackOutcome = 'OK' | 'FAILED' | 'CANCELLED' | 'UNKNOWN';

export interface ParsedCallback {
  /** Null when the payload does not identify a payment attempt. */
  authority: string | null;
  /** Browser-supplied hint only; never proof of payment. */
  outcome: CallbackOutcome;
  providerTransactionId: string | null;
  /** Amount echoed by the provider (IRR) when present. */
  amount: number | null;
  /** Merchant reference echoed by the provider when present. */
  reference: string | null;
  raw: Record<string, unknown>;
}

export interface VerifyPaymentRequest {
  paymentId: string;
  requestId: string;
  authority: string;
  amount: number;
  currency: 'IRR';
  callback: ParsedCallback | null;
}

export type VerifyPaymentResult =
  | {
      status: 'PAID';
      providerTransactionId: string;
      cardPanMask: string | null;
      /** Provider reported the transaction was verified earlier (e.g. ZarinPal 101). */
      alreadyVerified: boolean;
      /** Amount the provider confirms (IRR) when it reports one. */
      amount: number | null;
      raw: unknown;
    }
  | { status: 'FAILED'; errorCode: string; errorMessage: string; raw: unknown }
  | { status: 'PENDING'; raw: unknown };

export interface SettlePaymentRequest {
  paymentId: string;
  authority: string;
  providerTransactionId: string;
  amount: number;
}

export interface OperationResult {
  succeeded: boolean;
  providerReference: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  raw: unknown;
}

export interface RefundPaymentRequest {
  paymentId: string;
  authority: string;
  providerTransactionId: string;
  amount: number;
  reason: string | null;
}

export interface InquiryPaymentRequest {
  paymentId: string;
  authority: string;
  amount: number;
}

export interface InquiryPaymentResult {
  status: 'PAID' | 'FAILED' | 'PENDING' | 'UNKNOWN';
  providerTransactionId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  raw: unknown;
}

export interface ConnectionTest {
  ok: boolean;
  message: string;
  raw?: unknown;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  readonly definition: ProviderDefinition;
  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResult>;
  parseCallback(payload: CallbackPayload): ParsedCallback;
  verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResult>;
  /** BNPL providers: confirm/settle after a successful verify. */
  settlePayment?(request: SettlePaymentRequest): Promise<OperationResult>;
  refundPayment?(request: RefundPaymentRequest): Promise<OperationResult>;
  inquirePayment?(request: InquiryPaymentRequest): Promise<InquiryPaymentResult>;
  testConnection(): Promise<ConnectionTest>;
}
