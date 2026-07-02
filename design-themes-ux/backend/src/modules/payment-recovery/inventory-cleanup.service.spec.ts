import { Test, TestingModule } from '@nestjs/testing';
import { InventoryReservationStatus, PaymentTxStatus } from '@prisma/client';
import { InventoryCleanupService } from './inventory-cleanup.service';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPrismaMock() {
  return {
    inventoryReservation: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(),
  };
}

/** Builds a minimal expired reservation with one item and an optional payment. */
function makeReservation(
  paymentOverrides: Record<string, unknown> | null = null,
  itemOverrides: Record<string, unknown>[] = [],
) {
  const items =
    itemOverrides.length > 0
      ? itemOverrides
      : [{ id: 'item-1', productId: 'prod-1', variantId: null, quantity: 2 }];

  return {
    id:        'res-1',
    storeId:   'store-1',
    status:    InventoryReservationStatus.RESERVED,
    expiresAt: new Date(Date.now() - 1000),
    items,
    payment:   paymentOverrides as any,
  };
}

/**
 * Builds a $transaction mock that executes the callback synchronously.
 * `txInventoryReservationResult` controls what updateMany returns for the reservation row.
 * `txInventoryLevelResult`       controls what updateMany returns for each inventory level row.
 */
function makeTransactionMock(
  txInventoryReservationResult: { count: number },
  txInventoryLevelResult: { count: number } = { count: 1 },
) {
  return jest.fn().mockImplementation(async (fn: Function) => {
    const txClient = {
      inventoryReservation: {
        updateMany: jest.fn().mockResolvedValue(txInventoryReservationResult),
      },
      inventoryLevel: {
        updateMany: jest.fn().mockResolvedValue(txInventoryLevelResult),
      },
    };
    return fn(txClient);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InventoryCleanupService', () => {
  let service: InventoryCleanupService;
  let prisma:   ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryCleanupService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(InventoryCleanupService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── Successful cleanup ───────────────────────────────────────────────────

  it('marks RESERVED reservation as EXPIRED and decrements reserved on success', async () => {
    const reservation = makeReservation(null);
    prisma.inventoryReservation.findMany.mockResolvedValueOnce([reservation]);
    prisma.$transaction = makeTransactionMock({ count: 1 }, { count: 1 });
    const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});

    await service.releaseExpiredReservations();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Released expired reservation res-1'));
  });

  // ─── Optimistic-lock: already released by concurrent instance ─────────────

  it('no-ops without error when reservation was concurrently released (count=0 idempotent)', async () => {
    const reservation = makeReservation(null);
    prisma.inventoryReservation.findMany.mockResolvedValueOnce([reservation]);
    // count=0 means the reservation was already moved out of RESERVED by another instance
    prisma.$transaction = makeTransactionMock({ count: 0 });
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});

    await service.releaseExpiredReservations();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // No error because count=0 is the idempotent path, not a failure
    expect(errorSpy).not.toHaveBeenCalled();
  });

  // ─── CAPTURED payment deferral ────────────────────────────────────────────

  it('skips release and increments skipped counter when payment is CAPTURED', async () => {
    const reservation = makeReservation({ id: 'tx-1', status: PaymentTxStatus.CAPTURED, orderId: null });
    prisma.inventoryReservation.findMany.mockResolvedValueOnce([reservation]);
    const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});

    await service.releaseExpiredReservations();

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('CAPTURED'));
  });

  // ─── PARTIALLY_REFUNDED deferral ──────────────────────────────────────────

  it('skips release when payment is PARTIALLY_REFUNDED', async () => {
    const reservation = makeReservation({ id: 'tx-1', status: PaymentTxStatus.PARTIALLY_REFUNDED, orderId: null });
    prisma.inventoryReservation.findMany.mockResolvedValueOnce([reservation]);

    await service.releaseExpiredReservations();

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // ─── orderId anomaly ──────────────────────────────────────────────────────

  it('skips release and logs error when reservation is RESERVED but linked to an order', async () => {
    // A RESERVED reservation that somehow has an orderId is an inventory inconsistency
    const reservation = makeReservation({ id: 'tx-1', status: PaymentTxStatus.CAPTURED, orderId: 'ord-1' });
    prisma.inventoryReservation.findMany.mockResolvedValueOnce([reservation]);
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});

    await service.releaseExpiredReservations();

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('res-1'));
  });

  // ─── Lower-bound guard: transaction rolls back ────────────────────────────

  it('throws inside transaction and rolls back when lower-bound guard fires (count=0)', async () => {
    const reservation = makeReservation(null);
    prisma.inventoryReservation.findMany.mockResolvedValueOnce([reservation]);

    // Reservation update succeeds (count=1) but inventory level update returns count=0
    prisma.$transaction = makeTransactionMock({ count: 1 }, { count: 0 });
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
    const logSpy   = jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});

    await service.releaseExpiredReservations();

    // The error is caught per-reservation; the outer method does not throw
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to release reservation res-1'),
    );
    // Success log must NOT fire — nothing was released
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Released expired reservation'));
  });

  // ─── Transaction rollback verification ───────────────────────────────────

  it('does not count a failed release — released stays 0 after lower-bound guard rollback', async () => {
    const reservation = makeReservation(null);
    prisma.inventoryReservation.findMany.mockResolvedValueOnce([reservation]);
    prisma.$transaction = makeTransactionMock({ count: 1 }, { count: 0 });
    const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});

    await service.releaseExpiredReservations();

    // The final summary log ("released=N skipped=N") must not appear because
    // released=0 and skipped=0 (the guard inside logStats skips zero values).
    expect(logSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Inventory cleanup:'),
    );
  });

  // ─── Loop continues after per-reservation failure ─────────────────────────

  it('continues processing remaining reservations after one fails', async () => {
    const failingRes  = { ...makeReservation(null), id: 'res-fail' };
    const succeedingRes = { ...makeReservation(null), id: 'res-ok' };
    prisma.inventoryReservation.findMany.mockResolvedValueOnce([failingRes, succeedingRes]);

    // First call: lower-bound guard fires (count=0 for level)
    // Second call: full success
    prisma.$transaction = jest.fn()
      .mockImplementationOnce(async (fn: Function) => {
        const txClient = {
          inventoryReservation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          inventoryLevel:       { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        };
        return fn(txClient);
      })
      .mockImplementationOnce(async (fn: Function) => {
        const txClient = {
          inventoryReservation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          inventoryLevel:       { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        };
        return fn(txClient);
      });

    const logSpy   = jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});

    await service.releaseExpiredReservations();

    // Second reservation must have been released despite first failing
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Released expired reservation res-ok'));
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Released expired reservation res-fail'));
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  // ─── No expired reservations ─────────────────────────────────────────────

  it('no-ops cleanly when findMany returns an empty list', async () => {
    prisma.inventoryReservation.findMany.mockResolvedValueOnce([]);

    await service.releaseExpiredReservations();

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
