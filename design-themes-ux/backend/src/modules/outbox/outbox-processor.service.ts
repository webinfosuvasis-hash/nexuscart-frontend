import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OutboxEventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// How long (ms) a PROCESSING event may be held before we assume the worker died.
const STALE_PROCESSING_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Delay before retry N of a failed event: 30s · 2^(N-1), capped at
 * maxBackoffMinutes. Exported so handlers that record their own retry
 * schedule (e.g. vendor order emails) report the time the processor will use.
 */
export function outboxBackoffMs(attempts: number, maxBackoffMinutes: number): number {
  return Math.min(30 * Math.pow(2, attempts - 1), maxBackoffMinutes * 60) * 1000;
}

@Injectable()
export class OutboxProcessorService {
  private readonly logger = new Logger(OutboxProcessorService.name);
  private readonly batchSize:          number;
  private readonly maxBackoffMinutes:  number;
  private isRunning = false;

  constructor(
    private readonly prisma:        PrismaService,
    private readonly eventEmitter:  EventEmitter2,
    private readonly config:        ConfigService,
  ) {
    this.batchSize         = this.config.get<number>('OUTBOX_BATCH_SIZE', 50);
    this.maxBackoffMinutes = this.config.get<number>('OUTBOX_MAX_BACKOFF_MINUTES', 60);
  }

  // ---------------------------------------------------------------------------
  // Cron: every 10 seconds
  // ---------------------------------------------------------------------------

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processBatch(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    const startMs = Date.now();
    let processed = 0;
    let succeeded = 0;
    let failed    = 0;
    let deadLettered = 0;

    try {
      // 1. Reset events that got stuck in PROCESSING (worker crashed between claim and completion)
      await this.recoverStaleProcessing();

      // 2. Claim a batch atomically with SKIP LOCKED to prevent double-processing
      //    across multiple NestJS instances.
      const claimedIds = await this.claimBatch();
      if (claimedIds.length === 0) return;

      // 3. Load full event records after releasing the row lock
      const events = await this.prisma.outboxEvent.findMany({
        where: { id: { in: claimedIds } },
      });

      // 4. Process each event
      for (const ev of events) {
        processed++;
        const payload = ev.payload as Record<string, unknown>;
        try {
          await this.eventEmitter.emitAsync(ev.eventType, payload);

          await this.prisma.outboxEvent.update({
            where: { id: ev.id },
            data:  {
              status:      OutboxEventStatus.SENT,
              processedAt: new Date(),
            },
          });
          succeeded++;
          this.logger.debug(
            `OutboxEvent ${ev.id} (${ev.eventType}) emitted successfully — attempt ${ev.attempts}`,
          );
        } catch (err) {
          failed++;
          if (ev.attempts >= ev.maxAttempts) {
            await this.prisma.outboxEvent.update({
              where: { id: ev.id },
              data:  {
                status:      OutboxEventStatus.DEAD,
                processedAt: new Date(),
              },
            });
            deadLettered++;
            this.logger.error(
              `OutboxEvent ${ev.id} (${ev.eventType}) dead-lettered after ${ev.attempts} attempt(s): ${(err as Error).message}`,
            );
          } else {
            const nextRetryAt = this.computeNextRetry(ev.attempts);
            await this.prisma.outboxEvent.update({
              where: { id: ev.id },
              data:  {
                status:     OutboxEventStatus.PENDING,
                nextRetryAt,
              },
            });
            this.logger.warn(
              `OutboxEvent ${ev.id} (${ev.eventType}) failed on attempt ${ev.attempts}; ` +
              `retry at ${nextRetryAt.toISOString()}: ${(err as Error).message}`,
            );
          }
        }
      }
    } catch (err) {
      this.logger.error(`OutboxProcessorService: batch run failed — ${(err as Error).message}`, (err as Error).stack);
    } finally {
      this.isRunning = false;
      const durationMs = Date.now() - startMs;
      if (processed > 0) {
        this.logger.log(
          `Outbox batch: processed=${processed} succeeded=${succeeded} ` +
          `failed=${failed} deadLettered=${deadLettered} durationMs=${durationMs}`,
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Claims up to `batchSize` PENDING events.
   *
   * MariaDB does not support SELECT … FOR UPDATE SKIP LOCKED (MySQL 8.0+ only).
   * Instead we use an optimistic two-phase approach:
   *   1. SELECT candidate IDs (no lock).
   *   2. UPDATE with WHERE status = 'PENDING' as a compare-and-swap guard.
   * A concurrent worker racing for the same candidates will see count = 0 on
   * its UPDATE and bail out immediately, preventing double-processing.
   */
  async claimBatch(): Promise<string[]> {
    // Prisma stores DateTime as UTC; NOW() is the DB server's local time, which on
    // a non-UTC server made every backoff expire immediately. Compare in UTC.
    const candidates = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM outbox_events
      WHERE status = 'PENDING'
        AND nextRetryAt <= UTC_TIMESTAMP(3)
        AND attempts < maxAttempts
      ORDER BY nextRetryAt ASC
      LIMIT ${Prisma.raw(String(this.batchSize))}
    `;

    if (candidates.length === 0) return [];

    const ids = candidates.map((r) => r.id);

    const { count } = await this.prisma.outboxEvent.updateMany({
      where: { id: { in: ids }, status: OutboxEventStatus.PENDING },
      data:  { status: OutboxEventStatus.PROCESSING, attempts: { increment: 1 } },
    });

    // Another worker claimed this batch between our SELECT and UPDATE.
    if (count === 0) return [];

    return ids;
  }

  /**
   * Resets events that have been stuck in PROCESSING beyond the stale threshold.
   * This handles the case where the worker process died mid-batch.
   * Preserves the attempt count — the event will be re-processed on the next cron tick.
   */
  private async recoverStaleProcessing(): Promise<void> {
    const staleThreshold = new Date(Date.now() - STALE_PROCESSING_MS);
    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        status:    OutboxEventStatus.PROCESSING,
        updatedAt: { lt: staleThreshold },
      },
      data: {
        status:     OutboxEventStatus.PENDING,
        nextRetryAt: new Date(),
      },
    });
    if (result.count > 0) {
      this.logger.warn(`Outbox: reset ${result.count} stale PROCESSING event(s) to PENDING`);
    }
  }

  /**
   * Exponential backoff capped at maxBackoffMinutes.
   * attempt=1 → 30s, attempt=2 → 60s, attempt=3 → 120s, ...
   */
  private computeNextRetry(attempts: number): Date {
    return new Date(Date.now() + outboxBackoffMs(attempts, this.maxBackoffMinutes));
  }
}
