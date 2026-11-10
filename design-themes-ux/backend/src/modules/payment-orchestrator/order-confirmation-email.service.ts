import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { EmailService, EmailSendResult, maskEmail } from '@/shared/email/email.service';

// ---------------------------------------------------------------------------
// Order confirmation email — sent once per order, to the account email or,
// for a guest order, the email captured on the checkout's shipping address.
//
// ORDER_CREATED reaches us through the outbox (at-least-once), so the send is
// claimed with an IdempotencyRecord first: a duplicate event finds the claim
// and does nothing. If the send does not end in an SMTP "accepted", the claim
// is removed so a later redelivery or a manual resend can try again.
//
// A merchant template (EmailTemplate type ORDER_CREATED, active) is used when
// present; these placeholders are filled in, HTML-escaped:
//   {{customerName}} {{orderNumber}} {{orderTotal}} {{currency}} {{paymentMethod}}
// Otherwise a plain built-in confirmation is sent.
// ---------------------------------------------------------------------------

export type OrderConfirmationOutcome =
  | 'accepted' | 'duplicate' | 'disabled' | 'no_recipient' | 'not_configured' | 'failed';

const CLAIM_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const escapeHtml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const PAYMENT_LABELS: Record<string, string> = { cod: 'Cash on Delivery', razorpay: 'Online payment', stripe: 'Card payment' };

@Injectable()
export class OrderConfirmationEmailService {
  private readonly logger = new Logger(OrderConfirmationEmailService.name);

  /** Backoff between send attempts for transient SMTP errors; tests shorten it. */
  retryDelaysMs = [2_000, 8_000];

  constructor(
    private readonly prisma: PrismaService,
    private readonly email:  EmailService,
  ) {}

  async send(storeId: string, orderId: string): Promise<OrderConfirmationOutcome> {
    const settings = await this.prisma.storeSettings.findFirst({
      where:  { storeId },
      select: { orderEmailEnabled: true, currency: true },
    });
    if (!settings?.orderEmailEnabled) return 'disabled';

    const order = await this.prisma.order.findFirst({
      where:  { id: orderId, storeId },
      select: {
        id: true, orderNumber: true, total: true, paymentMethod: true, customerId: true, shippingAddress: true,
      },
    });
    if (!order) {
      this.logger.warn(`Order confirmation: order ${orderId} not found in store ${storeId}`);
      return 'no_recipient';
    }

    const recipient = await this.resolveRecipient(storeId, order);
    if (!recipient) {
      this.logger.warn(`Order confirmation: no email address for order ${order.orderNumber} — not sent`);
      return 'no_recipient';
    }

    const claimKey = `email:order-confirmation:${order.id}`;
    try {
      await this.prisma.idempotencyRecord.create({
        data: { key: claimKey, storeId, expiresAt: new Date(Date.now() + CLAIM_TTL_MS) },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.log(`Order confirmation for ${order.orderNumber} already sent or in progress — duplicate event skipped`);
        return 'duplicate';
      }
      throw err;
    }

    const message = await this.render(storeId, {
      customerName:  recipient.name,
      orderNumber:   order.orderNumber,
      orderTotal:    Number(order.total).toFixed(2),
      currency:      settings.currency,
      paymentMethod: PAYMENT_LABELS[order.paymentMethod ?? ''] ?? (order.paymentMethod ?? ''),
    });

    const result = await this.sendWithRetry({ to: recipient.email, ...message });
    const who = maskEmail(recipient.email);

    if (result.status === 'accepted') {
      this.logger.log(
        `Order confirmation for ${order.orderNumber} accepted by SMTP server (to=${who} messageId=${result.messageId})`,
      );
      return 'accepted';
    }

    // Not accepted — release the claim so it can be sent later.
    await this.prisma.idempotencyRecord.deleteMany({ where: { key: claimKey } });
    if (result.status === 'not_configured') {
      this.logger.warn(`Order confirmation for ${order.orderNumber} NOT sent: SMTP is not configured`);
      return 'not_configured';
    }
    this.logger.error(`Order confirmation for ${order.orderNumber} NOT sent (to=${who}): ${result.reason}`);
    return 'failed';
  }

  private async sendWithRetry(message: { to: string; subject: string; html: string; text: string }): Promise<EmailSendResult> {
    let lastError = 'unknown error';
    for (let attempt = 0; attempt <= this.retryDelaysMs.length; attempt++) {
      try {
        return await this.email.send(message);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        const delay = this.retryDelaysMs[attempt];
        if (delay === undefined) break;
        this.logger.warn(`Order confirmation send attempt ${attempt + 1} failed (${lastError}) — retrying`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    return { status: 'rejected', reason: `SMTP error after ${this.retryDelaysMs.length + 1} attempts: ${lastError}` };
  }

  private async resolveRecipient(
    storeId: string,
    order: { customerId: string | null; shippingAddress: string | null },
  ): Promise<{ email: string; name: string } | null> {
    if (order.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where:  { id: order.customerId, storeId },
        select: { email: true, name: true },
      });
      return customer?.email ? { email: customer.email, name: customer.name } : null;
    }
    // Guest order: the address snapshot taken at checkout carries the guest's email.
    try {
      const addr = order.shippingAddress ? JSON.parse(order.shippingAddress) as Record<string, unknown> : null;
      const email = typeof addr?.email === 'string' ? addr.email : '';
      if (!email) return null;
      const name = [addr?.firstName, addr?.lastName].filter((p) => typeof p === 'string' && p).join(' ');
      return { email, name: name || 'there' };
    } catch {
      return null;
    }
  }

  private async render(storeId: string, vars: Record<string, string>): Promise<{ subject: string; html: string; text: string }> {
    const template = await this.prisma.emailTemplate.findFirst({
      where:  { storeId, type: 'ORDER_CREATED', isActive: true },
      select: { subject: true, htmlContent: true },
    });
    const fill = (tpl: string, escape: boolean) =>
      tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (k in vars ? (escape ? escapeHtml(vars[k]) : vars[k]) : m));

    const text =
      `Hi ${vars.customerName},\n\nThank you for your order! Your order number is ${vars.orderNumber}.\n` +
      `Order total: ${vars.currency} ${vars.orderTotal}\nPayment: ${vars.paymentMethod}\n\n` +
      `Please keep this email — quote your order number if you contact us about this order.\n`;

    if (template) {
      return { subject: fill(template.subject, false), html: fill(template.htmlContent, true), text };
    }
    const e = (k: string) => escapeHtml(vars[k]);
    return {
      subject: `Order confirmed — ${vars.orderNumber}`,
      html:
        `<p>Hi ${e('customerName')},</p>` +
        `<p>Thank you for your order! Your order number is <strong>${e('orderNumber')}</strong>.</p>` +
        `<p>Order total: ${e('currency')} ${e('orderTotal')}<br>Payment: ${e('paymentMethod')}</p>` +
        `<p>Please keep this email — quote your order number if you contact us about this order.</p>`,
      text,
    };
  }
}
