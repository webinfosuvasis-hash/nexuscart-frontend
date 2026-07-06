import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Customer-auth notification event listeners (FI-1 IM-7)
//
// Mirrors, deliberately and exactly, the architecture already established by
// PaymentOrchestratorNotificationService / FulfillmentNotificationService /
// OrderCancellationNotificationService: handlers are READ-ONLY (no writes,
// no transactions, no Redis, no locks), MUST NOT throw (a thrown exception
// would propagate through EventEmitter2.emitAsync() back to whatever emitted
// the event — incorrect for a notification-delivery failure — so every
// handler body is wrapped in try/catch and every failure is logged, never
// thrown), and log what would be sent with EmailService integration
// deferred, exactly as those three services already do.
//
// Difference from the order-centric services above: these events are
// customer-centric, not order-centric, so notification context resolves
// directly from (storeId, customerId) — there is no Order to traverse and
// no "guest" branch, since a customer-auth event only ever fires for a real,
// already-resolved customer record.
//
// Nothing in CustomerAuthService emits these events yet — CUSTOMER_REGISTERED,
// CUSTOMER_EMAIL_VERIFICATION_REQUESTED, and CUSTOMER_PASSWORD_RESET_REQUESTED
// wiring the actual `upsertOutboxEvent` calls was explicitly out of scope for
// the increments that built register()/forgotPassword() (business logic
// already completed, not touched here). These handlers are ready to receive
// those events once a later increment adds the emit calls.
// ---------------------------------------------------------------------------

interface NotificationContext {
  customer:      { id: string; email: string; name: string };
  template:      { subject: string; htmlContent: string; type: string };
  storeSettings: { orderEmailEnabled: boolean; currency: string };
}

@Injectable()
export class CustomerAuthNotificationService {
  private readonly logger = new Logger(CustomerAuthNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    // Reserved for future EmailService configuration (SMTP host, sender address, etc.)
    private readonly config: ConfigService, // eslint-disable-line @typescript-eslint/no-unused-vars
  ) {}

  // ── CUSTOMER_REGISTERED — registration/welcome email ──────────────────────

  @OnEvent('CUSTOMER_REGISTERED')
  async handleCustomerRegistered(payload: Record<string, unknown>): Promise<void> {
    const storeId    = payload['storeId']    as string;
    const customerId = payload['customerId'] as string;

    this.logger.log(`CUSTOMER_REGISTERED: customerId=${customerId} storeId=${storeId}`);

    try {
      const ctx = await this.resolveNotificationContext(storeId, customerId, 'CUSTOMER_REGISTERED');
      if (!ctx) return;

      this.logger.log(
        `[CUSTOMER_REGISTERED] Would send email — subject="${ctx.template.subject}" ` +
        `to=${ctx.customer.email} context={{ customerName="${ctx.customer.name}" }}`,
      );
      // TODO: inject EmailService and send transactional email
    } catch (err: unknown) {
      this.logger.error(
        `CUSTOMER_REGISTERED handler error — storeId=${storeId} customerId=${customerId}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── CUSTOMER_EMAIL_VERIFICATION_REQUESTED — verify-your-email email ──────

  @OnEvent('CUSTOMER_EMAIL_VERIFICATION_REQUESTED')
  async handleEmailVerificationRequested(payload: Record<string, unknown>): Promise<void> {
    const storeId    = payload['storeId']    as string;
    const customerId = payload['customerId'] as string;

    this.logger.log(`CUSTOMER_EMAIL_VERIFICATION_REQUESTED: customerId=${customerId} storeId=${storeId}`);

    try {
      const ctx = await this.resolveNotificationContext(
        storeId, customerId, 'CUSTOMER_EMAIL_VERIFICATION_REQUESTED',
      );
      if (!ctx) return;

      // The raw verification token (needed to build the link) travels only
      // in the event payload, never in a log line — redacted here exactly
      // as it would be redacted from the eventual real email-send call's logs.
      this.logger.log(
        `[CUSTOMER_EMAIL_VERIFICATION_REQUESTED] Would send email — subject="${ctx.template.subject}" ` +
        `to=${ctx.customer.email} context={{ customerName="${ctx.customer.name}", verificationToken="[REDACTED]" }}`,
      );
      // TODO: inject EmailService; build the verification link from
      // payload.verificationToken (never log its raw value)
    } catch (err: unknown) {
      this.logger.error(
        `CUSTOMER_EMAIL_VERIFICATION_REQUESTED handler error — storeId=${storeId} customerId=${customerId}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── CUSTOMER_PASSWORD_RESET_REQUESTED — reset-your-password email ────────

  @OnEvent('CUSTOMER_PASSWORD_RESET_REQUESTED')
  async handlePasswordResetRequested(payload: Record<string, unknown>): Promise<void> {
    const storeId    = payload['storeId']    as string;
    const customerId = payload['customerId'] as string;

    this.logger.log(`CUSTOMER_PASSWORD_RESET_REQUESTED: customerId=${customerId} storeId=${storeId}`);

    try {
      const ctx = await this.resolveNotificationContext(
        storeId, customerId, 'CUSTOMER_PASSWORD_RESET_REQUESTED',
      );
      if (!ctx) return;

      // Same redaction rationale as the verification handler above — a
      // password-reset token is a live credential; it must never appear in
      // a log line, even one that's only ever describing "what would be sent".
      this.logger.log(
        `[CUSTOMER_PASSWORD_RESET_REQUESTED] Would send email — subject="${ctx.template.subject}" ` +
        `to=${ctx.customer.email} context={{ customerName="${ctx.customer.name}", resetToken="[REDACTED]" }}`,
      );
      // TODO: inject EmailService; build the reset link from
      // payload.resetToken (never log its raw value)
    } catch (err: unknown) {
      this.logger.error(
        `CUSTOMER_PASSWORD_RESET_REQUESTED handler error — storeId=${storeId} customerId=${customerId}: ` +
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
   * Every query is scoped to storeId (multi-tenant isolation), matching the
   * identical contract already used by the other three notification services.
   *
   * Reuses StoreSettings.orderEmailEnabled as the gating flag — the schema
   * has no separate "customer/auth email enabled" toggle, and adding one
   * is out of scope for this increment (no schema changes here).
   */
  private async resolveNotificationContext(
    storeId:           string,
    customerId:        string,
    emailTemplateType: string,
  ): Promise<NotificationContext | null> {

    const storeSettings = await this.prisma.storeSettings.findFirst({
      where:  { storeId },
      select: { orderEmailEnabled: true, currency: true },
    });

    if (!storeSettings) {
      this.logger.debug(`resolveNotificationContext: no StoreSettings for storeId=${storeId}`);
      return null;
    }

    if (!storeSettings.orderEmailEnabled) {
      this.logger.debug(
        `resolveNotificationContext: orderEmailEnabled=false for storeId=${storeId} — skipping`,
      );
      return null;
    }

    const customer = await this.prisma.customer.findFirst({
      where:  { id: customerId, storeId },
      select: { id: true, email: true, name: true },
    });

    if (!customer || !customer.email) {
      this.logger.warn(
        `resolveNotificationContext: Customer not found or has no email — ` +
        `customerId=${customerId} storeId=${storeId}`,
      );
      return null;
    }

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
      storeSettings: {
        orderEmailEnabled: storeSettings.orderEmailEnabled,
        currency:          storeSettings.currency,
      },
    };
  }
}
