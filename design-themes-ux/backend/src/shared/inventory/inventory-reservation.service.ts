import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InventoryReservationStatus, MovementType, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Checkout stock holds.
//
// Stock of record is Product.stock (or ProductVariant.stock for a variant
// line) — the same fields the admin, storefront, cart and checkout validation
// read, with StockMovement as their ledger. A hold *removes* units from that
// stock at payment time with a single conditional UPDATE per line
// (`stock >= qty`), inside one transaction, so two shoppers can never both
// take the last unit: the loser's UPDATE matches no row and its whole
// transaction rolls back.
//
// Lifecycle of an InventoryReservation (one per payment attempt; its
// `tentativeOrderId` is the checkout session id):
//   RESERVED  — units taken from stock, payment pending
//   COMMITTED — order created; units stay taken
//   EXPIRED   — hold lapsed / payment abandoned; units returned
//   RELEASED  — checkout cancelled, or a committed order cancelled; units returned
//
// Products with trackInventory=false are never held.
// ---------------------------------------------------------------------------

export interface StockLine {
  productId: string;
  variantId: string | null;
  quantity:  number;
}

export class InsufficientStockException extends ConflictException {
  constructor(public readonly productIds: string[]) {
    super({
      error:      'INSUFFICIENT_STOCK',
      message:    'Some items in your bag are no longer available in the requested quantity. Please review your bag.',
      productIds,
    });
  }
}

type Db = Prisma.TransactionClient;

export const stockLineKey = (productId: string, variantId: string | null | undefined) => `${productId}:${variantId ?? ''}`;
const lineKey = stockLineKey;

@Injectable()
export class InventoryReservationService {
  private readonly logger = new Logger(InventoryReservationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Takes the lines out of stock for this payment attempt. Idempotent per
   * payment: a live (RESERVED/COMMITTED) hold is left as-is, a lapsed one is
   * re-taken. Throws InsufficientStockException (409) — with nothing taken —
   * when any line can't be covered.
   */
  async reserveForPayment(params: {
    storeId:              string;
    checkoutId:           string;
    paymentTransactionId: string;
    lines:                StockLine[];
    expiresAt:            Date;
  }): Promise<void> {
    const { storeId, checkoutId, paymentTransactionId, expiresAt } = params;

    const existing = await this.prisma.inventoryReservation.findUnique({
      where:  { paymentTransactionId },
      select: { id: true, status: true },
    });
    if (existing && (existing.status === InventoryReservationStatus.RESERVED
      || existing.status === InventoryReservationStatus.COMMITTED)) {
      return;
    }

    const lines = await this.trackedLines(storeId, params.lines);

    try {
      await this.prisma.$transaction(async (db) => {
        let reservationId: string;
        if (existing) {
          // Re-take a lapsed hold (e.g. a retry after expiry). Status guard makes
          // a concurrent re-take a no-op instead of a double deduction.
          const reactivated = await db.inventoryReservation.updateMany({
            where: {
              id:     existing.id,
              status: { in: [InventoryReservationStatus.EXPIRED, InventoryReservationStatus.RELEASED] },
            },
            data: { status: InventoryReservationStatus.RESERVED, expiresAt, reservedAt: new Date(), releasedAt: null },
          });
          if (reactivated.count === 0) return;
          await db.inventoryReservationItem.deleteMany({ where: { reservationId: existing.id } });
          reservationId = existing.id;
        } else {
          // Unique on paymentTransactionId: a concurrent first reserve for the
          // same payment fails here (P2002) and rolls back untouched.
          const created = await db.inventoryReservation.create({
            data:   { storeId, paymentTransactionId, tentativeOrderId: checkoutId, expiresAt },
            select: { id: true },
          });
          reservationId = created.id;
        }

        const short: string[] = [];
        for (const line of lines) {
          if (!(await this.takeStock(db, storeId, line))) short.push(line.productId);
        }
        // Throwing rolls back every decrement above — all lines or none.
        if (short.length > 0) throw new InsufficientStockException(short);

        await this.writeItems(db, reservationId, storeId, lines);
        await this.writeLedger(db, storeId, lines, MovementType.OUT, 'Checkout stock hold', paymentTransactionId);
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return; // the concurrent reserve for this same payment won
      }
      throw err;
    }
  }

  /**
   * A retry creates a new payment attempt; the live hold moves to it rather
   * than being taken twice. Returns false when there was no live hold to move.
   */
  async transferToPayment(fromPaymentId: string, toPaymentId: string): Promise<boolean> {
    if (fromPaymentId === toPaymentId) return true;
    const moved = await this.prisma.inventoryReservation.updateMany({
      where: { paymentTransactionId: fromPaymentId, status: InventoryReservationStatus.RESERVED },
      data:  { paymentTransactionId: toPaymentId },
    });
    return moved.count > 0;
  }

  /** True when this payment currently holds stock. */
  async hasLiveHold(paymentTransactionId: string): Promise<boolean> {
    const r = await this.prisma.inventoryReservation.findUnique({
      where:  { paymentTransactionId },
      select: { status: true },
    });
    return r?.status === InventoryReservationStatus.RESERVED;
  }

  /** Releases a pending hold (gateway start failed, payment abandoned). */
  async releaseForPayment(paymentTransactionId: string): Promise<boolean> {
    const r = await this.prisma.inventoryReservation.findUnique({
      where:  { paymentTransactionId },
      select: { id: true },
    });
    return r ? this.returnStock(r.id, InventoryReservationStatus.RESERVED, InventoryReservationStatus.RELEASED) : false;
  }

  /** Checkout cancelled: returns every pending hold taken for it. */
  async releaseForCheckout(checkoutId: string, storeId: string): Promise<number> {
    const holds = await this.prisma.inventoryReservation.findMany({
      where:  { tentativeOrderId: checkoutId, storeId, status: InventoryReservationStatus.RESERVED },
      select: { id: true },
    });
    let released = 0;
    for (const h of holds) {
      if (await this.returnStock(h.id, InventoryReservationStatus.RESERVED, InventoryReservationStatus.RELEASED)) released++;
    }
    return released;
  }

  /** Hold lapsed (cleanup job) or an uncommitted order was cancelled. */
  async expire(reservationId: string): Promise<boolean> {
    return this.returnStock(reservationId, InventoryReservationStatus.RESERVED, InventoryReservationStatus.EXPIRED);
  }

  /** A committed order was cancelled — its units go back on sale. */
  async restockCommitted(reservationId: string): Promise<boolean> {
    return this.returnStock(reservationId, InventoryReservationStatus.COMMITTED, InventoryReservationStatus.RELEASED);
  }

  /**
   * Order created for this captured payment. Normally just RESERVED →
   * COMMITTED (stock was taken at hold time). If there is no live hold — a
   * payment started before holds existed, or captured after its hold lapsed —
   * the units are taken now from `fallbackLines`. The payment is already
   * captured, so the order must not fail: a shortfall is taken anyway (stock
   * goes negative, which the admin low-stock report surfaces) and logged as
   * an oversell for ops.
   */
  async commitForPayment(params: {
    storeId:              string;
    checkoutId:           string;
    paymentTransactionId: string;
    fallbackLines:        StockLine[];
  }): Promise<void> {
    const { storeId, checkoutId, paymentTransactionId } = params;
    const r = await this.prisma.inventoryReservation.findUnique({
      where:  { paymentTransactionId },
      select: { id: true, status: true },
    });

    if (r?.status === InventoryReservationStatus.COMMITTED) return;
    if (r?.status === InventoryReservationStatus.RESERVED) {
      await this.prisma.inventoryReservation.updateMany({
        where: { id: r.id, status: InventoryReservationStatus.RESERVED },
        data:  { status: InventoryReservationStatus.COMMITTED },
      });
      return;
    }

    const lines = await this.trackedLines(storeId, params.fallbackLines);
    const oversold: string[] = [];
    try {
      await this.prisma.$transaction(async (db) => {
        // Claim the commit first (status guard / unique key) so a concurrent
        // completion of the same payment can't deduct a second time.
        let reservationId: string;
        if (r) {
          const claimed = await db.inventoryReservation.updateMany({
            where: {
              id:     r.id,
              status: { in: [InventoryReservationStatus.EXPIRED, InventoryReservationStatus.RELEASED] },
            },
            data: { status: InventoryReservationStatus.COMMITTED, releasedAt: null },
          });
          if (claimed.count === 0) return;
          await db.inventoryReservationItem.deleteMany({ where: { reservationId: r.id } });
          reservationId = r.id;
        } else {
          const created = await db.inventoryReservation.create({
            data: {
              storeId, paymentTransactionId, tentativeOrderId: checkoutId,
              status: InventoryReservationStatus.COMMITTED, expiresAt: new Date(),
            },
            select: { id: true },
          });
          reservationId = created.id;
        }

        for (const line of lines) {
          if (!(await this.takeStock(db, storeId, line))) {
            oversold.push(line.productId);
            await this.takeStock(db, storeId, line, { allowNegative: true });
          }
        }
        await this.writeItems(db, reservationId, storeId, lines);
        await this.writeLedger(db, storeId, lines, MovementType.OUT, 'Order stock deduction', paymentTransactionId);
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
      throw err;
    }

    if (oversold.length > 0) {
      this.logger.error(
        `OVERSOLD: payment ${paymentTransactionId} was captured without a live stock hold and stock was ` +
        `insufficient for product(s) ${oversold.join(', ')} — stock is now negative; fulfilment needs review`,
      );
    }
  }

  /**
   * Units this checkout itself currently holds, keyed by product/variant.
   * Checkout validation adds these back so a shopper's own hold never reads
   * as "out of stock" on retry or re-validation.
   */
  async heldByCheckout(checkoutId: string): Promise<Map<string, number>> {
    const items = await this.prisma.inventoryReservationItem.findMany({
      where:  { reservation: { tentativeOrderId: checkoutId, status: InventoryReservationStatus.RESERVED } },
      select: { productId: true, variantId: true, quantity: true },
    });
    const held = new Map<string, number>();
    for (const i of items) {
      const k = lineKey(i.productId, i.variantId);
      held.set(k, (held.get(k) ?? 0) + i.quantity);
    }
    return held;
  }

  // ─── Internals ──────────────────────────────────────────────────────────

  /** Merges duplicate lines and drops products this store doesn't track (or doesn't have). */
  private async trackedLines(storeId: string, lines: StockLine[]): Promise<StockLine[]> {
    const merged = new Map<string, StockLine>();
    for (const l of lines) {
      if (l.quantity <= 0) continue;
      const k = lineKey(l.productId, l.variantId);
      const prev = merged.get(k);
      merged.set(k, prev ? { ...prev, quantity: prev.quantity + l.quantity } : { ...l, variantId: l.variantId ?? null });
    }
    if (merged.size === 0) return [];

    const tracked = await this.prisma.product.findMany({
      where:  { storeId, id: { in: [...new Set([...merged.values()].map((l) => l.productId))] }, trackInventory: true },
      select: { id: true },
    });
    const trackedIds = new Set(tracked.map((p) => p.id));
    return [...merged.values()].filter((l) => trackedIds.has(l.productId));
  }

  /** One conditional UPDATE: succeeds only if enough stock remains (unless allowNegative). */
  private async takeStock(db: Db, storeId: string, line: StockLine, opts: { allowNegative?: boolean } = {}): Promise<boolean> {
    const guard = opts.allowNegative ? {} : { stock: { gte: line.quantity } };
    const result = line.variantId
      ? await db.productVariant.updateMany({
        where: { id: line.variantId, productId: line.productId, ...guard },
        data:  { stock: { decrement: line.quantity } },
      })
      : await db.product.updateMany({
        where: { id: line.productId, storeId, ...guard },
        data:  { stock: { decrement: line.quantity } },
      });
    return result.count === 1;
  }

  private async putBackStock(db: Db, storeId: string, line: StockLine): Promise<void> {
    if (line.variantId) {
      await db.productVariant.updateMany({
        where: { id: line.variantId, productId: line.productId },
        data:  { stock: { increment: line.quantity } },
      });
    } else {
      await db.product.updateMany({
        where: { id: line.productId, storeId },
        data:  { stock: { increment: line.quantity } },
      });
    }
  }

  /** Status-guarded, so concurrent releases (cron + cancel) return the units exactly once. */
  private async returnStock(
    reservationId: string,
    from: InventoryReservationStatus,
    to: InventoryReservationStatus,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (db) => {
      const moved = await db.inventoryReservation.updateMany({
        where: { id: reservationId, status: from },
        data:  { status: to, releasedAt: new Date() },
      });
      if (moved.count === 0) return false;

      const reservation = await db.inventoryReservation.findUnique({
        where:   { id: reservationId },
        include: { items: true },
      });
      if (!reservation) return false;
      const lines = reservation.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity }));
      for (const line of lines) await this.putBackStock(db, reservation.storeId, line);
      await this.writeLedger(
        db, reservation.storeId, lines, MovementType.IN,
        to === InventoryReservationStatus.EXPIRED ? 'Checkout stock hold expired' : 'Stock returned (checkout/order cancelled)',
        reservation.paymentTransactionId ?? reservation.tentativeOrderId,
      );
      return true;
    });
  }

  private async writeItems(db: Db, reservationId: string, storeId: string, lines: StockLine[]): Promise<void> {
    if (lines.length === 0) return;
    await db.inventoryReservationItem.createMany({
      data: lines.map((l) => ({ reservationId, storeId, productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
    });
  }

  private async writeLedger(
    db: Db, storeId: string, lines: StockLine[], type: MovementType, reason: string, reference: string,
  ): Promise<void> {
    if (lines.length === 0) return;
    await db.stockMovement.createMany({
      data: lines.map((l) => ({
        storeId, productId: l.productId, type, quantity: l.quantity,
        reason: l.variantId ? `${reason} (variant ${l.variantId})` : reason,
        reference,
      })),
    });
  }
}
