import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OutboxEventStatus } from '@prisma/client';
import { OutboxProcessorService } from './outbox-processor.service';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function buildPrismaMock() {
  return {
    outboxEvent: {
      findMany:   jest.fn().mockResolvedValue([]),
      update:     jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn(),
    $queryRaw:    jest.fn().mockResolvedValue([]),
  };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id:           'evt-1',
    eventType:    'ORDER_CREATED',
    eventVersion: 1,
    aggregateId:  'ord-1',
    aggregateType:'Order',
    payload:      { orderId: 'ord-1', storeId: 'store-1' },
    status:       OutboxEventStatus.PROCESSING,
    attempts:     1,
    maxAttempts:  5,
    nextRetryAt:  new Date(),
    storeId:      'store-1',
    processedAt:  null,
    createdAt:    new Date(),
    updatedAt:    new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OutboxProcessorService', () => {
  let service:      OutboxProcessorService;
  let prisma:       ReturnType<typeof buildPrismaMock>;
  let eventEmitter: { emitAsync: jest.Mock };
  let config:       { get: jest.Mock };

  beforeEach(async () => {
    prisma       = buildPrismaMock();
    eventEmitter = { emitAsync: jest.fn().mockResolvedValue([]) };
    config       = {
      get: jest.fn((key: string, defaultVal?: unknown) => {
        const vals: Record<string, unknown> = {
          OUTBOX_BATCH_SIZE:         50,
          OUTBOX_MAX_BACKOFF_MINUTES: 60,
        };
        return key in vals ? vals[key] : defaultVal;
      }),
    };

    service = new (OutboxProcessorService as any)(prisma, eventEmitter, config) as OutboxProcessorService;
  });

  afterEach(() => jest.clearAllMocks());

  // ─── claimBatch ───────────────────────────────────────────────────────────

  describe('claimBatch', () => {
    // Optimistic two-phase claim (MariaDB has no SKIP LOCKED): SELECT candidates,
    // then UPDATE … WHERE status = PENDING as a compare-and-swap.
    it('returns empty array when no PENDING events exist', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      const ids = await service.claimBatch();

      expect(ids).toEqual([]);
      expect(prisma.outboxEvent.updateMany).not.toHaveBeenCalled();
    });

    it('marks claimed events as PROCESSING and increments attempts', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ id: 'evt-1' }, { id: 'evt-2' }]);
      prisma.outboxEvent.updateMany.mockResolvedValueOnce({ count: 2 });

      const ids = await service.claimBatch();

      expect(ids).toEqual(['evt-1', 'evt-2']);
      expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['evt-1', 'evt-2'] }, status: OutboxEventStatus.PENDING },
        data:  { status: OutboxEventStatus.PROCESSING, attempts: { increment: 1 } },
      });
    });

    it('returns empty array when another worker claimed the batch first (CAS count = 0)', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ id: 'evt-1' }]);
      prisma.outboxEvent.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.claimBatch()).resolves.toEqual([]);
    });
  });

  // ─── processBatch ─────────────────────────────────────────────────────────

  describe('processBatch', () => {
    it('emits event and marks SENT on success', async () => {
      const event = makeEvent();
      jest.spyOn(service, 'claimBatch').mockResolvedValueOnce(['evt-1']);
      prisma.outboxEvent.findMany.mockResolvedValueOnce([event]);

      await service.processBatch();

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith('ORDER_CREATED', expect.any(Object));
      expect(prisma.outboxEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'evt-1' },
          data:  expect.objectContaining({ status: OutboxEventStatus.SENT }),
        }),
      );
    });

    it('schedules retry with exponential backoff on emit failure', async () => {
      const event = makeEvent({ attempts: 1, maxAttempts: 5 });
      jest.spyOn(service, 'claimBatch').mockResolvedValueOnce(['evt-1']);
      prisma.outboxEvent.findMany.mockResolvedValueOnce([event]);
      eventEmitter.emitAsync.mockRejectedValueOnce(new Error('listener error'));

      await service.processBatch();

      expect(prisma.outboxEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status:      OutboxEventStatus.PENDING,
            nextRetryAt: expect.any(Date),
          }),
        }),
      );
    });

    it('dead-letters event when attempts reaches maxAttempts', async () => {
      const event = makeEvent({ attempts: 5, maxAttempts: 5 });
      jest.spyOn(service, 'claimBatch').mockResolvedValueOnce(['evt-1']);
      prisma.outboxEvent.findMany.mockResolvedValueOnce([event]);
      eventEmitter.emitAsync.mockRejectedValueOnce(new Error('permanent failure'));

      await service.processBatch();

      expect(prisma.outboxEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: OutboxEventStatus.DEAD }),
        }),
      );
    });

    it('no-ops when claimBatch returns empty array', async () => {
      jest.spyOn(service, 'claimBatch').mockResolvedValueOnce([]);

      await service.processBatch();

      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
      expect(prisma.outboxEvent.update).not.toHaveBeenCalled();
    });

    it('resets stale PROCESSING events to PENDING before claiming batch', async () => {
      jest.spyOn(service, 'claimBatch').mockResolvedValueOnce([]);

      await service.processBatch();

      expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: OutboxEventStatus.PROCESSING }),
          data:  expect.objectContaining({ status: OutboxEventStatus.PENDING }),
        }),
      );
    });

    it('does not run concurrently (second call returns early)', async () => {
      // Set isRunning = true manually to simulate concurrent call
      (service as any).isRunning = true;
      const claimSpy = jest.spyOn(service, 'claimBatch');

      await service.processBatch();

      expect(claimSpy).not.toHaveBeenCalled();
      (service as any).isRunning = false;
    });

    it('exponential backoff increases with attempt count', () => {
      // computeNextRetry is private; access via casting
      const svc = service as any;
      const t1  = svc.computeNextRetry(1); // 30s from now
      const t2  = svc.computeNextRetry(2); // 60s from now
      const t3  = svc.computeNextRetry(3); // 120s from now

      expect(t2.getTime() - Date.now()).toBeGreaterThan(t1.getTime() - Date.now() - 100);
      expect(t3.getTime() - Date.now()).toBeGreaterThan(t2.getTime() - Date.now() - 100);
    });
  });
});
