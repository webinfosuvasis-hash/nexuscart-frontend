import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentService } from '../payment/payment.service';
import { PaymentOrchestratorService } from '../payment-orchestrator/payment-orchestrator.service';
import { WebhookSignatureService } from './webhook-signature.service';
import {
  WEBHOOK_LOG_STATUS,
  RazorpayWebhookPayload,
  StripeWebhookPayload,
} from './types/webhook.types';
import {
  InvalidPaymentTransitionException,
  PaymentInTerminalStateException,
} from '../payment/exceptions/payment.exceptions';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma:        PrismaService,
    private readonly config:        ConfigService,
    private readonly paymentSvc:    PaymentService,
    private readonly orchestrator:  PaymentOrchestratorService,
    private readonly sigSvc:        WebhookSignatureService,
  ) {}

  // ---------------------------------------------------------------------------
  // Razorpay webhook handler
  // ---------------------------------------------------------------------------

  async handleRazorpay(rawBody: Buffer, signature: string): Promise<{ received: boolean }> {
    const startMs = Date.now();

    // 1. Persist log immediately — we must always acknowledge 200 to Razorpay
    const log = await this.prisma.webhookLog.create({
      data: {
        gatewayCode: 'razorpay',
        rawBody,
        status: WEBHOOK_LOG_STATUS.PENDING,
        receivedAt: new Date(),
      },
    });

    // 2. Signature verification
    const webhookSecret = this.config.get<string>('payment.razorpay.webhookSecret', '');
    const sigResult = this.sigSvc.verifyRazorpay(rawBody, signature, webhookSecret);
    if (!sigResult.valid) {
      await this.finalizeLog(log.id, WEBHOOK_LOG_STATUS.FAILED, Date.now() - startMs, {
        error: `Signature verification failed: ${sigResult.reason ?? 'unknown'}`,
      });
      this.logger.warn(`Razorpay webhook ${log.id}: invalid signature — ${sigResult.reason}`);
      return { received: true };
    }

    // 3. Parse body
    let payload: RazorpayWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as RazorpayWebhookPayload;
    } catch {
      await this.finalizeLog(log.id, WEBHOOK_LOG_STATUS.FAILED, Date.now() - startMs, {
        error: 'JSON parse error',
      });
      return { received: true };
    }

    const eventType      = payload.event;
    const paymentEntity  = payload.payload?.payment?.entity;
    const gatewayEventId = paymentEntity ? `${eventType}:${paymentEntity.id}` : eventType;

    // 4. Stamp log with event metadata
    await this.prisma.webhookLog.update({
      where: { id: log.id },
      data:  { eventType, gatewayEventId },
    });

    // P1-3: validate before dedup — Prisma silently drops undefined filter conditions,
    // which would match any SUCCESS log for this gateway instead of the specific event.
    if (!eventType || !gatewayEventId) {
      await this.finalizeLog(log.id, WEBHOOK_LOG_STATUS.SKIPPED, Date.now() - startMs, {
        error: 'Missing event type or event ID in Razorpay payload',
      });
      return { received: true };
    }

    // 5. Duplicate detection
    const duplicate = await this.prisma.webhookLog.findFirst({
      where: {
        gatewayCode:    'razorpay',
        gatewayEventId,
        status:         WEBHOOK_LOG_STATUS.SUCCESS,
        NOT:            { id: log.id },
      },
    });
    if (duplicate) {
      await this.finalizeLog(log.id, WEBHOOK_LOG_STATUS.DUPLICATE, Date.now() - startMs);
      this.logger.log(`Razorpay webhook ${log.id}: duplicate of ${duplicate.id} — skipped`);
      return { received: true };
    }

    // 6. Locate PaymentTransaction — no storeId filter; HMAC proves authenticity
    if (!paymentEntity) {
      await this.finalizeLog(log.id, WEBHOOK_LOG_STATUS.SKIPPED, Date.now() - startMs);
      return { received: true };
    }

    const tx = await this.findTransactionByGatewayIds(paymentEntity.id, paymentEntity.order_id ?? undefined);
    if (!tx) {
      this.logger.warn(`Razorpay webhook ${log.id}: no PaymentTransaction for payment ${paymentEntity.id} / order ${paymentEntity.order_id}`);
      await this.finalizeLog(log.id, WEBHOOK_LOG_STATUS.SKIPPED, Date.now() - startMs);
      return { received: true };
    }

    // 7. Route on event type
    try {
      await this.routeRazorpayEvent(eventType, tx, paymentEntity, log.id, startMs);
    } catch (err) {
      // Out-of-order or state violations are treated as no-ops
      if (
        err instanceof InvalidPaymentTransitionException ||
        err instanceof PaymentInTerminalStateException
      ) {
        this.logger.warn(
          `Razorpay webhook ${log.id}: out-of-order event ${eventType} for tx ${tx.id} in status ${tx.status} — ${(err as Error).message}`,
        );
        await this.finalizeLog(log.id, WEBHOOK_LOG_STATUS.SUCCESS, Date.now() - startMs, {
          storeId: tx.storeId,
        });
        return { received: true };
      }
      await this.finalizeLog(log.id, WEBHOOK_LOG_STATUS.FAILED, Date.now() - startMs, {
        error: (err as Error).message,
        storeId: tx.storeId,
      });
      this.logger.error(`Razorpay webhook ${log.id}: unhandled error — ${(err as Error).message}`, (err as Error).stack);
    }

    return { received: true };
  }

  // ---------------------------------------------------------------------------
  // Stripe webhook handler
  // ---------------------------------------------------------------------------

  async handleStripe(rawBody: Buffer, signatureHeader: string): Promise<{ received: boolean }> {
    const startMs = Date.now();

    const log = await this.prisma.webhookLog.create({
      data: {
        gatewayCode: 'stripe',
        rawBody,
        status: WEBHOOK_LOG_STATUS.PENDING,
        receivedAt: new Date(),
      },
    });

    const webhookSecret = this.config.get<string>('payment.stripe.webhookSecret', '');
    const sigResult = this.sigSvc.verifyStripe(rawBody, signatureHeader, webhookSecret);
    if (!sigResult.valid) {
      await this.finalizeLog(log.id, WEBHOOK_LOG_STATUS.FAILED, Date.now() - startMs, {
        error: `Signature verification failed: ${sigResult.reason ?? 'unknown'}`,
      });
      this.logger.warn(`Stripe webhook ${log.id}: invalid signature — ${sigResult.reason}`);
      return { received: true };
    }

    let payload: StripeWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as StripeWebhookPayload;
    } catch {
      await this.finalizeLog(log.id, WEBHOOK_LOG_STATUS.FAILED, Date.now() - startMs, {
        error: 'JSON parse error',
      });
      return { received: true };
    }

    const eventType      = payload.type;
    const gatewayEventId = payload.id;  // Stripe event IDs are globally unique

    await this.prisma.webhookLog.update({
      where: { id: log.id },
      data:  { eventType, gatewayEventId },
    });

    // P1-3: validate before dedup — Prisma silently drops undefined filter conditions.
    if (!eventType || !gatewayEventId) {
      await this.finalizeLog(log.id, WEBHOOK_LOG_STATUS.SKIPPED, Date.now() - startMs, {
        error: 'Missing event type or event ID in Stripe payload',
      });
      return { received: true };
    }

    // Duplicate detection
    const duplicate = await this.prisma.webhookLog.findFirst({
      where: {
        gatewayCode:    'stripe',
        gatewayEventId,
        status:         WEBHOOK_LOG_STATUS.SUCCESS,
        NOT:            { id: log.id },
      },
    });
    if (duplicate) {
      await this.finalizeLog(log.id, WEBHOOK_LOG_STATUS.DUPLICATE, Date.now() - startMs);
      this.logger.log(`Stripe webhook ${log.id}: duplicate of ${duplicate.id} — skipped`);
      return { received: true };
    }

    // P1-2: guard against malformed payloads — runtime shape may differ from the typed interface.
    const rawData  = (payload as unknown as { data?: { object?: Record<string, unknown> } }).data;
    const dataObj  = rawData?.object;
    const intentId = typeof dataObj?.['id'] === 'string' && dataObj['id'] ? dataObj['id'] as string : '';

    if (!dataObj || !intentId) {
      await this.finalizeLog(log.id, WEBHOOK_LOG_STATUS.FAILED, Date.now() - startMs, {
        error: 'Stripe payload missing or invalid data.object.id',
      });
      this.logger.warn(`Stripe webhook ${log.id}: missing or invalid data.object.id — rejected`);
      return { received: true };
    }

    const intent      = dataObj as { id: string; amount_received?: number; status?: string };
    const gatewayIntentId = intentId;

    const tx = await this.findTransactionByGatewayIds(undefined, undefined, gatewayIntentId);
    if (!tx) {
      this.logger.warn(`Stripe webhook ${log.id}: no PaymentTransaction for intent ${gatewayIntentId}`);
      await this.finalizeLog(log.id, WEBHOOK_LOG_STATUS.SKIPPED, Date.now() - startMs);
      return { received: true };
    }

    try {
      await this.routeStripeEvent(eventType, tx, intent, log.id, startMs);
    } catch (err) {
      if (
        err instanceof InvalidPaymentTransitionException ||
        err instanceof PaymentInTerminalStateException
      ) {
        this.logger.warn(
          `Stripe webhook ${log.id}: out-of-order event ${eventType} for tx ${tx.id} — ${(err as Error).message}`,
        );
        await this.finalizeLog(log.id, WEBHOOK_LOG_STATUS.SUCCESS, Date.now() - startMs, {
          storeId: tx.storeId,
        });
        return { received: true };
      }
      await this.finalizeLog(log.id, WEBHOOK_LOG_STATUS.FAILED, Date.now() - startMs, {
        error: (err as Error).message,
        storeId: tx.storeId,
      });
      this.logger.error(`Stripe webhook ${log.id}: unhandled error — ${(err as Error).message}`, (err as Error).stack);
    }

    return { received: true };
  }

  // ---------------------------------------------------------------------------
  // Private — event routing
  // ---------------------------------------------------------------------------

  private async routeRazorpayEvent(
    eventType:     string,
    tx:            { id: string; storeId: string; status: string },
    paymentEntity: { id: string; amount: number; captured: boolean; created_at: number },
    logId:         string,
    startMs:       number,
  ): Promise<void> {
    switch (eventType) {
      case 'payment.authorized': {
        await this.paymentSvc.authorizePayment({
          transactionId:    tx.id,
          storeId:          tx.storeId,
          gatewayPaymentId: paymentEntity.id,
        });
        await this.finalizeLog(logId, WEBHOOK_LOG_STATUS.SUCCESS, Date.now() - startMs, {
          storeId: tx.storeId,
        });
        break;
      }

      case 'payment.captured': {
        await this.paymentSvc.recordGatewayCapture({
          transactionId:    tx.id,
          storeId:          tx.storeId,
          capturedPaise:    paymentEntity.amount,
          gatewayPaymentId: paymentEntity.id,
          capturedAt:       new Date(paymentEntity.created_at * 1000),
        });
        // P1-1: completePayment must succeed before the log is marked SUCCESS.
        // If it throws, the exception propagates to the outer handler → log FAILED → gateway retries.
        await this.orchestrator.completePayment(tx.id, tx.storeId);
        await this.finalizeLog(logId, WEBHOOK_LOG_STATUS.SUCCESS, Date.now() - startMs, {
          storeId: tx.storeId,
        });
        break;
      }

      case 'payment.failed': {
        await this.paymentSvc.recordGatewayFailure(
          tx.id,
          tx.storeId,
          `Razorpay payment.failed webhook for payment ${paymentEntity.id}`,
        );
        await this.finalizeLog(logId, WEBHOOK_LOG_STATUS.SUCCESS, Date.now() - startMs, {
          storeId: tx.storeId,
        });
        break;
      }

      default: {
        this.logger.log(`Razorpay webhook ${logId}: unhandled event type ${eventType} — skipped`);
        await this.finalizeLog(logId, WEBHOOK_LOG_STATUS.SKIPPED, Date.now() - startMs, {
          storeId: tx.storeId,
        });
      }
    }
  }

  private async routeStripeEvent(
    eventType: string,
    tx:        { id: string; storeId: string; status: string },
    intent:    { id: string; amount_received?: number; status?: string },
    logId:     string,
    startMs:   number,
  ): Promise<void> {
    switch (eventType) {
      case 'payment_intent.succeeded': {
        // P2-3: validate captured amount — zero, negative, or non-integer must never be recorded.
        const capturedPaise = intent.amount_received;
        if (
          typeof capturedPaise !== 'number' ||
          !Number.isInteger(capturedPaise)  ||
          capturedPaise <= 0
        ) {
          this.logger.error(
            `Stripe webhook ${logId}: invalid amount_received=${capturedPaise} for intent ${intent.id} — refusing capture`,
          );
          await this.finalizeLog(logId, WEBHOOK_LOG_STATUS.FAILED, Date.now() - startMs, {
            storeId: tx.storeId,
            error:   `Invalid amount_received: ${capturedPaise}`,
          });
          return;
        }
        await this.paymentSvc.recordGatewayCapture({
          transactionId:    tx.id,
          storeId:          tx.storeId,
          capturedPaise,
          gatewayPaymentId: intent.id,
          capturedAt:       new Date(),
        });
        // P1-1: completePayment must succeed before the log is marked SUCCESS.
        await this.orchestrator.completePayment(tx.id, tx.storeId);
        await this.finalizeLog(logId, WEBHOOK_LOG_STATUS.SUCCESS, Date.now() - startMs, {
          storeId: tx.storeId,
        });
        break;
      }

      case 'payment_intent.payment_failed': {
        await this.paymentSvc.recordGatewayFailure(
          tx.id,
          tx.storeId,
          `Stripe payment_intent.payment_failed for intent ${intent.id}`,
        );
        await this.finalizeLog(logId, WEBHOOK_LOG_STATUS.SUCCESS, Date.now() - startMs, {
          storeId: tx.storeId,
        });
        break;
      }

      default: {
        this.logger.log(`Stripe webhook ${logId}: unhandled event type ${eventType} — skipped`);
        await this.finalizeLog(logId, WEBHOOK_LOG_STATUS.SKIPPED, Date.now() - startMs, {
          storeId: tx.storeId,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private — helpers
  // ---------------------------------------------------------------------------

  /**
   * Find a PaymentTransaction by any of the gateway identifiers.
   * No storeId filter — HMAC verification already authenticated the source.
   */
  private async findTransactionByGatewayIds(
    gatewayPaymentId?: string,
    gatewayOrderId?:   string,
    gatewayIntentId?:  string,
  ) {
    const orClauses = [
      gatewayPaymentId ? { gatewayPaymentId } : null,
      gatewayOrderId   ? { gatewayOrderId }   : null,
      gatewayIntentId  ? { gatewayIntentId }  : null,
    ].filter((c): c is NonNullable<typeof c> => c !== null);

    if (orClauses.length === 0) return null;

    return this.prisma.paymentTransaction.findFirst({
      where: { OR: orClauses },
      select: {
        id:      true,
        storeId: true,
        status:  true,
      },
    });
  }

  private async finalizeLog(
    logId:        string,
    status:       string,
    processingMs: number,
    extra?: {
      error?:   string;
      storeId?: string;
    },
  ): Promise<void> {
    await this.prisma.webhookLog.update({
      where: { id: logId },
      data: {
        status,
        processingMs,
        processedAt: new Date(),
        ...(extra?.error   ? { error:   extra.error }   : {}),
        ...(extra?.storeId ? { storeId: extra.storeId } : {}),
      },
    });
  }
}
