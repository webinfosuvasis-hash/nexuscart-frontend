import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Cancellation notification event listeners (INT-CN-1, INT-CN-2)
//
// The OutboxProcessorService emits these events after each cancellation outbox
// record is persisted and ready to dispatch.  Handlers are READ-ONLY: they
// never modify Order, Payment, Refund, Inventory, or Outbox state, never
// acquire Redis locks, and never open database transactions.
//
// Handlers MUST NOT throw.  A thrown exception propagates through
// EventEmitter2.emitAsync() back to OutboxProcessorService, which would mark
// the outbox event FAILED and schedule a retry — incorrect for a notification
// failure.  All exceptions are caught and logged.
//
// Both EVENT TYPES already have handlers in CancellationEventListenerService
// (stub log for ORDER_CANCELLED; ops webhook alert for REFUND_FAILED).
// EventEmitter2 fans out to ALL registered @OnEvent() handlers concurrently
// via Promise.all — both services coexist without conflict.
//
// EmailService integration is deferred.  Each handler resolves full
// notification context and logs what would be sent.
// ---------------------------------------------------------------------------

interface NotificationContext {
  customer:      { id: string; email: string; name: string };
  template:      { subject: string; htmlContent: string; type: string };
  order:         {
    id:                 string;
    orderNumber:        string;
    status:             string;
    customerId:         string | null;
    total:              string;
    refundedAmount:     string;
    cancellationReason: string | null;
  };
  storeSettings: { orderEmailEnabled: boolean; currency: string };
}

@Injectable()
export class OrderCancellationNotificationService {
  private readonly logger = new Logger(OrderCancellationNotificationService.name);

  constructor(
    private readonly prisma:  PrismaService,
    // Reserved for future EmailService configuration (SMTP host, sender address, etc.)
    private readonly config:  ConfigService, // eslint-disable-line @typescript-eslint/no-unused-vars
  ) {}

  // ── INT-CN-1: ORDER_CANCELLED ─────────────────────────────────────────────

  @OnEvent('ORDER_CANCELLED')
  async handleOrderCancelled(payload: Record<string, unknown>): Promise<void> {
    const storeId       = payload['storeId']       as string;
    const orderId       = payload['orderId']       as string;
    const reason        = payload['reason']        as string | undefined;
    const actorId       = payload['actorId']       as string | undefined;
    const paymentAction = payload['paymentAction'] as string | undefined;

    this.logger.log(
      `ORDER_CANCELLED: orderId=${orderId} storeId=${storeId} ` +
      `paymentAction=${paymentAction ?? '-'} actorId=${actorId ?? '-'}`,
    );

    try {
      const ctx = await this.resolveNotificationContext(storeId, orderId, 'ORDER_CANCELLED');
      if (!ctx) return;

      this.logger.log(
        `[ORDER_CANCELLED] Would send email — subject="${ctx.template.subject}" ` +
        `to=${ctx.customer.email} context={{ ` +
        `customerName="${ctx.customer.name}", ` +
        `orderNumber="${ctx.order.orderNumber}", ` +
        `orderStatus="${ctx.order.status}", ` +
        `orderTotal="${ctx.order.total}", ` +
        `refundedAmount="${ctx.order.refundedAmount}", ` +
        `cancellationReason="${ctx.order.cancellationReason ?? ''}", ` +
        `paymentAction="${paymentAction ?? 'N/A'}", ` +
        `currency="${ctx.storeSettings.currency}" }}`,
      );
      // TODO: inject EmailService and send transactional email
    } catch (err: unknown) {
      this.logger.error(
        `ORDER_CANCELLED handler error — storeId=${storeId} orderId=${orderId}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── INT-CN-2: REFUND_FAILED ───────────────────────────────────────────────

  @OnEvent('REFUND_FAILED')
  async handleRefundFailed(payload: Record<string, unknown>): Promise<void> {
    const storeId              = payload['storeId']              as string;
    const orderId              = payload['orderId']              as string;
    const paymentTransactionId = payload['paymentTransactionId'] as string | undefined;
    const refundId             = payload['refundId']             as string | undefined;
    const reason               = payload['reason']               as string | undefined;

    this.logger.log(
      `REFUND_FAILED: orderId=${orderId} storeId=${storeId} ` +
      `paymentTransactionId=${paymentTransactionId ?? '-'} refundId=${refundId ?? '-'}`,
    );

    try {
      const ctx = await this.resolveNotificationContext(storeId, orderId, 'REFUND_FAILED');
      if (!ctx) return;

      this.logger.log(
        `[REFUND_FAILED] Would send email — subject="${ctx.template.subject}" ` +
        `to=${ctx.customer.email} context={{ ` +
        `customerName="${ctx.customer.name}", ` +
        `orderNumber="${ctx.order.orderNumber}", ` +
        `orderStatus="${ctx.order.status}", ` +
        `orderTotal="${ctx.order.total}", ` +
        `refundedAmount="${ctx.order.refundedAmount}", ` +
        `paymentTransactionId="${paymentTransactionId ?? 'N/A'}", ` +
        `refundId="${refundId ?? 'N/A'}", ` +
        `refundFailureReason="${reason ?? 'N/A'}", ` +
        `currency="${ctx.storeSettings.currency}" }}`,
      );
      // TODO: inject EmailService and send transactional email
    } catch (err: unknown) {
      this.logger.error(
        `REFUND_FAILED handler error — storeId=${storeId} orderId=${orderId}: ` +
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
        id:                 true,
        orderNumber:        true,
        status:             true,
        customerId:         true,
        total:              true,
        refundedAmount:     true,
        cancellationReason: true,
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
        id:                 order.id,
        orderNumber:        order.orderNumber,
        status:             String(order.status),
        customerId:         order.customerId,
        total:              String(order.total),
        refundedAmount:     String(order.refundedAmount),
        cancellationReason: order.cancellationReason ?? null,
      },
      storeSettings: {
        orderEmailEnabled: storeSettings.orderEmailEnabled,
        currency:          storeSettings.currency,
      },
    };
  }
}
