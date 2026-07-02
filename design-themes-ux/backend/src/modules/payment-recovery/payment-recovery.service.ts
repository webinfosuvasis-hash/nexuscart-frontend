import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PaymentActivityType, PaymentActorType, PaymentTxStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import { PrismaService } from '../../prisma/prisma.service';
import { PaymentService } from '../payment/payment.service';
import { PaymentOrchestratorService } from '../payment-orchestrator/payment-orchestrator.service';
import { RecoveryRunStats, EMPTY_STATS } from './types/recovery.types';

// AUTHORIZED transactions idle beyond this window are flagged for capture retry.
// Default: 30 minutes — matches typical gateway authorization-to-capture SLA.
const DEFAULT_AUTHORIZED_TIMEOUT_MINUTES = 30;

// CAPTURED transactions must age at least this long before recovery runs.
// 2 minutes covers the normal webhook delivery latency window.
const DEFAULT_CAPTURED_MIN_AGE_SECONDS = 120;

// Maximum CAPTURED→order recovery attempts before manual intervention is required.
const DEFAULT_MAX_RECOVERY_RETRIES = 5;

// WebhookLog entries stuck in PENDING beyond this threshold are assumed orphaned.
const STALE_WEBHOOK_MINUTES = 15;

@Injectable()
export class PaymentRecoveryService {
  private readonly logger = new Logger(PaymentRecoveryService.name);

  private readonly capturedMinAgeSeconds:     number;
  private readonly authorizedTimeoutMinutes:  number;
  private readonly maxRecoveryRetries:        number;

  private isCapturedRunning  = false;
  private isAuthorizedRunning = false;
  private isWebhookRunning   = false;

  constructor(
    private readonly prisma:        PrismaService,
    private readonly paymentSvc:    PaymentService,
    private readonly orchestrator:  PaymentOrchestratorService,
    private readonly config:        ConfigService,
  ) {
    this.capturedMinAgeSeconds    = this.config.get<number>('RECOVERY_CAPTURED_MIN_AGE_SECONDS', DEFAULT_CAPTURED_MIN_AGE_SECONDS);
    this.authorizedTimeoutMinutes = this.config.get<number>('RECOVERY_AUTHORIZED_TIMEOUT_MINUTES', DEFAULT_AUTHORIZED_TIMEOUT_MINUTES);
    this.maxRecoveryRetries       = this.config.get<number>('RECOVERY_MAX_RETRIES', DEFAULT_MAX_RECOVERY_RETRIES);
  }

  // ---------------------------------------------------------------------------
  // 1. Recover CAPTURED transactions without completed orders (every minute)
  // ---------------------------------------------------------------------------

  @Cron(CronExpression.EVERY_MINUTE)
  async recoverCapturedWithoutOrders(): Promise<void> {
    if (this.isCapturedRunning) return;
    this.isCapturedRunning = true;
    const stats: RecoveryRunStats = { ...EMPTY_STATS };
    const startMs = Date.now();

    try {
      const minAgeThreshold = new Date(Date.now() - this.capturedMinAgeSeconds * 1000);

      const stale = await this.prisma.paymentTransaction.findMany({
        where: {
          status:    PaymentTxStatus.CAPTURED,
          orderId:   null,
          capturedAt: { lt: minAgeThreshold },
          retryCount: { lt: this.maxRecoveryRetries },
          // Only retry when the backoff window has elapsed (null = never failed, always eligible).
          OR: [
            { nextRetryAt: null },
            { nextRetryAt: { lte: new Date() } },
          ],
        },
        select: { id: true, storeId: true, retryCount: true },
        orderBy: { capturedAt: 'asc' },
        take: 50,
      });

      for (const tx of stale) {
        try {
          await this.orchestrator.completePayment(tx.id, tx.storeId);

          await this.recordRecoveryActivity(tx.id, tx.storeId, 'captured_without_order', true);
          stats.recovered++;
          this.logger.log(
            `Recovery: completed order for CAPTURED tx ${tx.id} (storeId=${tx.storeId})`,
          );
        } catch (err) {
          // Exponential backoff: base = capturedMinAgeSeconds, doubles per retry, capped at 6 h.
          const backoffMs = Math.min(
            this.capturedMinAgeSeconds * 1000 * Math.pow(2, tx.retryCount),
            6 * 60 * 60 * 1000,
          );
          const nextRetryAt = new Date(Date.now() + backoffMs);
          await this.incrementRetryCount(tx.id, nextRetryAt);
          await this.recordRecoveryActivity(tx.id, tx.storeId, 'captured_without_order', false, String(err));
          stats.failed++;
          this.logger.error(
            `Recovery: completePayment failed for tx ${tx.id}: ${(err as Error).message}`,
            (err as Error).stack,
          );
        }
      }

      // Transactions at retry limit — needs manual intervention
      const exhausted = await this.prisma.paymentTransaction.count({
        where: {
          status:     PaymentTxStatus.CAPTURED,
          orderId:    null,
          retryCount: { gte: this.maxRecoveryRetries },
        },
      });
      if (exhausted > 0) {
        this.logger.error(
          `ALERT: ${exhausted} CAPTURED transaction(s) have exceeded ${this.maxRecoveryRetries} recovery ` +
          `retries with no order created — manual intervention required`,
        );
      }
    } catch (err) {
      this.logger.error(
        `recoverCapturedWithoutOrders run failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    } finally {
      this.isCapturedRunning = false;
      stats.durationMs = Date.now() - startMs;
      this.logStats('recoverCapturedWithoutOrders', stats);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Recover stuck AUTHORIZED transactions (every 5 minutes)
  // ---------------------------------------------------------------------------

  @Cron(CronExpression.EVERY_5_MINUTES)
  async recoverStuckAuthorized(): Promise<void> {
    if (this.isAuthorizedRunning) return;
    this.isAuthorizedRunning = true;
    const stats: RecoveryRunStats = { ...EMPTY_STATS };
    const startMs = Date.now();

    try {
      const timeoutThreshold = new Date(
        Date.now() - this.authorizedTimeoutMinutes * 60 * 1000,
      );

      const stale = await this.prisma.paymentTransaction.findMany({
        where: {
          status:      PaymentTxStatus.AUTHORIZED,
          authorizedAt: { lt: timeoutThreshold },
          orderId:     null,
          retryCount:  { lt: this.maxRecoveryRetries },
          // Only retry when the backoff window has elapsed (null = never failed, always eligible).
          OR: [
            { nextRetryAt: null },
            { nextRetryAt: { lte: new Date() } },
          ],
        },
        select: { id: true, storeId: true, retryCount: true, gatewayCode: true },
        orderBy: { authorizedAt: 'asc' },
        take: 20,
      });

      for (const tx of stale) {
        // Use a stable idempotency key per transaction — safe to re-use if the
        // previous attempt's idem record exists but the tx is still AUTHORIZED.
        const idempotencyKey = `recovery:capture:${tx.id}`;
        try {
          await this.paymentSvc.capturePayment({ transactionId: tx.id, storeId: tx.storeId, idempotencyKey });
          await this.recordRecoveryActivity(tx.id, tx.storeId, 'authorized_timeout_capture', true);
          stats.recovered++;
          this.logger.log(
            `Recovery: capture issued for AUTHORIZED tx ${tx.id} (${tx.gatewayCode}); ` +
            `order creation will run on next CAPTURED recovery pass`,
          );
        } catch (err) {
          const backoffMs  = Math.min(this.authorizedTimeoutMinutes * 60 * 1000 * Math.pow(2, tx.retryCount), 6 * 60 * 60 * 1000);
          const nextRetryAt = new Date(Date.now() + backoffMs);
          await this.prisma.paymentTransaction.update({
            where: { id: tx.id },
            data:  { retryCount: { increment: 1 }, nextRetryAt },
          });
          await this.recordRecoveryActivity(tx.id, tx.storeId, 'authorized_timeout_capture', false, String(err));
          stats.failed++;
          this.logger.error(
            `Recovery: capture failed for AUTHORIZED tx ${tx.id}: ${(err as Error).message}`,
          );
        }
      }

      // Single ALERT per cron tick (not per exhausted tx) for ops visibility.
      const exhausted = await this.prisma.paymentTransaction.count({
        where: {
          status:     PaymentTxStatus.AUTHORIZED,
          orderId:    null,
          retryCount: { gte: this.maxRecoveryRetries },
        },
      });
      if (exhausted > 0) {
        this.logger.error(
          `ALERT: ${exhausted} AUTHORIZED transaction(s) exhausted ${this.maxRecoveryRetries} ` +
          `capture retries — manual intervention required`,
        );
      }
    } catch (err) {
      this.logger.error(
        `recoverStuckAuthorized run failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    } finally {
      this.isAuthorizedRunning = false;
      stats.durationMs = Date.now() - startMs;
      this.logStats('recoverStuckAuthorized', stats);
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Resolve stale PENDING webhook logs (every 10 minutes)
  // ---------------------------------------------------------------------------

  @Cron(CronExpression.EVERY_10_MINUTES)
  async resolveStaleWebhookLogs(): Promise<void> {
    if (this.isWebhookRunning) return;
    this.isWebhookRunning = true;
    const startMs = Date.now();

    try {
      const staleThreshold = new Date(Date.now() - STALE_WEBHOOK_MINUTES * 60 * 1000);

      // A PENDING webhook log older than the threshold means the worker crashed
      // between persisting the log and finalizing it. Mark as FAILED so the
      // gateway can retry delivery — the retry will be deduplicated normally.
      const result = await this.prisma.webhookLog.updateMany({
        where: {
          status:     'PENDING',
          receivedAt: { lt: staleThreshold },
        },
        data: {
          status:      'FAILED',
          error:       'Processing did not complete — worker likely crashed; gateway may retry',
          processedAt: new Date(),
        },
      });

      if (result.count > 0) {
        this.logger.warn(
          `WebhookLog recovery: marked ${result.count} stale PENDING log(s) as FAILED ` +
          `(threshold=${STALE_WEBHOOK_MINUTES}min) durationMs=${Date.now() - startMs}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `resolveStaleWebhookLogs run failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    } finally {
      this.isWebhookRunning = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async incrementRetryCount(transactionId: string, nextRetryAt: Date): Promise<void> {
    await this.prisma.paymentTransaction.update({
      where: { id: transactionId },
      data:  { retryCount: { increment: 1 }, nextRetryAt },
    });
  }

  private async recordRecoveryActivity(
    transactionId: string,
    storeId:       string,
    reason:        string,
    success:       boolean,
    error?:        string,
  ): Promise<void> {
    await this.prisma.paymentActivity.create({
      data: {
        id:                   uuidv4(),
        paymentTransactionId: transactionId,
        storeId,
        activityType:         PaymentActivityType.RECOVERY_ATTEMPTED,
        actorType:            PaymentActorType.SYSTEM,
        payload: { reason, success, ...(error ? { error } : {}) } as any,
      },
    });
  }

  private logStats(operation: string, stats: RecoveryRunStats): void {
    if (stats.recovered > 0 || stats.failed > 0 || stats.skipped > 0) {
      this.logger.log(
        `${operation}: recovered=${stats.recovered} failed=${stats.failed} ` +
        `skipped=${stats.skipped} durationMs=${stats.durationMs}`,
      );
    }
  }
}
