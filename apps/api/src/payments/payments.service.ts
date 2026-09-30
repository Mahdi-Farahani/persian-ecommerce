import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  buildPagination,
  paymentOutcomeOf,
  type AdminPaymentDetail,
  type AdminPaymentSummary,
  type CreatePaymentResponse,
  type Paginated,
  type PaymentProviderInfo,
  type PaymentProviderName,
  type PaymentView,
  type ReconcileResult,
} from '@pe/shared';
import { redactSecrets } from '../audit/audit.service.js';
import {
  ConflictAppException,
  NotFoundAppException,
  UnprocessableAppException,
} from '../common/errors/app.exception.js';
import { AppConfigService } from '../config/app-config.service.js';
import type {
  Payment,
  PaymentStatus,
  PaymentTransactionType,
  Prisma,
} from '../generated/prisma/client.js';
import { OrdersService } from '../orders/orders.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminPaymentsQueryDto } from './dto/payment.dto.js';
import { PaymentProviderFactory } from './payment-provider.factory.js';
import type {
  CallbackPayload,
  ParsedCallback,
  PaymentProvider,
  VerifyPaymentResult,
} from './payment-provider.types.js';
import {
  PaymentErrorCodes,
  PaymentGatewayAppException,
  PaymentProviderError,
} from './payment.errors.js';
import {
  adminPaymentDetailInclude,
  adminPaymentInclude,
  formatOrderNumber,
  toAdminPaymentDetail,
  toAdminPaymentSummary,
} from './payments.mapper.js';
import { ProviderRegistryService } from './provider-registry.service.js';

/**
 * Statuses from which a verification may be claimed. EXPIRED is included so a
 * late gateway callback still gets verified: the customer may have paid after
 * the order expired, and that money must be recorded (and refunded).
 */
const VERIFIABLE_STATUSES: PaymentStatus[] = [
  'INITIATED',
  'REDIRECTED',
  'CALLBACK_RECEIVED',
  'EXPIRED',
];
/** Open attempts that a newer attempt supersedes. */
const OPEN_STATUSES: PaymentStatus[] = ['INITIATED', 'REDIRECTED'];
const ORDER_NOT_PENDING = 'ORDER_NOT_PENDING';
const SUPERSEDED = 'SUPERSEDED';

export interface CallbackResult {
  redirectUrl: string;
  paymentId: string | null;
  outcome: 'success' | 'failure' | 'pending';
}

type PaymentWithOrder = Prisma.PaymentGetPayload<{
  include: {
    order: { select: { number: true; status: true; userId: true; paymentDeadlineAt: true } };
  };
}>;

/**
 * Orchestrates payment attempts: creation, callback intake, server-side
 * verification, order finalization, refunds and reconciliation. Provider
 * specifics stay behind PaymentProvider adapters.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistryService,
    private readonly factory: PaymentProviderFactory,
    private readonly orders: OrdersService,
    private readonly config: AppConfigService,
  ) {}

  listProviders(): Promise<PaymentProviderInfo[]> {
    return this.registry.availableForCheckout();
  }

  // --- creation ------------------------------------------------------------------

  /**
   * Starts (or resumes) a payment attempt for an unpaid order. Re-uses an open
   * attempt on the same provider so retries never create duplicate provider
   * transactions; a different provider supersedes the open attempt.
   */
  async create(
    userId: string,
    input: { orderId: string; provider?: PaymentProviderName },
  ): Promise<CreatePaymentResponse> {
    const order = await this.prisma.order.findFirst({
      where: { id: input.orderId, userId },
      include: {
        user: { select: { email: true, phone: true, firstName: true, lastName: true } },
        items: { select: { productTitle: true, quantity: true, unitPrice: true } },
      },
    });
    if (!order) throw new NotFoundAppException('ORDER_NOT_FOUND', 'سفارش پیدا نشد');
    if (order.status !== 'PENDING_PAYMENT') {
      throw new UnprocessableAppException('ORDER_NOT_PAYABLE', 'این سفارش در انتظار پرداخت نیست');
    }
    if (order.paymentDeadlineAt.getTime() <= Date.now()) {
      throw new UnprocessableAppException(
        'ORDER_PAYMENT_EXPIRED',
        'مهلت پرداخت این سفارش گذشته است',
      );
    }

    const context = await this.registry.resolveForCheckout(input.provider);
    const open = await this.prisma.payment.findFirst({
      where: { orderId: order.id, status: { in: OPEN_STATUSES } },
      orderBy: { attemptNumber: 'desc' },
    });
    if (
      open &&
      open.provider === context.provider &&
      open.redirectUrl &&
      (!open.expiresAt || open.expiresAt.getTime() > Date.now())
    ) {
      return this.toCreateResponse(open, order.number);
    }

    const provider = this.factory.create(context);
    const amount = Number(order.total);
    const attempt = await this.prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { orderId: order.id, status: { in: OPEN_STATUSES } },
        data: { status: 'CANCELLED', errorCode: SUPERSEDED },
      });
      const count = await tx.payment.count({ where: { orderId: order.id } });
      try {
        return await tx.payment.create({
          data: {
            orderId: order.id,
            userId,
            provider: context.provider,
            environment: context.environment,
            attemptNumber: count + 1,
            amount: order.total,
            currency: 'IRR',
            status: 'INITIATED',
            requestId: randomUUID(),
            expiresAt: order.paymentDeadlineAt,
          },
        });
      } catch (error) {
        if ((error as { code?: string }).code === 'P2002') {
          throw new ConflictAppException(
            'PAYMENT_IN_PROGRESS',
            'پرداخت دیگری برای این سفارش در جریان است',
          );
        }
        throw error;
      }
    });

    const callbackUrl = new URL(context.callbackUrl);
    callbackUrl.searchParams.set('paymentId', attempt.id);
    const orderNumber = formatOrderNumber(order.number);
    try {
      const result = await provider.createPayment({
        paymentId: attempt.id,
        requestId: attempt.requestId,
        orderId: order.id,
        orderNumber,
        amount,
        currency: 'IRR',
        description: `پرداخت سفارش ${orderNumber}`,
        customer: {
          mobile: order.user.phone,
          email: order.user.email,
          name: [order.user.firstName, order.user.lastName].filter(Boolean).join(' ') || null,
        },
        callbackUrl: callbackUrl.toString(),
        items: order.items.map((i) => ({
          title: i.productTitle,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
        })),
      });
      const updated = await this.prisma.payment.update({
        where: { id: attempt.id },
        data: {
          status: 'REDIRECTED',
          providerAuthority: result.authority,
          redirectUrl: result.redirectUrl,
          redirectedAt: new Date(),
          expiresAt: result.expiresAt ?? attempt.expiresAt,
          transactions: {
            create: {
              type: 'PAYMENT',
              amount: attempt.amount,
              succeeded: true,
              providerReference: result.authority,
              payload: toJson({ operation: 'create', raw: result.raw }),
            },
          },
        },
      });
      this.logPayment('create', updated, { status: 'ok' });
      return {
        ...this.toCreateResponse(updated, order.number),
        redirectMethod: result.redirectMethod,
        redirectFields: result.redirectFields,
      };
    } catch (error) {
      const failure = this.describeFailure(error);
      await this.prisma.payment.update({
        where: { id: attempt.id },
        data: {
          status: 'FAILED',
          errorCode: failure.code,
          errorMessage: failure.message.slice(0, 500),
          transactions: {
            create: {
              type: 'PAYMENT',
              amount: attempt.amount,
              succeeded: false,
              errorCode: failure.code,
              payload: toJson({ operation: 'create', error: failure }),
            },
          },
        },
      });
      this.logPayment('create', attempt, { status: 'failed', errorCode: failure.code });
      throw new PaymentGatewayAppException('PAYMENT_CREATE_FAILED', failure.message, {
        code: failure.code,
        providerCode: failure.providerCode,
      });
    }
  }

  // --- customer reads ------------------------------------------------------------

  async getForUser(userId: string, paymentId: string): Promise<PaymentView> {
    const row = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
      include: { order: { select: { number: true } } },
    });
    if (!row) throw new NotFoundAppException('PAYMENT_NOT_FOUND', 'پرداخت پیدا نشد');
    return this.toView(row, row.order.number);
  }

  /**
   * Customer-triggered verification for a lost callback. Only attempts that
   * reached the provider can be verified; the result is authoritative.
   */
  async verifyForUser(userId: string, paymentId: string): Promise<PaymentView> {
    const row = await this.prisma.payment.findFirst({ where: { id: paymentId, userId } });
    if (!row) throw new NotFoundAppException('PAYMENT_NOT_FOUND', 'پرداخت پیدا نشد');
    if (!row.providerAuthority) {
      throw new UnprocessableAppException(
        'PAYMENT_NOT_VERIFIABLE',
        'این پرداخت به درگاه ارسال نشده است',
      );
    }
    try {
      await this.verify(paymentId, null);
    } catch (error) {
      if (error instanceof PaymentProviderError) {
        throw new PaymentGatewayAppException('PAYMENT_VERIFY_FAILED', error.message, {
          code: error.code,
          providerCode: error.providerCode,
        });
      }
      throw error;
    }
    return this.getForUser(userId, paymentId);
  }

  // --- callbacks ----------------------------------------------------------------

  /**
   * Untrusted provider callback. Locates the attempt by provider + authority
   * (with the `paymentId` hint cross-checked), records the payload, verifies
   * server-side and returns where to send the browser. Idempotent: repeated
   * callbacks for a finished attempt only redirect.
   */
  async handleCallback(
    providerName: PaymentProviderName,
    payload: CallbackPayload,
  ): Promise<CallbackResult> {
    const hint = typeof payload.query.paymentId === 'string' ? payload.query.paymentId : null;
    const isTest = payload.query.test === '1';
    let context;
    try {
      context = await this.registry.contextForAdmin(providerName);
    } catch {
      return this.failureRedirect(null, 'PROVIDER_UNKNOWN');
    }
    const provider = this.factory.create(context);
    const parsed = provider.parseCallback(payload);

    if (isTest) {
      const url = new URL(`${this.config.appUrl}/admin/settings/payment-gateways`);
      url.searchParams.set('test', providerName);
      url.searchParams.set('outcome', parsed.outcome);
      return {
        redirectUrl: url.toString(),
        paymentId: null,
        outcome: parsed.outcome === 'OK' ? 'success' : 'failure',
      };
    }

    const payment = await this.locate(providerName, parsed, hint);
    if (!payment) {
      this.logger.warn({ message: 'callback for unknown payment', provider: providerName, hint });
      return this.failureRedirect(null, 'PAYMENT_NOT_FOUND');
    }
    if (
      parsed.authority &&
      payment.providerAuthority &&
      parsed.authority !== payment.providerAuthority
    ) {
      this.logger.warn({
        message: 'callback authority mismatch',
        paymentId: payment.id,
        provider: providerName,
      });
      return this.failureRedirect(payment.id, PaymentErrorCodes.TransactionMismatch);
    }

    await this.prisma.payment.updateMany({
      where: { id: payment.id, callbackAt: null },
      data: { callbackAt: new Date(), callbackPayload: toJson(parsed.raw) },
    });

    let final: Payment;
    try {
      final = await this.verify(payment.id, parsed);
    } catch (error) {
      if (error instanceof PaymentProviderError) {
        this.logPayment('callback', payment, { status: 'provider-error', errorCode: error.code });
        return this.redirectFor(payment.id, 'pending');
      }
      throw error;
    }
    return this.redirectFor(final.id, paymentOutcomeOf(final.status));
  }

  private async locate(
    providerName: PaymentProviderName,
    parsed: ParsedCallback,
    hint: string | null,
  ): Promise<Payment | null> {
    if (parsed.authority) {
      const byAuthority = await this.prisma.payment.findFirst({
        where: { provider: providerName, providerAuthority: parsed.authority },
        orderBy: { createdAt: 'desc' },
      });
      if (byAuthority) return byAuthority;
    }
    if (hint) {
      const byHint = await this.prisma.payment.findFirst({
        where: { id: hint, provider: providerName },
      });
      if (byHint) return byHint;
    }
    if (parsed.reference) {
      return this.prisma.payment.findFirst({
        where: {
          provider: providerName,
          OR: [{ id: parsed.reference }, { requestId: parsed.reference }],
        },
      });
    }
    return null;
  }

  // --- verification core ----------------------------------------------------------

  /**
   * Claims the attempt (single verifier wins), checks amounts, asks the
   * provider and finalizes the order in one transaction. Provider/network
   * errors release the claim so a later callback or reconciliation can retry.
   */
  async verify(
    paymentId: string,
    callback: ParsedCallback | null,
    options: { claimFrom?: PaymentStatus[] } = {},
  ): Promise<Payment> {
    const claimFrom = options.claimFrom ?? VERIFIABLE_STATUSES;
    const claimed = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: { in: claimFrom } },
      data: { status: 'VERIFYING' },
    });
    if (claimed.count === 0) {
      // Already verified, terminal, or another request holds the claim.
      return this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    }

    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: {
        order: { select: { number: true, status: true, userId: true, paymentDeadlineAt: true } },
      },
    });
    const amount = Number(payment.amount);

    if (callback?.amount !== null && callback?.amount !== undefined && callback.amount !== amount) {
      this.logger.error({
        message: 'callback amount mismatch',
        paymentId,
        expected: amount,
        received: callback.amount,
      });
      return this.markFailed(
        payment,
        PaymentErrorCodes.AmountMismatch,
        'مبلغ اعلام‌شده با مبلغ سفارش مطابقت ندارد',
        callback.raw,
      );
    }
    if (callback?.outcome === 'CANCELLED') {
      return this.markCancelled(payment, callback.raw);
    }
    if (!payment.providerAuthority) {
      return this.markFailed(
        payment,
        PaymentErrorCodes.TransactionMismatch,
        'شناسهٔ تراکنش درگاه موجود نیست',
        null,
      );
    }

    let provider: PaymentProvider;
    let result: VerifyPaymentResult;
    try {
      provider = this.factory.create(await this.registry.contextForAdmin(payment.provider));
      result = await provider.verifyPayment({
        paymentId,
        requestId: payment.requestId,
        authority: payment.providerAuthority,
        amount,
        currency: 'IRR',
        callback,
      });
    } catch (error) {
      // Release the claim so the next callback/reconcile can retry.
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'CALLBACK_RECEIVED' },
      });
      throw error;
    }

    if (result.status === 'PENDING') {
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'CALLBACK_RECEIVED' },
      });
      this.logPayment('verify', payment, { status: 'pending' });
      return this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    }
    if (result.status === 'FAILED') {
      this.logPayment('verify', payment, { status: 'failed', errorCode: result.errorCode });
      return this.markFailed(payment, result.errorCode, result.errorMessage, result.raw);
    }
    if (result.amount !== null && result.amount !== amount) {
      this.logger.error({
        message: 'provider confirmed a different amount; manual reconciliation required',
        paymentId,
        expected: amount,
        confirmed: result.amount,
      });
      return this.markFailed(
        payment,
        PaymentErrorCodes.AmountMismatch,
        'مبلغ تأییدشده توسط درگاه با سفارش مطابقت ندارد',
        result.raw,
      );
    }

    const finalized = await this.finalize(payment, result);
    this.logPayment('verify', finalized, {
      status: 'paid',
      alreadyVerified: result.alreadyVerified,
    });

    if (provider.settlePayment && provider.definition.capabilities.includes('settle')) {
      await this.settle(provider, finalized, result.providerTransactionId);
    }
    return finalized;
  }

  /** Marks the attempt PAID and the order PAID (commits reserved stock) atomically. */
  private async finalize(
    payment: PaymentWithOrder,
    result: Extract<VerifyPaymentResult, { status: 'PAID' }>,
  ): Promise<Payment> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: payment.orderId },
        select: { status: true },
      });
      let errorCode: string | null = null;
      if (order.status === 'PENDING_PAYMENT') {
        await this.orders.transition(
          tx,
          payment.orderId,
          'PENDING_PAYMENT',
          'PAID',
          `پرداخت موفق (${payment.provider})`,
          payment.userId,
        );
      } else if (order.status !== 'PAID') {
        // Paid after expiry/cancellation: money was captured, stock is gone. Flag for refund.
        errorCode = ORDER_NOT_PENDING;
        this.logger.error({
          message: 'payment verified for a non-pending order',
          paymentId: payment.id,
          orderStatus: order.status,
        });
      }
      return tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          verifiedAt: new Date(),
          providerTransactionId: result.providerTransactionId,
          cardPanMask: result.cardPanMask,
          verificationPayload: toJson(result.raw),
          errorCode,
          errorMessage: errorCode
            ? 'پرداخت پس از لغو/انقضای سفارش تأیید شد؛ نیاز به بازپرداخت'
            : null,
          transactions: {
            create: {
              type: 'PAYMENT',
              amount: payment.amount,
              succeeded: true,
              providerReference: result.providerTransactionId,
              payload: toJson({
                operation: 'verify',
                alreadyVerified: result.alreadyVerified,
                raw: result.raw,
              }),
            },
          },
        },
      });
    });
  }

  private async settle(
    provider: PaymentProvider,
    payment: Payment,
    providerTransactionId: string,
  ): Promise<void> {
    let outcome: {
      succeeded: boolean;
      providerReference: string | null;
      errorCode: string | null;
      raw: unknown;
    };
    try {
      outcome = await provider.settlePayment!({
        paymentId: payment.id,
        authority: payment.providerAuthority!,
        providerTransactionId,
        amount: Number(payment.amount),
      });
    } catch (error) {
      const failure = this.describeFailure(error);
      outcome = {
        succeeded: false,
        providerReference: null,
        errorCode: failure.code,
        raw: failure,
      };
    }
    await this.prisma.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        type: 'SETTLEMENT',
        amount: payment.amount,
        succeeded: outcome.succeeded,
        providerReference: outcome.providerReference,
        errorCode: outcome.errorCode,
        payload: toJson({ operation: 'settle', raw: outcome.raw }),
      },
    });
    if (!outcome.succeeded) {
      this.logger.error({
        message: 'settlement failed; reconcile later',
        paymentId: payment.id,
        errorCode: outcome.errorCode,
      });
    }
  }

  private async markFailed(
    payment: Payment,
    errorCode: string,
    errorMessage: string,
    raw: unknown,
  ): Promise<Payment> {
    return this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        errorCode: errorCode.slice(0, 64),
        errorMessage: errorMessage.slice(0, 500),
        verificationPayload: toJson(raw),
        transactions: {
          create: {
            type: 'PAYMENT',
            amount: payment.amount,
            succeeded: false,
            errorCode: errorCode.slice(0, 64),
            payload: toJson({ operation: 'verify', raw }),
          },
        },
      },
    });
  }

  private markCancelled(payment: Payment, raw: unknown): Promise<Payment> {
    return this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'CANCELLED',
        errorCode: PaymentErrorCodes.UserCancelled,
        errorMessage: 'پرداخت توسط کاربر لغو شد',
        verificationPayload: toJson(raw),
      },
    });
  }

  // --- administration -------------------------------------------------------------

  async adminList(query: AdminPaymentsQueryDto): Promise<Paginated<AdminPaymentSummary>> {
    const where: Prisma.PaymentWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.provider) where.provider = query.provider;
    if (query.orderId) where.orderId = query.orderId;
    if (query.search) {
      const numeric = Number(query.search.replace(/^PE-?/i, ''));
      where.OR = [
        { providerAuthority: { contains: query.search } },
        { providerTransactionId: { contains: query.search } },
        ...(Number.isInteger(numeric) && numeric > 0 ? [{ order: { number: numeric } }] : []),
        { order: { user: { email: { contains: query.search } } } },
        { order: { user: { phone: { contains: query.search } } } },
      ];
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        include: adminPaymentInclude,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return {
      items: rows.map(toAdminPaymentSummary),
      pagination: buildPagination(query.page, query.limit, total),
    };
  }

  async adminGet(paymentId: string): Promise<AdminPaymentDetail> {
    const row = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: adminPaymentDetailInclude,
    });
    if (!row) throw new NotFoundAppException('PAYMENT_NOT_FOUND', 'پرداخت پیدا نشد');
    return toAdminPaymentDetail(row);
  }

  /**
   * Queries the provider and synchronizes our state. A payment only becomes
   * PAID through the provider's own verify/inquiry confirmation.
   */
  async reconcile(paymentId: string): Promise<ReconcileResult> {
    const before = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!before) throw new NotFoundAppException('PAYMENT_NOT_FOUND', 'پرداخت پیدا نشد');
    if (!before.providerAuthority) {
      return {
        payment: await this.adminGet(paymentId),
        providerStatus: 'UNKNOWN',
        changed: false,
        message: 'این پرداخت به درگاه ارسال نشده بود',
      };
    }
    const provider = this.factory.create(await this.registry.contextForAdmin(before.provider));
    const amount = Number(before.amount);

    let providerStatus: ReconcileResult['providerStatus'] = 'UNKNOWN';
    let message = 'وضعیت از درگاه دریافت شد';
    try {
      if (provider.inquirePayment && provider.definition.capabilities.includes('inquiry')) {
        const inquiry = await provider.inquirePayment({
          paymentId,
          authority: before.providerAuthority,
          amount,
        });
        providerStatus = inquiry.status;
        message = inquiry.errorMessage ?? message;
        await this.prisma.paymentTransaction.create({
          data: {
            paymentId,
            type: 'INQUIRY',
            amount: before.amount,
            succeeded: inquiry.status !== 'UNKNOWN',
            providerReference: inquiry.providerTransactionId,
            errorCode: inquiry.errorCode,
            payload: toJson({ operation: 'inquiry', raw: inquiry.raw }),
          },
        });
      }
      const isOpen = VERIFIABLE_STATUSES.includes(before.status);
      if (
        before.status !== 'PAID' &&
        before.status !== 'REFUNDED' &&
        (providerStatus === 'PAID' ||
          (providerStatus === 'UNKNOWN' && isOpen) ||
          providerStatus === 'PENDING')
      ) {
        // Only a provider verify confirms money; it is idempotent on their side.
        const after = await this.verify(paymentId, null, {
          claimFrom: [...VERIFIABLE_STATUSES, 'FAILED'],
        });
        providerStatus =
          after.status === 'PAID' ? 'PAID' : after.status === 'FAILED' ? 'FAILED' : providerStatus;
      } else if (providerStatus === 'FAILED' && isOpen) {
        await this.markFailed(before, 'RECONCILED_FAILED', message, null);
      }
    } catch (error) {
      if (error instanceof PaymentProviderError) {
        throw new PaymentGatewayAppException('PAYMENT_RECONCILE_FAILED', error.message, {
          code: error.code,
          providerCode: error.providerCode,
        });
      }
      throw error;
    }
    const payment = await this.adminGet(paymentId);
    const changed = payment.status !== before.status;
    this.logPayment('reconcile', before, { status: payment.status, providerStatus, changed });
    return { payment, providerStatus, changed, message };
  }

  /** Refund/reverse a PAID attempt of a cancelled or returned order. */
  async refund(paymentId: string, reason: string | null): Promise<AdminPaymentDetail> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: { select: { status: true, number: true } } },
    });
    if (!payment) throw new NotFoundAppException('PAYMENT_NOT_FOUND', 'پرداخت پیدا نشد');
    if (payment.status !== 'PAID' || !payment.providerAuthority || !payment.providerTransactionId) {
      throw new UnprocessableAppException(
        'PAYMENT_NOT_REFUNDABLE',
        'فقط پرداخت‌های موفق قابل بازپرداخت هستند',
      );
    }
    const refundableOrder =
      ['CANCELLED', 'RETURNED'].includes(payment.order.status) ||
      payment.errorCode === ORDER_NOT_PENDING;
    if (!refundableOrder) {
      throw new UnprocessableAppException(
        'ORDER_NOT_REFUNDABLE',
        'ابتدا سفارش باید لغو یا مرجوع شود',
      );
    }
    const provider = this.factory.create(await this.registry.contextForAdmin(payment.provider));
    const capability = provider.definition.capabilities.includes('refund')
      ? 'REFUND'
      : provider.definition.capabilities.includes('reverse')
        ? 'REVERSE'
        : null;
    if (!capability || !provider.refundPayment) {
      throw new UnprocessableAppException(
        'REFUND_NOT_SUPPORTED',
        'این درگاه بازپرداخت از طریق API را پشتیبانی نمی‌کند',
      );
    }
    let outcome;
    try {
      outcome = await provider.refundPayment({
        paymentId,
        authority: payment.providerAuthority,
        providerTransactionId: payment.providerTransactionId,
        amount: Number(payment.amount),
        reason,
      });
    } catch (error) {
      const failure = this.describeFailure(error);
      await this.ledger(paymentId, capability, payment.amount, false, null, failure.code, {
        error: failure,
      });
      throw new PaymentGatewayAppException('PAYMENT_REFUND_FAILED', failure.message, {
        code: failure.code,
        providerCode: failure.providerCode,
      });
    }
    await this.ledger(
      paymentId,
      capability,
      payment.amount,
      outcome.succeeded,
      outcome.providerReference,
      outcome.errorCode,
      { raw: outcome.raw },
    );
    if (!outcome.succeeded) {
      throw new PaymentGatewayAppException(
        'PAYMENT_REFUND_FAILED',
        outcome.errorMessage ?? 'بازپرداخت انجام نشد',
        { providerCode: outcome.errorCode },
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: paymentId }, data: { status: 'REFUNDED' } });
      const order = await tx.order.findUniqueOrThrow({
        where: { id: payment.orderId },
        select: { status: true },
      });
      if (order.status === 'CANCELLED' || order.status === 'RETURNED') {
        await this.orders.transition(
          tx,
          payment.orderId,
          order.status,
          'REFUNDED',
          reason ?? 'بازپرداخت وجه',
          null,
        );
      }
    });
    this.logPayment('refund', payment, { status: 'ok', capability });
    return this.adminGet(paymentId);
  }

  // --- helpers -----------------------------------------------------------------

  private async ledger(
    paymentId: string,
    type: PaymentTransactionType,
    amount: bigint,
    succeeded: boolean,
    providerReference: string | null,
    errorCode: string | null,
    payload: unknown,
  ): Promise<void> {
    await this.prisma.paymentTransaction.create({
      data: {
        paymentId,
        type,
        amount,
        succeeded,
        providerReference,
        errorCode,
        payload: toJson(payload),
      },
    });
  }

  private toCreateResponse(payment: Payment, orderNumber: number): CreatePaymentResponse {
    return {
      payment: this.toView(payment, orderNumber),
      redirectUrl: payment.redirectUrl!,
      redirectMethod: 'GET',
    };
  }

  private toView(payment: Payment, orderNumber: number): PaymentView {
    return {
      id: payment.id,
      orderId: payment.orderId,
      orderNumber: formatOrderNumber(orderNumber),
      provider: payment.provider,
      environment: payment.environment,
      attemptNumber: payment.attemptNumber,
      amount: Number(payment.amount),
      currency: 'IRR',
      status: payment.status,
      providerAuthority: payment.providerAuthority,
      providerTransactionId: payment.providerTransactionId,
      cardPanMask: payment.cardPanMask,
      errorCode: payment.errorCode,
      errorMessage: payment.errorMessage,
      createdAt: payment.createdAt.toISOString(),
      verifiedAt: payment.verifiedAt?.toISOString() ?? null,
    };
  }

  private redirectFor(paymentId: string, outcome: CallbackResult['outcome']): CallbackResult {
    const url = new URL(`${this.config.appUrl}/payment/${outcome}`);
    url.searchParams.set('paymentId', paymentId);
    return { redirectUrl: url.toString(), paymentId, outcome };
  }

  private failureRedirect(paymentId: string | null, reason: string): CallbackResult {
    const url = new URL(`${this.config.appUrl}/payment/failure`);
    if (paymentId) url.searchParams.set('paymentId', paymentId);
    url.searchParams.set('reason', reason);
    return { redirectUrl: url.toString(), paymentId, outcome: 'failure' };
  }

  private describeFailure(error: unknown): {
    code: string;
    message: string;
    providerCode: string | null;
  } {
    if (error instanceof PaymentProviderError) {
      return { code: error.code, message: error.message, providerCode: error.providerCode };
    }
    this.logger.error(`unexpected payment error: ${(error as Error).message}`);
    return {
      code: PaymentErrorCodes.ProviderUnavailable,
      message: 'خطای غیرمنتظره در ارتباط با درگاه',
      providerCode: null,
    };
  }

  private logPayment(operation: string, payment: Payment, extra: Record<string, unknown>): void {
    this.logger.log({
      message: 'payment',
      operation,
      provider: payment.provider,
      paymentId: payment.id,
      orderId: payment.orderId,
      requestId: payment.requestId,
      providerTransactionId: payment.providerTransactionId,
      ...extra,
    });
  }
}

/** JSON-safe, secret-redacted copy of a provider payload for the ledger. */
export function toJson(value: unknown): Prisma.InputJsonValue {
  if (value === undefined || value === null) return {};
  return JSON.parse(
    JSON.stringify(redactSecrets(value), (_k, v: unknown) =>
      typeof v === 'bigint' ? v.toString() : v,
    ),
  ) as Prisma.InputJsonValue;
}
