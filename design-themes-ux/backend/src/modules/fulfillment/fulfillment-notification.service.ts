import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Fulfillment notification event listeners (INT-FN-1 … INT-FN-5)
//
// The OutboxProcessorService emits these events after each outbox record is
// persisted and ready to dispatch.  These handlers are READ-ONLY: they never
// modify Order, Shipment, Outbox, Payment, or Inventory state, never acquire
// Redis locks, and never open database transactions.
//
// Handlers MUST NOT throw.  A thrown exception would propagate through
// EventEmitter2.emitAsync() back to OutboxProcessorService, which would mark
// the outbox event as FAILED and schedule a retry — incorrect behaviour for a
// notification-delivery failure.  All errors are caught and logged.
//
// EmailService integration is deferred: each handler resolves the full
// notification context and logs what would be sent.  Wire EmailService here
// once a real SMTP / transactional-email provider is added.
// ---------------------------------------------------------------------------

interface NotificationContext {
  customer:      { id: string; email: string; name: string };
  template:      { subject: string; htmlContent: string; type: string };
  order:         { id: string; orderNumber: string; status: string; customerId: string | null };
  storeSettings: { orderEmailEnabled: boolean; currency: string };
}

@Injectable()
export class FulfillmentNotificationService {
  private readonly logger = new Logger(FulfillmentNotificationService.name);

  constructor(
    private readonly prisma:  PrismaService,
    // Reserved for future EmailService configuration (SMTP host, sender address, etc.)
    private readonly config:  ConfigService, // eslint-disable-line @typescript-eslint/no-unused-vars
  ) {}

  // ── INT-FN-1: SHIPMENT_CREATED ────────────────────────────────────────────

  @OnEvent('SHIPMENT_CREATED')
  async handleShipmentCreated(payload: Record<string, unknown>): Promise<void> {
    const storeId        = payload['storeId']        as string;
    const orderId        = payload['orderId']        as string;
    const trackingNumber = payload['trackingNumber'] as string | undefined;
    const carrier        = payload['carrier']        as string | undefined;
    const carrierUrl     = payload['carrierUrl']     as string | undefined;

    this.logger.log(
      `SHIPMENT_CREATED: orderId=${orderId} storeId=${storeId} carrier=${carrier ?? '-'}`,
    );

    try {
      const ctx = await this.resolveNotificationContext(storeId, orderId, 'SHIPMENT_CREATED');
      if (!ctx) return;

      this.logger.log(
        `[SHIPMENT_CREATED] Would send email — subject="${ctx.template.subject}" ` +
        `to=${ctx.customer.email} context={{ ` +
        `customerName="${ctx.customer.name}", ` +
        `orderNumber="${ctx.order.orderNumber}", ` +
        `trackingNumber="${trackingNumber ?? ''}", ` +
        `carrier="${carrier ?? ''}", ` +
        `carrierUrl="${carrierUrl ?? ''}", ` +
        `orderStatus="${ctx.order.status}", ` +
        `shipmentStatus="SHIPPED" }}`,
      );
      // TODO: inject EmailService and call sendTransactional({ template, recipient, context })
    } catch (err: unknown) {
      this.logger.error(
        `SHIPMENT_CREATED handler error for orderId=${orderId}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── INT-FN-2: ORDER_SHIPPED ───────────────────────────────────────────────

  @OnEvent('ORDER_SHIPPED')
  async handleOrderShipped(payload: Record<string, unknown>): Promise<void> {
    const storeId    = payload['storeId']    as string;
    const orderId    = payload['orderId']    as string;
    const shipmentId = payload['shipmentId'] as string;

    this.logger.log(
      `ORDER_SHIPPED: orderId=${orderId} storeId=${storeId} shipmentId=${shipmentId}`,
    );

    try {
      const ctx = await this.resolveNotificationContext(storeId, orderId, 'ORDER_SHIPPED');
      if (!ctx) return;

      this.logger.log(
        `[ORDER_SHIPPED] Would send email — subject="${ctx.template.subject}" ` +
        `to=${ctx.customer.email} context={{ ` +
        `customerName="${ctx.customer.name}", ` +
        `orderNumber="${ctx.order.orderNumber}", ` +
        `orderStatus="${ctx.order.status}", ` +
        `shipmentStatus="SHIPPED" }}`,
      );
      // TODO: inject EmailService and call sendTransactional({ template, recipient, context })
    } catch (err: unknown) {
      this.logger.error(
        `ORDER_SHIPPED handler error for orderId=${orderId}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── INT-FN-3: SHIPMENT_UPDATED ────────────────────────────────────────────

  @OnEvent('SHIPMENT_UPDATED')
  async handleShipmentUpdated(payload: Record<string, unknown>): Promise<void> {
    const storeId        = payload['storeId']        as string;
    const orderId        = payload['orderId']        as string;
    const trackingNumber = payload['trackingNumber'] as string | undefined;
    const carrier        = payload['carrier']        as string | undefined;
    const carrierUrl     = payload['carrierUrl']     as string | undefined;

    this.logger.log(
      `SHIPMENT_UPDATED: orderId=${orderId} storeId=${storeId} carrier=${carrier ?? '-'}`,
    );

    try {
      const ctx = await this.resolveNotificationContext(storeId, orderId, 'SHIPMENT_UPDATED');
      if (!ctx) return;

      this.logger.log(
        `[SHIPMENT_UPDATED] Would send email — subject="${ctx.template.subject}" ` +
        `to=${ctx.customer.email} context={{ ` +
        `customerName="${ctx.customer.name}", ` +
        `orderNumber="${ctx.order.orderNumber}", ` +
        `trackingNumber="${trackingNumber ?? ''}", ` +
        `carrier="${carrier ?? ''}", ` +
        `carrierUrl="${carrierUrl ?? ''}", ` +
        `orderStatus="${ctx.order.status}", ` +
        `shipmentStatus="SHIPPED" }}`,
      );
      // TODO: inject EmailService and call sendTransactional({ template, recipient, context })
    } catch (err: unknown) {
      this.logger.error(
        `SHIPMENT_UPDATED handler error for orderId=${orderId}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── INT-FN-4: SHIPMENT_DELIVERED ──────────────────────────────────────────

  @OnEvent('SHIPMENT_DELIVERED')
  async handleShipmentDelivered(payload: Record<string, unknown>): Promise<void> {
    const storeId     = payload['storeId']     as string;
    const orderId     = payload['orderId']     as string;
    const shipmentId  = payload['shipmentId']  as string;
    const deliveredAt = payload['deliveredAt'] as string | undefined;

    this.logger.log(
      `SHIPMENT_DELIVERED: orderId=${orderId} storeId=${storeId} shipmentId=${shipmentId}`,
    );

    try {
      const ctx = await this.resolveNotificationContext(storeId, orderId, 'SHIPMENT_DELIVERED');
      if (!ctx) return;

      this.logger.log(
        `[SHIPMENT_DELIVERED] Would send email — subject="${ctx.template.subject}" ` +
        `to=${ctx.customer.email} context={{ ` +
        `customerName="${ctx.customer.name}", ` +
        `orderNumber="${ctx.order.orderNumber}", ` +
        `deliveredAt="${deliveredAt ?? ''}", ` +
        `orderStatus="${ctx.order.status}", ` +
        `shipmentStatus="DELIVERED" }}`,
      );
      // TODO: inject EmailService and call sendTransactional({ template, recipient, context })
    } catch (err: unknown) {
      this.logger.error(
        `SHIPMENT_DELIVERED handler error for orderId=${orderId}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── INT-FN-5: ORDER_DELIVERED ─────────────────────────────────────────────

  @OnEvent('ORDER_DELIVERED')
  async handleOrderDelivered(payload: Record<string, unknown>): Promise<void> {
    const storeId    = payload['storeId']    as string;
    const orderId    = payload['orderId']    as string;
    const shipmentId = payload['shipmentId'] as string;

    this.logger.log(
      `ORDER_DELIVERED: orderId=${orderId} storeId=${storeId} shipmentId=${shipmentId}`,
    );

    try {
      const ctx = await this.resolveNotificationContext(storeId, orderId, 'ORDER_DELIVERED');
      if (!ctx) return;

      this.logger.log(
        `[ORDER_DELIVERED] Would send email — subject="${ctx.template.subject}" ` +
        `to=${ctx.customer.email} context={{ ` +
        `customerName="${ctx.customer.name}", ` +
        `orderNumber="${ctx.order.orderNumber}", ` +
        `orderStatus="${ctx.order.status}", ` +
        `shipmentStatus="DELIVERED" }}`,
      );
      // TODO: inject EmailService and call sendTransactional({ template, recipient, context })
    } catch (err: unknown) {
      this.logger.error(
        `ORDER_DELIVERED handler error for orderId=${orderId}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── Private helper ─────────────────────────────────────────────────────────

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
      select: { id: true, orderNumber: true, status: true, customerId: true },
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
        id:          order.id,
        orderNumber: order.orderNumber,
        status:      String(order.status),
        customerId:  order.customerId,
      },
      storeSettings: {
        orderEmailEnabled: storeSettings.orderEmailEnabled,
        currency:          storeSettings.currency,
      },
    };
  }
}
