import { Test, TestingModule } from '@nestjs/testing';
import { OutboxEventStatus } from '@prisma/client';
import { OutboxHelperService, OutboxEventInput } from '../outbox-helper.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTxClient() {
  return {
    outboxEvent: {
      findFirst: jest.fn(),
      create:    jest.fn(),
    },
  };
}

const STORE_ID = 'store-1';

const EV: OutboxEventInput = {
  eventType:     'ORDER_CANCELLED',
  aggregateId:   'order-1',
  aggregateType: 'Order',
  payload:       { orderId: 'order-1', storeId: STORE_ID },
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('OutboxHelperService', () => {
  let service: OutboxHelperService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OutboxHelperService],
    }).compile();

    service = module.get(OutboxHelperService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── TEST-OH-1 ─────────────────────────────────────────────────────────────

  it('TEST-OH-1: creates the outbox event when no active event exists', async () => {
    const tx = buildTxClient();
    tx.outboxEvent.findFirst.mockResolvedValue(null);
    tx.outboxEvent.create.mockResolvedValue({ id: 'ev-1' });

    await service.upsertOutboxEvent(tx as any, STORE_ID, EV);

    expect(tx.outboxEvent.findFirst).toHaveBeenCalledWith({
      where: {
        storeId:     STORE_ID,
        eventType:   EV.eventType,
        aggregateId: EV.aggregateId,
        status:      { notIn: [OutboxEventStatus.FAILED, OutboxEventStatus.DEAD] },
      },
      select: { id: true },
    });

    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: {
        storeId:       STORE_ID,
        eventType:     EV.eventType,
        aggregateId:   EV.aggregateId,
        aggregateType: EV.aggregateType,
        payload:       EV.payload,
        status:        OutboxEventStatus.PENDING,
      },
    });
  });

  // ── TEST-OH-2 ─────────────────────────────────────────────────────────────

  it('TEST-OH-2: is idempotent — skips create when an active event already exists', async () => {
    const tx = buildTxClient();
    tx.outboxEvent.findFirst.mockResolvedValue({ id: 'existing-1' });

    await service.upsertOutboxEvent(tx as any, STORE_ID, EV);

    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  // ── TEST-OH-3 ─────────────────────────────────────────────────────────────

  it('TEST-OH-3: dedup query excludes FAILED and DEAD — creates new event after those statuses', async () => {
    const tx = buildTxClient();
    // FAILED / DEAD events are excluded from the WHERE clause, so findFirst
    // returns null → a new event must be created.
    tx.outboxEvent.findFirst.mockResolvedValue(null);
    tx.outboxEvent.create.mockResolvedValue({ id: 'ev-new' });

    await service.upsertOutboxEvent(tx as any, STORE_ID, EV);

    // Confirm the exclusion list is exactly [FAILED, DEAD]
    const { status } = tx.outboxEvent.findFirst.mock.calls[0][0].where;
    expect(status).toEqual({ notIn: [OutboxEventStatus.FAILED, OutboxEventStatus.DEAD] });

    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  // ── TEST-OH-4 ─────────────────────────────────────────────────────────────

  it('TEST-OH-4: creates PENDING status on new event', async () => {
    const tx = buildTxClient();
    tx.outboxEvent.findFirst.mockResolvedValue(null);
    tx.outboxEvent.create.mockResolvedValue({ id: 'ev-1' });

    await service.upsertOutboxEvent(tx as any, STORE_ID, EV);

    expect(tx.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: OutboxEventStatus.PENDING }) }),
    );
  });

  // ── TEST-OH-5 ─────────────────────────────────────────────────────────────

  it('TEST-OH-5: scopes dedup by storeId — different storeId creates a new event', async () => {
    const tx = buildTxClient();
    // findFirst returns null (other store's event is not found in this scope)
    tx.outboxEvent.findFirst.mockResolvedValue(null);
    tx.outboxEvent.create.mockResolvedValue({ id: 'ev-store2' });

    await service.upsertOutboxEvent(tx as any, 'store-2', EV);

    expect(tx.outboxEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ storeId: 'store-2' }) }),
    );
    expect(tx.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ storeId: 'store-2' }) }),
    );
  });

  // ── TEST-OH-6: skipDedup — always creates without checking ────────────────

  it('TEST-OH-6: skipDedup=true creates event unconditionally — findFirst is not called', async () => {
    const tx = buildTxClient();
    tx.outboxEvent.create.mockResolvedValue({ id: 'ev-skip' });

    await service.upsertOutboxEvent(tx as any, STORE_ID, EV, { skipDedup: true });

    expect(tx.outboxEvent.findFirst).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  // ── TEST-OH-7: skipDedup creates even when a SENT event exists ────────────

  it('TEST-OH-7: skipDedup=true creates a second event even when a SENT event already exists for same key', async () => {
    const tx = buildTxClient();
    // Simulate what would happen with skipDedup=false: findFirst would block creation.
    // With skipDedup=true it is not called, and create always runs.
    tx.outboxEvent.create
      .mockResolvedValueOnce({ id: 'ev-1' })
      .mockResolvedValueOnce({ id: 'ev-2' });

    await service.upsertOutboxEvent(tx as any, STORE_ID, EV, { skipDedup: true });
    await service.upsertOutboxEvent(tx as any, STORE_ID, EV, { skipDedup: true });

    expect(tx.outboxEvent.findFirst).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(2);
  });

  // ── TEST-OH-8: skipDedup=false (explicit) behaves identically to default ──

  it('TEST-OH-8: skipDedup=false applies deduplication normally', async () => {
    const tx = buildTxClient();
    tx.outboxEvent.findFirst.mockResolvedValue({ id: 'existing' });

    await service.upsertOutboxEvent(tx as any, STORE_ID, EV, { skipDedup: false });

    expect(tx.outboxEvent.findFirst).toHaveBeenCalledTimes(1);
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });
});
