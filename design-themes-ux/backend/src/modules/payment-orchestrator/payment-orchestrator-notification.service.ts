import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { maskEmail } from '@/shared/email/email.service';
import { OrderConfirmationEmailService } from './order-confirmation-email.service';
import { VendorOrderNotificationService } from '../vendors/vendor-order-notification.service';

// ---------------------------------------------------------------------------
// Payment-orchestration event listeners (INT-PO-1 … INT-PO-4)
//
// The OutboxProcessorService emits these events after each payment-orchestration
// outbox record is persisted and ready to dispatch.  Handlers are READ-ONLY
// (the one exception: ORDER_CREATED records an IdempotencyRecord claim so a
// redelivered event never emails twice) —
// they never modify Order, Payment, Checkout, Inventory, or Outbox state,
// never acquire Redis locks, and never open database transactions.
//
// Handlers MUST NOT throw.  A thrown exception propagates through
// EventEmitter2.emitAsync() back to OutboxProcessorService, which would mark
// the outbox event FAILED and schedule a retry — incorrect for a notification
// failure.  All exceptions are caught and logged.
// The one deliberate exception: if queueing the vendor emails fails (a DB
// error), ORDER_CREATED is rethrown so the outbox retries it. That is safe to
// repeat — vendor queueing is deduped per (order, vendor) and an accepted
// customer confirmation keeps its claim — and it runs after the customer send.
//
// ORDER_CREATED sends the real order confirmation email
// (OrderConfirmationEmailService) and queues one email per vendor whose
// products are on the order (VendorOrderNotificationService.fanOut — delivery
// and retries run as separate VENDOR_ORDER_EMAIL outbox events). The other
// handlers still only resolve context and log what would be sent (recipient masked).
// ---------------------------------------------------------------------------

interface NotificationContext {
  customer:      { id: string; email: string; name: string };
  template:      { subject: string; htmlContent: string; type: string };
  order:         {
    id:            string;
    orderNumber:   string;
    status:        string;
    paymentStatus: string;
    total:         string;
    paymentMethod: string | null;
    customerId:    string | null;
  };
  storeSettings: { orderEmailEnabled: boolean; currency: string };
}

@Injectable()
export class PaymentOrchestratorNotificationService {
  private readonly logger = new Logger(PaymentOrchestratorNotificationService.name);

  constructor(
    private readonly prisma:  PrismaService,
    // Reserved for future EmailService configuration (SMTP host, sender address, etc.)
    private readonly config:  ConfigService, // eslint-disable-line @typescript-eslint/no-unused-vars
    private readonly orderConfirmation: OrderConfirmationEmailService,
    private readonly vendorNotifications: VendorOrderNotificationService,
  ) {}

  // ── INT-PO-1: ORDER_CREATED ───────────────────────────────────────────────

  // suppressErrors: false — the deliberate fan-out rethrow (see header) must reach
  // the outbox processor; @nestjs/event-emitter swallows listener errors by default.
  @OnEvent('ORDER_CREATED', { suppressErrors: false })
  async handleOrderCreated(payload: Record<string, unknown>): Promise<void> {
    const storeId              = payload['storeId']              as string;
    const orderId              = payload['orderId']              as string;
    const orderNumber          = payload['orderNumber']          as string | undefined;
    const paymentTransactionId = payload['paymentTransactionId'] as string | undefined;

    this.logger.log(
      `ORDER_CREATED: orderId=${orderId} storeId=${storeId} ` +
      `orderNumber=${orderNumber ?? '-'} paymentTransactionId=${paymentTransactionId ?? '-'}`,
    );

    try {
      // Real delivery — see OrderConfirmationEmailService (dedupes redelivered
      // events; reports "accepted" only when the SMTP server accepts it).
      const outcome = await this.orderConfirmation.send(storeId, orderId);
      this.logger.log(`ORDER_CREATED: order confirmation email outcome=${outcome} orderId=${orderId}`);
    } catch (err: unknown) {
      this.logger.error(
        `ORDER_CREATED handler error — storeId=${storeId} orderId=${orderId}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Separate try: a customer-email failure must not stop vendor emails.
    try {
      const results = await this.vendorNotifications.fanOut(storeId, orderId);
      if (results.length > 0) {
        this.logger.log(
          `ORDER_CREATED: vendor emails orderId=${orderId} ` +
          results.map((r) => `${r.vendorId}=${r.outcome}`).join(' '),
        );
      }
    } catch (err: unknown) {
      this.logger.error(
        `ORDER_CREATED vendor email queueing failed — storeId=${storeId} orderId=${orderId}: ` +
        `${err instanceof Error ? err.message : String(err)} — event will be retried`,
      );
      throw err; // see header: safe, deduped redelivery
    }
  }

  // ── INT-PO-2: PAYMENT_CAPTURED ────────────────────────────────────────────

  @OnEvent('PAYMENT_CAPTURED')
  async handlePaymentCaptured(payload: Record<string, unknown>): Promise<void> {
    const storeId              = payload['storeId']              as string;
    const orderId              = payload['orderId']              as string;
    const amountInPaise        = payload['amountInPaise']        as number | undefined;
    const paymentTransactionId = payload['paymentTransactionId'] as string | undefined;

    this.logger.log(
      `PAYMENT_CAPTURED: orderId=${orderId} storeId=${storeId} ` +
      `amountInPaise=${amountInPaise ?? '-'} paymentTransactionId=${paymentTransactionId ?? '-'}`,
    );

    try {
      const ctx = await this.resolveNotificationContext(storeId, orderId, 'PAYMENT_CAPTURED');
      if (!ctx) return;

      this.logger.log(
        `[PAYMENT_CAPTURED] Would send email — subject="${ctx.template.subject}" ` +
        `to=${maskEmail(ctx.customer.email)} context={{ ` +
        `customerName="${ctx.customer.name}", ` +
        `orderNumber="${ctx.order.orderNumber}", ` +
        `orderStatus="${ctx.order.status}", ` +
        `orderTotal="${ctx.order.total}", ` +
        `paymentStatus="${ctx.order.paymentStatus}", ` +
        `currency="${ctx.storeSettings.currency}", ` +
        `paymentTransactionId="${paymentTransactionId ?? 'N/A'}", ` +
        `amountInPaise="${amountInPaise ?? 'N/A'}" }}`,
      );
      // TODO: inject EmailService and send transactional email
    } catch (err: unknown) {
      this.logger.error(
        `PAYMENT_CAPTURED handler error — storeId=${storeId} orderId=${orderId}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── INT-PO-3: CHECKOUT_COMPLETED ──────────────────────────────────────────

  @OnEvent('CHECKOUT_COMPLETED')
  async handleCheckoutCompleted(payload: Record<string, unknown>): Promise<void> {
    const storeId           = payload['storeId']           as string;
    const orderId           = payload['orderId']           as string;
    const checkoutSessionId = payload['checkoutSessionId'] as string | undefined;

    this.logger.log(
      `CHECKOUT_COMPLETED: orderId=${orderId} storeId=${storeId} ` +
      `checkoutSessionId=${checkoutSessionId ?? '-'}`,
    );

    try {
      const ctx = await this.resolveNotificationContext(storeId, orderId, 'CHECKOUT_COMPLETED');
      if (!ctx) return;

      this.logger.log(
        `[CHECKOUT_COMPLETED] Would send email — subject="${ctx.template.subject}" ` +
        `to=${maskEmail(ctx.customer.email)} context={{ ` +
        `customerName="${ctx.customer.name}", ` +
        `orderNumber="${ctx.order.orderNumber}", ` +
        `orderStatus="${ctx.order.status}", ` +
        `orderTotal="${ctx.order.total}", ` +
        `paymentStatus="${ctx.order.paymentStatus}", ` +
        `currency="${ctx.storeSettings.currency}" }}`,
      );
      // TODO: inject EmailService and send transactional email
    } catch (err: unknown) {
      this.logger.error(
        `CHECKOUT_COMPLETED handler error — storeId=${storeId} orderId=${orderId}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── INT-PO-4: INVENTORY_COMMITTED ────────────────────────────────────────

  @OnEvent('INVENTORY_COMMITTED')
  async handleInventoryCommitted(payload: Record<string, unknown>): Promise<void> {
    const storeId              = payload['storeId']              as string;
    const orderId              = payload['orderId']              as string;
    const paymentTransactionId = payload['paymentTransactionId'] as string | undefined;

    this.logger.log(
      `INVENTORY_COMMITTED: orderId=${orderId} storeId=${storeId} ` +
      `paymentTransactionId=${paymentTransactionId ?? '-'}`,
    );

    try {
      const ctx = await this.resolveNotificationContext(storeId, orderId, 'INVENTORY_COMMITTED');
      if (!ctx) return;

      this.logger.log(
        `[INVENTORY_COMMITTED] Would send email — subject="${ctx.template.subject}" ` +
        `to=${maskEmail(ctx.customer.email)} context={{ ` +
        `customerName="${ctx.customer.name}", ` +
        `orderNumber="${ctx.order.orderNumber}", ` +
        `orderStatus="${ctx.order.status}", ` +
        `orderTotal="${ctx.order.total}", ` +
        `paymentStatus="${ctx.order.paymentStatus}", ` +
        `currency="${ctx.storeSettings.currency}", ` +
        `paymentTransactionId="${paymentTransactionId ?? 'N/A'}" }}`,
      );
      // TODO: inject EmailService and send transactional email
    } catch (err: unknown) {
      this.logger.error(
        `INVENTORY_COMMITTED handler error — storeId=${storeId} orderId=${orderId}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── Private helper ────────────────────────────────────────────────────────

  /**
   * Resolves all data required to send a transactional notification email.
   * Returns null (and logs) on any early-exit condition so handlers can
   * simply `if (!ctx) return` without additional branching.
   *
   * All Prisma reads are plain findFirst calls — no transactions, no locks.
   * Every query is scoped to storeId (CTL-4 multi-tenant isolation).
   */
  private async resolveNotificationContext(
    storeId:           string,
    orderId:           string,
    emailTemplateType: string,
  ): Promise<NotificationContext | null> {

    // 1. StoreSettings — gate on orderEmailEnabled
    const storeSettings = await this.prisma.storeSettings.findFirst({
      where:  { storeId },
      select: { orderEmailEnabled: true, currency: true },
    });

    if (!storeSettings) {
      this.logger.debug(
        `resolveNotificationContext: no StoreSettings for storeId=${storeId}`,
      );
      return null;
    }

    if (!storeSettings.orderEmailEnabled) {
      this.logger.debug(
        `resolveNotificationContext: orderEmailEnabled=false for storeId=${storeId} — skipping`,
      );
      return null;
    }

    // 2. Order
    const order = await this.prisma.order.findFirst({
      where:  { id: orderId, storeId },
      select: {
        id:            true,
        orderNumber:   true,
        status:        true,
        paymentStatus: true,
        total:         true,
        paymentMethod: true,
        customerId:    true,
      },
    });

    if (!order) {
      this.logger.warn(
        `resolveNotificationContext: Order ${orderId} not found for storeId=${storeId}`,
      );
      return null;
    }

    // 3. Guest orders have no customerId — no email to send
    if (!order.customerId) {
      this.logger.debug(
        `resolveNotificationContext: Order ${orderId} is a guest order — no customer email`,
      );
      return null;
    }

    // 4. Customer
    const customer = await this.prisma.customer.findFirst({
      where:  { id: order.customerId, storeId },
      select: { id: true, email: true, name: true },
    });

    if (!customer || !customer.email) {
      this.logger.warn(
        `resolveNotificationContext: Customer not found or has no email — ` +
        `customerId=${order.customerId} storeId=${storeId}`,
      );
      return null;
    }

    // 5. EmailTemplate — degrade gracefully if the store has not configured one
    const template = await this.prisma.emailTemplate.findFirst({
      where:  { storeId, type: emailTemplateType, isActive: true },
      select: { subject: true, htmlContent: true, type: true },
    });

    if (!template) {
      this.logger.warn(
        `resolveNotificationContext: No active EmailTemplate of type ` +
        `"${emailTemplateType}" for storeId=${storeId} — skipping notification`,
      );
      return null;
    }

    return {
      customer: {
        id:    customer.id,
        email: customer.email,
        name:  customer.name,
      },
      template: {
        subject:     template.subject,
        htmlContent: template.htmlContent,
        type:        template.type,
      },
      order: {
        id:            order.id,
        orderNumber:   order.orderNumber,
        status:        String(order.status),
        paymentStatus: String(order.paymentStatus),
        total:         String(order.total),
        paymentMethod: order.paymentMethod ?? null,
        customerId:    order.customerId,
      },
      storeSettings: {
        orderEmailEnabled: storeSettings.orderEmailEnabled,
        currency:          storeSettings.currency,
      },
    };
  }
}
