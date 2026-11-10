import {
  BadRequestException, ConflictException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import {
  OutboxEventStatus, PaymentStatus, Prisma, VendorNotificationStatus, VendorStatus,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { EmailService, EmailSendResult, maskEmail } from '@/shared/email/email.service';
import { outboxBackoffMs } from '../outbox/outbox-processor.service';

// ---------------------------------------------------------------------------
// Vendor "new order" emails — one per (order, vendor), listing only that
// vendor's lines (ownership = the vendorId frozen on each OrderItem).
//
// Two steps, both on the existing transactional outbox:
//
// 1. fanOut() — called from the ORDER_CREATED handler (so COD, verified online
//    capture and payment recovery all trigger it). In one transaction per
//    vendor it inserts a VendorOrderNotification row (unique per order+vendor —
//    the idempotency key) and a VENDOR_ORDER_EMAIL outbox event. A redelivered
//    ORDER_CREATED hits the unique key and queues nothing.
//
// 2. deliver() — the VENDOR_ORDER_EMAIL handler. It claims the row
//    (PENDING|RETRYING → SENDING, compare-and-swap) and sends once:
//      accepted                      → SENT
//      transient (no SMTP reply/4xx) → RETRYING, then THROWS so the outbox
//                                      processor retries with its backoff
//      permanent (5xx, rejected, not configured, budget exhausted) → FAILED
//    A row left in SENDING (worker died mid-send) is never auto-resent: the
//    email may already have gone out. Owners can resend it explicitly.
//
// Throwing is safe here (unlike the shared log-only handlers): this event has
// a single listener whose every step is guarded by the row's status. The
// listener opts out of @nestjs/event-emitter's default error suppression —
// otherwise the throw is swallowed and the outbox marks the event SENT.
//
// No customer name, contact details, address or payment identifiers are put in
// the email; addresses are masked in logs and in the stored lastError.
// ---------------------------------------------------------------------------

export const VENDOR_ORDER_EMAIL_EVENT = 'VENDOR_ORDER_EMAIL';

/** Send attempts per notification (outbox backoff 30s…32m ≈ 1h in total). */
export const VENDOR_EMAIL_MAX_ATTEMPTS = 8;
/** Outbox headroom over the row's own budget, for stale-PROCESSING recoveries. */
const OUTBOX_MAX_ATTEMPTS = VENDOR_EMAIL_MAX_ATTEMPTS + 2;
/** A PENDING/SENDING row untouched this long is treated as stuck and may be resent manually. */
export const SENDING_STALE_MS = 15 * 60 * 1000;

const COD_GATEWAY = 'cod';
const RETRYABLE = [VendorNotificationStatus.PENDING, VendorNotificationStatus.RETRYING];

export type FanOutOutcome = 'queued' | 'skipped' | 'duplicate';

export class RetryableVendorEmailError extends Error {}

interface VendorLine {
  productName: string;
  variantName: string | null;
  sku:         string;
  quantity:    number;
  unitPrice:   Prisma.Decimal | string | number;
  total:       Prisma.Decimal | string | number;
}

const escapeHtml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Masks any email address in free text (SMTP errors often quote the recipient) and bounds its length. */
export function sanitizeError(message: string): string {
  return message.replace(/[^\s<>()"',;:]+@[^\s<>()"',;:]+/g, (m) => maskEmail(m)).slice(0, 500);
}

/** No SMTP reply (connection/timeout) or a 4xx reply is worth retrying; a 5xx reply is final. */
function isTransient(err: unknown): boolean {
  const code = (err as { responseCode?: unknown })?.responseCode;
  return typeof code === 'number' ? code < 500 : true;
}

function skipReason(vendor: { status: VendorStatus; notifyOnOrder: boolean } | undefined): string | null {
  if (!vendor) return 'Vendor no longer exists';
  if (vendor.status !== VendorStatus.ACTIVE) return 'Vendor is inactive';
  if (!vendor.notifyOnOrder) return 'Vendor has order notifications turned off';
  return null;
}

const NOTIFICATION_SELECT = {
  id: true, orderId: true, vendorId: true, status: true, attempts: true, lastError: true,
  nextRetryAt: true, sentAt: true, createdAt: true, updatedAt: true,
  order: { select: { orderNumber: true } },
} satisfies Prisma.VendorOrderNotificationSelect;

@Injectable()
export class VendorOrderNotificationService {
  private readonly logger = new Logger(VendorOrderNotificationService.name);
  private readonly maxBackoffMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email:  EmailService,
    config: ConfigService,
  ) {
    this.maxBackoffMinutes = config.get<number>('OUTBOX_MAX_BACKOFF_MINUTES', 60);
  }

  // ── Step 1: queue one notification per vendor on the order ─────────────────

  async fanOut(storeId: string, orderId: string): Promise<Array<{ vendorId: string; outcome: FanOutOutcome }>> {
    const order = await this.prisma.order.findFirst({
      where:  { id: orderId, storeId },
      select: { id: true, items: { where: { vendorId: { not: null } }, select: { vendorId: true } } },
    });
    if (!order) {
      this.logger.warn(`Vendor fan-out: order ${orderId} not found in store ${storeId}`);
      return [];
    }
    const vendorIds = [...new Set(order.items.map((i) => i.vendorId!))];
    if (vendorIds.length === 0) return []; // store's own stock only

    const vendors = await this.prisma.vendor.findMany({
      where:  { id: { in: vendorIds }, storeId },
      select: { id: true, status: true, notifyOnOrder: true },
    });
    const vendorById = new Map(vendors.map((v) => [v.id, v]));

    const results: Array<{ vendorId: string; outcome: FanOutOutcome }> = [];
    for (const vendorId of vendorIds) {
      const reason = skipReason(vendorById.get(vendorId));
      try {
        await this.prisma.$transaction(async (tx) => {
          const row = await tx.vendorOrderNotification.create({
            data: {
              storeId, orderId, vendorId,
              status:    reason ? VendorNotificationStatus.SKIPPED : VendorNotificationStatus.PENDING,
              lastError: reason,
            },
            select: { id: true },
          });
          if (!reason) await this.enqueue(tx, storeId, row.id);
        });
        results.push({ vendorId, outcome: reason ? 'skipped' : 'queued' });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          results.push({ vendorId, outcome: 'duplicate' }); // redelivered ORDER_CREATED
          continue;
        }
        throw err; // ORDER_CREATED is retried by the outbox; rows already created stay deduped
      }
    }
    return results;
  }

  // ── Step 2: deliver one notification (outbox handler) ───────────────────────

  @OnEvent(VENDOR_ORDER_EMAIL_EVENT, { suppressErrors: false })
  async deliver(payload: Record<string, unknown>): Promise<VendorNotificationStatus | 'noop'> {
    const storeId        = payload['storeId'] as string;
    const notificationId = payload['notificationId'] as string;
    if (!storeId || !notificationId) return 'noop';

    const row = await this.prisma.vendorOrderNotification.findFirst({
      where:  { id: notificationId, storeId },
      select: { id: true, orderId: true, vendorId: true, status: true, attempts: true },
    });
    if (!row) {
      this.logger.warn(`Vendor email: notification ${notificationId} not found in store ${storeId}`);
      return 'noop';
    }
    // SENT / FAILED / SKIPPED are final; SENDING belongs to another worker or an abandoned send.
    if (!RETRYABLE.includes(row.status as typeof RETRYABLE[number])) return 'noop';

    const vendor = await this.prisma.vendor.findFirst({
      where:  { id: row.vendorId, storeId },
      select: { id: true, name: true, email: true, status: true, notifyOnOrder: true },
    });
    const reason = skipReason(vendor ?? undefined);
    if (reason) return this.finish(row.id, VendorNotificationStatus.SKIPPED, { lastError: reason }, RETRYABLE);

    const claimed = await this.prisma.vendorOrderNotification.updateMany({
      where: { id: row.id, status: { in: RETRYABLE } },
      data:  { status: VendorNotificationStatus.SENDING, attempts: { increment: 1 }, nextRetryAt: null },
    });
    if (claimed.count === 0) return 'noop'; // another worker got it first
    const attempt = row.attempts + 1;

    let result: EmailSendResult;
    let orderNumber = row.orderId;
    try {
      const order = await this.prisma.order.findFirst({
        where:  { id: row.orderId, storeId },
        select: {
          orderNumber: true, paymentMethod: true, paymentStatus: true,
          items: {
            where:  { vendorId: row.vendorId },
            select: { productName: true, variantName: true, sku: true, quantity: true, unitPrice: true, total: true },
          },
        },
      });
      if (!order || order.items.length === 0) {
        return this.finish(row.id, VendorNotificationStatus.SKIPPED, { lastError: 'No items for this vendor on the order' });
      }
      orderNumber = order.orderNumber;
      const settings = await this.prisma.storeSettings.findFirst({ where: { storeId }, select: { currency: true } });
      const message = this.render(
        vendor!.name, order.orderNumber, order.items, settings?.currency ?? 'INR',
        this.describePayment(order.paymentMethod, order.paymentStatus),
      );
      result = await this.email.send({ to: vendor!.email, ...message });
    } catch (err) {
      return this.handleError(row.id, orderNumber, attempt, err);
    }

    const who = maskEmail(vendor!.email);
    if (result.status === 'accepted') {
      this.logger.log(
        `Vendor email for ${orderNumber} accepted by SMTP server (vendor=${vendor!.id} to=${who} ` +
        `attempt=${attempt} messageId=${result.messageId})`,
      );
      return this.finish(row.id, VendorNotificationStatus.SENT, {
        sentAt: new Date(), messageId: result.messageId.slice(0, 255), lastError: null,
      });
    }
    const lastError = result.status === 'not_configured'
      ? 'SMTP is not configured'
      : sanitizeError(`Recipient rejected: ${result.reason}`);
    this.logger.error(`Vendor email for ${orderNumber} NOT sent (vendor=${vendor!.id} to=${who}): ${lastError}`);
    return this.finish(row.id, VendorNotificationStatus.FAILED, { lastError });
  }

  // ── Manual resend (store owner) ────────────────────────────────────────────

  async resend(storeId: string, notificationId: string) {
    const row = await this.prisma.vendorOrderNotification.findFirst({
      where:  { id: notificationId, storeId },
      select: { id: true, vendorId: true, status: true, updatedAt: true },
    });
    if (!row) throw new NotFoundException('Vendor notification not found');
    if (row.status === VendorNotificationStatus.SENT) {
      throw new ConflictException('This vendor email was already delivered');
    }
    const inFlight = row.status === VendorNotificationStatus.PENDING || row.status === VendorNotificationStatus.SENDING;
    if (inFlight && Date.now() - row.updatedAt.getTime() < SENDING_STALE_MS) {
      throw new ConflictException(
        row.status === VendorNotificationStatus.PENDING
          ? 'This vendor email is already queued'
          : 'This vendor email is being sent right now',
      );
    }
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: row.vendorId, storeId }, select: { status: true, notifyOnOrder: true },
    });
    const reason = skipReason(vendor ?? undefined);
    if (reason) throw new BadRequestException(`Cannot resend: ${reason.toLowerCase()}`);

    await this.prisma.$transaction(async (tx) => {
      // Compare-and-swap on updatedAt: two concurrent resends cannot both queue.
      const reset = await tx.vendorOrderNotification.updateMany({
        where: { id: row.id, updatedAt: row.updatedAt },
        data:  { status: VendorNotificationStatus.PENDING, attempts: 0, lastError: null, nextRetryAt: null },
      });
      if (reset.count === 0) throw new ConflictException('This vendor email changed meanwhile — refresh and try again');
      await this.enqueue(tx, storeId, row.id);
    });
    this.logger.log(`Vendor email ${row.id} re-queued by manual resend (vendor=${row.vendorId})`);
    return this.prisma.vendorOrderNotification.findFirst({ where: { id: row.id, storeId }, select: NOTIFICATION_SELECT });
  }

  async list(
    storeId: string,
    query: { orderId?: string; vendorId?: string; status?: VendorNotificationStatus; page?: number; limit?: number },
  ) {
    const { orderId, vendorId, status, page = 1, limit = 50 } = query;
    const where: Prisma.VendorOrderNotificationWhereInput = { storeId };
    if (orderId)  where.orderId  = orderId;
    if (vendorId) where.vendorId = vendorId;
    if (status)   where.status   = status;
    const [items, total] = await Promise.all([
      this.prisma.vendorOrderNotification.findMany({
        where, select: NOTIFICATION_SELECT, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.vendorOrderNotification.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async enqueue(tx: Prisma.TransactionClient, storeId: string, notificationId: string): Promise<void> {
    // Not OutboxHelperService.upsertOutboxEvent: a manual resend must queue a new
    // event even though an earlier one for this notification is SENT/DEAD, and
    // the retry budget differs from the default. Dedup is the row's status.
    await tx.outboxEvent.create({
      data: {
        storeId,
        eventType:     VENDOR_ORDER_EMAIL_EVENT,
        aggregateId:   notificationId,
        aggregateType: 'VendorOrderNotification',
        payload:       { storeId, notificationId },
        status:        OutboxEventStatus.PENDING,
        maxAttempts:   OUTBOX_MAX_ATTEMPTS,
      },
    });
  }

  private async handleError(
    id: string, orderNumber: string, attempt: number, err: unknown,
  ): Promise<VendorNotificationStatus> {
    const lastError = sanitizeError(err instanceof Error ? err.message : String(err));
    if (isTransient(err) && attempt < VENDOR_EMAIL_MAX_ATTEMPTS) {
      const nextRetryAt = new Date(Date.now() + outboxBackoffMs(attempt, this.maxBackoffMinutes));
      await this.finish(id, VendorNotificationStatus.RETRYING, { lastError, nextRetryAt });
      this.logger.warn(
        `Vendor email for ${orderNumber} attempt ${attempt}/${VENDOR_EMAIL_MAX_ATTEMPTS} failed (${lastError}) — ` +
        `retry at ${nextRetryAt.toISOString()}`,
      );
      throw new RetryableVendorEmailError(lastError); // → outbox retries this event
    }
    this.logger.error(`Vendor email for ${orderNumber} FAILED after attempt ${attempt}: ${lastError}`);
    return this.finish(id, VendorNotificationStatus.FAILED, { lastError });
  }

  /** Writes a final/next state; only from SENDING unless `from` says otherwise. */
  private async finish(
    id: string,
    status: VendorNotificationStatus,
    data: Prisma.VendorOrderNotificationUpdateManyMutationInput,
    from: VendorNotificationStatus[] = [VendorNotificationStatus.SENDING],
  ): Promise<VendorNotificationStatus> {
    await this.prisma.vendorOrderNotification.updateMany({
      where: { id, status: { in: from } },
      data:  { ...data, status },
    });
    return status;
  }

  /**
   * COD orders are confirmed but unpaid. Online orders only exist after the
   * gateway capture was verified (webhook / capture API), which is what sets
   * paymentStatus PAID — anything else is reported as not yet confirmed.
   */
  private describePayment(paymentMethod: string | null, paymentStatus: PaymentStatus): string {
    if (paymentMethod === COD_GATEWAY) {
      return paymentStatus === PaymentStatus.PAID
        ? 'Cash on Delivery — payment received'
        : 'Cash on Delivery — payment has NOT been received yet. It is due on delivery.';
    }
    return paymentStatus === PaymentStatus.PAID
      ? 'Paid online (payment confirmed)'
      : 'Online payment — not yet confirmed';
  }

  private render(
    vendorName:  string,
    orderNumber: string,
    lines:       VendorLine[],
    currency:    string,
    payment:     string,
  ): { subject: string; html: string; text: string } {
    const money = (v: VendorLine['total']) => `${currency} ${Number(v).toFixed(2)}`;
    const label = (l: VendorLine) => (l.variantName ? `${l.productName} (${l.variantName})` : l.productName);
    const subtotal = lines.reduce((sum, l) => sum + Number(l.total), 0);
    const units    = lines.reduce((sum, l) => sum + l.quantity, 0);

    const text =
      `Hi ${vendorName},\n\nYou have a new order: ${orderNumber}.\n\n` +
      lines.map((l) => `- ${label(l)} [SKU ${l.sku}] x ${l.quantity} @ ${money(l.unitPrice)} = ${money(l.total)}`).join('\n') +
      `\n\nYour items: ${units} unit(s), ${money(subtotal)}\nPayment: ${payment}\n\n` +
      `Please prepare these items for dispatch.\n`;

    const rows = lines.map((l) =>
      `<tr><td>${escapeHtml(label(l))}</td><td>${escapeHtml(l.sku)}</td>` +
      `<td align="right">${l.quantity}</td><td align="right">${escapeHtml(money(l.unitPrice))}</td>` +
      `<td align="right">${escapeHtml(money(l.total))}</td></tr>`,
    ).join('');

    return {
      subject: `New order ${orderNumber} — ${units} item(s) to fulfil`,
      html:
        `<p>Hi ${escapeHtml(vendorName)},</p>` +
        `<p>You have a new order: <strong>${escapeHtml(orderNumber)}</strong>.</p>` +
        `<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse">` +
        `<thead><tr><th align="left">Item</th><th align="left">SKU</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>` +
        `<tbody>${rows}</tbody></table>` +
        `<p>Your items: ${units} unit(s), ${escapeHtml(money(subtotal))}<br>Payment: <strong>${escapeHtml(payment)}</strong></p>` +
        `<p>Please prepare these items for dispatch.</p>`,
      text,
    };
  }
}
