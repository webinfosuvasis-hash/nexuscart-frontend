import { Injectable } from '@nestjs/common';
import { OutboxEventStatus, Prisma } from '@prisma/client';

export interface OutboxEventInput {
  eventType:     string;
  aggregateId:   string;
  aggregateType: string;
  payload:       Record<string, unknown>;
}

@Injectable()
export class OutboxHelperService {
  /**
   * Write an outbox event inside an existing Prisma $transaction.
   *
   * Default behaviour (skipDedup = false):
   *   Skips creation when an active event (status NOT FAILED/DEAD) already
   *   exists for the same (storeId, eventType, aggregateId) triple — preventing
   *   duplicate outbox events on concurrent calls or retries.
   *   Correct for one-time lifecycle events: SHIPMENT_CREATED, ORDER_SHIPPED,
   *   SHIPMENT_DELIVERED, ORDER_DELIVERED, ORDER_CANCELLED, etc.
   *
   * skipDedup = true:
   *   Bypasses the deduplication check and always creates a new event.
   *   Required for repeatable-update events (e.g. SHIPMENT_UPDATED) where the
   *   same aggregate may be updated multiple times and each update must produce
   *   an independent notification.
   *
   * MUST be called from inside a prisma.$transaction() callback so that the
   * event creation is atomic with the state change that triggers it.
   */
  async upsertOutboxEvent(
    txClient: Prisma.TransactionClient,
    storeId:  string,
    ev:       OutboxEventInput,
    options?: { skipDedup?: boolean },
  ): Promise<void> {
    if (!options?.skipDedup) {
      const exists = await txClient.outboxEvent.findFirst({
        where: {
          storeId,
          eventType:   ev.eventType,
          aggregateId: ev.aggregateId,
          status:      { notIn: [OutboxEventStatus.FAILED, OutboxEventStatus.DEAD] },
        },
        select: { id: true },
      });

      if (exists) return;
    }

    await txClient.outboxEvent.create({
      data: {
        storeId,
        eventType:     ev.eventType,
        aggregateId:   ev.aggregateId,
        aggregateType: ev.aggregateType,
        payload:       ev.payload as Prisma.InputJsonValue,
        status:        OutboxEventStatus.PENDING,
      },
    });
  }
}
