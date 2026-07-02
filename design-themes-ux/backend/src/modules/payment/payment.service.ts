import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  PaymentActorType,
  PaymentActivityType,
  PaymentRefund,
  PaymentTransaction,
  PaymentTxStatus,
  Prisma,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { v4 as uuidv4 } from 'uuid';

import { PrismaService } from '../../prisma/prisma.service';
import { PaymentGatewayRegistry } from './gateways/payment-gateway-registry.service';
import { PaymentStateValidatorService } from './state/payment-state-validator.service';
import {
  GatewayInitializationException,
  IdempotencyViolationException,
  InvalidPaymentTransitionException,
  PaymentAlreadyRefundedException,
  PaymentException,
} from './exceptions/payment.exceptions';
import {
  AuthorizePaymentInput,
  CapturePaymentInput,
  CreatePaymentAttemptInput,
  CustomerInfo,
  GatewayCaptureInput,
  RefundPaymentInput,
  RefundPaymentResult,
  RetryPaymentInput,
  StartPaymentResult,
} from './dto/payment-service.types';
import { CaptureResult, PaymentGatewayResult, RefundResult } from './types/payment.types';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PaymentGatewayRegistry,
    private readonly stateValidator: PaymentStateValidatorService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. createPaymentAttempt
  // ---------------------------------------------------------------------------

  async createPaymentAttempt(input: CreatePaymentAttemptInput): Promise<PaymentTransaction> {
    const idemKey = `payment:create:${input.checkoutSessionId}:${input.idempotencyKey}`;

    const existing = await this.prisma.idempotencyRecord.findUnique({ where: { key: idemKey } });
    if (existing && existing.expiresAt > new Date()) {
      const tx = await this.prisma.paymentTransaction.findFirst({
        where: { checkoutSessionId: input.checkoutSessionId, storeId: input.storeId },
        orderBy: { createdAt: 'desc' },
      });
      if (tx) return tx;
    }

    this.registry.resolve(input.gatewayCode);

    const tx = await this.prisma.paymentTransaction.create({
      data: {
        storeId: input.storeId,
        checkoutSessionId: input.checkoutSessionId,
        gatewayCode: input.gatewayCode,
        amountInPaise: input.amountInPaise,
        currency: input.currency ?? 'INR',
        paymentMethodId: input.paymentMethodId ?? null,
      },
    });

    await this.recordActivity(
      { id: tx.id, storeId: tx.storeId },
      PaymentActivityType.PAYMENT_INITIATED,
      { amountInPaise: tx.amountInPaise, gatewayCode: tx.gatewayCode, currency: tx.currency },
    );

    // P1-2: catch concurrent unique constraint violation on idempotency key
    try {
      await this.prisma.idempotencyRecord.create({
        data: {
          key: idemKey,
          storeId: input.storeId,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        return tx;
      }
      throw err;
    }

    return tx;
  }

  // ---------------------------------------------------------------------------
  // 2. startPayment
  // ---------------------------------------------------------------------------

  async startPayment(
    transactionId: string,
    storeId: string,
    idempotencyKey: string,
    customerInfo?: CustomerInfo,
  ): Promise<StartPaymentResult> {
    const tx = await this.findOrThrow(transactionId, storeId);

    if (tx.status === PaymentTxStatus.GATEWAY_CREATED) {
      return {
        transaction: tx,
        gatewayOrderId: tx.gatewayOrderId ?? undefined,
        gatewayPaymentId: tx.gatewayPaymentId ?? undefined,
        gatewayIntentId: tx.gatewayIntentId ?? undefined,
      };
    }

    this.stateValidator.assertCanTransition(tx.status, PaymentTxStatus.GATEWAY_CREATED, tx.id);

    const gateway = this.registry.resolve(tx.gatewayCode);

    // P1-3: catch gateway throws and transition to FAILED
    let result: PaymentGatewayResult;
    try {
      result = await gateway.initiatePayment({
        transactionId: tx.id,
        checkoutSessionId: tx.checkoutSessionId,
        storeId: tx.storeId,
        amountInPaise: tx.amountInPaise,
        currency: tx.currency,
        idempotencyKey,
        customerEmail: customerInfo?.email,
        customerPhone: customerInfo?.phone,
        customerName: customerInfo?.name,
      });
    } catch (err) {
      const failed = await this.transitionStatus(tx, PaymentTxStatus.FAILED, {
        failedAt: new Date(),
      });
      await this.recordActivity(
        { id: failed.id, storeId: failed.storeId },
        PaymentActivityType.PAYMENT_FAILED,
        { error: String(err), operation: 'initiate' },
      );
      throw err instanceof PaymentException
        ? err
        : new GatewayInitializationException(tx.gatewayCode, err as Error);
    }

    if (!result.success) {
      const failed = await this.transitionStatus(tx, PaymentTxStatus.FAILED, {
        failedAt: new Date(),
      });
      await this.recordActivity(
        { id: failed.id, storeId: failed.storeId },
        PaymentActivityType.PAYMENT_FAILED,
        { error: result.error, operation: 'initiate' },
      );
      return { transaction: failed };
    }

    const updated = await this.transitionStatus(tx, PaymentTxStatus.GATEWAY_CREATED, {
      gatewayOrderId: result.gatewayOrderId ?? null,
      gatewayPaymentId: result.gatewayPaymentId ?? null,
      gatewayIntentId: result.gatewayIntentId ?? null,
      gatewayReferenceId: result.gatewayReferenceId ?? null,
    });

    await this.recordActivity(
      { id: updated.id, storeId: updated.storeId },
      PaymentActivityType.GATEWAY_ORDER_CREATED,
      {
        gatewayOrderId: result.gatewayOrderId,
        gatewayPaymentId: result.gatewayPaymentId,
        gatewayIntentId: result.gatewayIntentId,
      },
    );

    return {
      transaction: updated,
      gatewayOrderId: result.gatewayOrderId,
      gatewayPaymentId: result.gatewayPaymentId,
      gatewayIntentId: result.gatewayIntentId,
      redirectUrl: result.redirectUrl,
      clientSecret: result.clientSecret,
    };
  }

  // ---------------------------------------------------------------------------
  // 3. authorizePayment
  // ---------------------------------------------------------------------------

  async authorizePayment(input: AuthorizePaymentInput): Promise<PaymentTransaction> {
    const tx = await this.findOrThrow(input.transactionId, input.storeId);

    if (tx.status === PaymentTxStatus.AUTHORIZED) return tx;

    this.stateValidator.assertCanTransition(tx.status, PaymentTxStatus.AUTHORIZED, tx.id);

    const updated = await this.transitionStatus(tx, PaymentTxStatus.AUTHORIZED, {
      gatewayPaymentId: input.gatewayPaymentId,
      ...(input.gatewaySignature !== undefined ? { gatewaySignature: input.gatewaySignature } : {}),
      authorizedAt: new Date(),
    });

    await this.recordActivity(
      { id: updated.id, storeId: updated.storeId },
      PaymentActivityType.PAYMENT_AUTHORIZED,
      { gatewayPaymentId: input.gatewayPaymentId },
    );

    return updated;
  }

  // ---------------------------------------------------------------------------
  // 4. capturePayment
  // ---------------------------------------------------------------------------

  async capturePayment(input: CapturePaymentInput): Promise<PaymentTransaction> {
    const tx = await this.findOrThrow(input.transactionId, input.storeId);

    if (tx.status === PaymentTxStatus.CAPTURED) return tx;

    this.stateValidator.assertCanTransition(tx.status, PaymentTxStatus.CAPTURED, tx.id);

    const idemKey = `payment:capture:${tx.id}:${input.idempotencyKey}`;
    const idemRecord = await this.prisma.idempotencyRecord.findUnique({ where: { key: idemKey } });

    if (idemRecord && idemRecord.expiresAt > new Date()) {
      // P0-2: verify tx is actually CAPTURED before returning — prior attempt may have thrown
      const freshTx = await this.findOrThrow(tx.id, tx.storeId);
      if (freshTx.status === PaymentTxStatus.CAPTURED) return freshTx;
      // Still AUTHORIZED: idem record was written but gateway call failed — fall through to retry
    } else {
      // P1-2: catch concurrent unique constraint violation
      try {
        await this.prisma.idempotencyRecord.create({
          data: {
            key: idemKey,
            storeId: tx.storeId,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      } catch (err) {
        if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
          const freshTx = await this.findOrThrow(tx.id, tx.storeId);
          if (freshTx.status === PaymentTxStatus.CAPTURED) return freshTx;
          throw new ConflictException(`Concurrent capture attempt for transaction ${tx.id}`);
        }
        throw err;
      }
    }

    const gateway = this.registry.resolve(tx.gatewayCode);

    // P1-3: catch gateway throws
    let captureResult: CaptureResult;
    try {
      captureResult = await gateway.capturePayment({
        transactionId: tx.id,
        storeId: tx.storeId,
        amountInPaise: tx.amountInPaise,
        gatewayOrderId: tx.gatewayOrderId ?? undefined,
        gatewayPaymentId: tx.gatewayPaymentId ?? undefined,
        gatewayIntentId: tx.gatewayIntentId ?? undefined,
        idempotencyKey: input.idempotencyKey,
      });
    } catch (err) {
      await this.recordActivity(
        { id: tx.id, storeId: tx.storeId },
        PaymentActivityType.PAYMENT_FAILED,
        { error: String(err), operation: 'capture' },
      );
      throw err instanceof PaymentException
        ? err
        : new GatewayInitializationException(tx.gatewayCode, err as Error);
    }

    if (!captureResult.success) {
      await this.recordActivity(
        { id: tx.id, storeId: tx.storeId },
        PaymentActivityType.PAYMENT_FAILED,
        { error: captureResult.error, operation: 'capture' },
      );
      return this.findOrThrow(tx.id, tx.storeId);
    }

    const updated = await this.transitionStatus(tx, PaymentTxStatus.CAPTURED, {
      capturedPaise: captureResult.capturedPaise,
      capturedAt: captureResult.capturedAt ?? new Date(),
      ...(captureResult.gatewayPaymentId !== undefined
        ? { gatewayPaymentId: captureResult.gatewayPaymentId }
        : {}),
    });

    await this.recordActivity(
      { id: updated.id, storeId: updated.storeId },
      PaymentActivityType.PAYMENT_CAPTURED,
      { capturedPaise: captureResult.capturedPaise, gatewayPaymentId: captureResult.gatewayPaymentId },
    );

    return updated;
  }

  // ---------------------------------------------------------------------------
  // 5. cancelPayment
  // ---------------------------------------------------------------------------

  async cancelPayment(transactionId: string, storeId: string): Promise<PaymentTransaction> {
    const tx = await this.findOrThrow(transactionId, storeId);

    if (tx.status === PaymentTxStatus.CANCELLED) return tx;

    this.stateValidator.assertCanTransition(tx.status, PaymentTxStatus.CANCELLED, tx.id);

    const gateway = this.registry.resolve(tx.gatewayCode);

    // P1-3: catch gateway throws and transition to FAILED
    try {
      await gateway.cancelPayment({
        gatewayOrderId: tx.gatewayOrderId ?? undefined,
        gatewayPaymentId: tx.gatewayPaymentId ?? undefined,
        amountInPaise: tx.amountInPaise,
        storeId: tx.storeId,
      });
    } catch (err) {
      const failed = await this.transitionStatus(tx, PaymentTxStatus.FAILED, {
        failedAt: new Date(),
      });
      await this.recordActivity(
        { id: failed.id, storeId: failed.storeId },
        PaymentActivityType.PAYMENT_FAILED,
        { error: String(err), operation: 'cancel' },
      );
      throw err instanceof PaymentException
        ? err
        : new GatewayInitializationException(tx.gatewayCode, err as Error);
    }

    const updated = await this.transitionStatus(tx, PaymentTxStatus.CANCELLED, {
      cancelledAt: new Date(),
    });

    await this.recordActivity(
      { id: updated.id, storeId: updated.storeId },
      PaymentActivityType.PAYMENT_CANCELLED,
      {},
    );

    return updated;
  }

  // ---------------------------------------------------------------------------
  // 6. refundPayment
  // ---------------------------------------------------------------------------

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    const ptx = await this.findOrThrow(input.transactionId, input.storeId);

    const refundableStatuses: PaymentTxStatus[] = [
      PaymentTxStatus.CAPTURED,
      PaymentTxStatus.PARTIALLY_REFUNDED,
    ];
    if (!refundableStatuses.includes(ptx.status)) {
      this.stateValidator.assertCanTransition(ptx.status, PaymentTxStatus.REFUNDED, ptx.id);
    }

    const capturedAmount = ptx.capturedPaise ?? ptx.amountInPaise;
    const idemKey = `payment:refund:${ptx.id}:${input.idempotencyKey}`;

    // P1-6: idempotency check with PENDING refund handling
    const idemRecord = await this.prisma.idempotencyRecord.findUnique({ where: { key: idemKey } });
    if (idemRecord && idemRecord.expiresAt > new Date()) {
      const existingRefund = await this.prisma.paymentRefund.findFirst({
        where: { paymentTransactionId: ptx.id },
        orderBy: { createdAt: 'desc' },
      });
      if (existingRefund?.status === 'COMPLETED') {
        return { transaction: await this.findOrThrow(ptx.id, ptx.storeId), refund: existingRefund };
      }
      // PENDING: Phase 1 committed but gateway call was interrupted — fall through to Phase 2
      if (existingRefund?.status === 'PENDING') {
        return this.runRefundPhase2(ptx, existingRefund, capturedAmount, input);
      }
      // FAILED or missing: Phase 1 may have rolled back — idem record exists, skip re-creation
    }

    // P1-5: Phase 1 — claim refund slot atomically under Serializable isolation
    // This prevents concurrent requests with different keys from double-refunding.
    let alreadyRefunded = 0;
    const pendingRefund = await this.prisma.$transaction(
      async (txClient) => {
        const reservedRefunds = await txClient.paymentRefund.findMany({
          where: { paymentTransactionId: ptx.id, status: { not: 'FAILED' } },
          select: { amountInPaise: true },
        });
        alreadyRefunded = reservedRefunds.reduce((sum, r) => sum + r.amountInPaise, 0);

        if (input.amountInPaise > capturedAmount - alreadyRefunded) {
          throw new PaymentAlreadyRefundedException(ptx.id);
        }

        // P1-2: only create idem record if it doesn't already exist (P1-6 fallthrough case)
        if (!idemRecord) {
          try {
            await txClient.idempotencyRecord.create({
              data: {
                key: idemKey,
                storeId: ptx.storeId,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              },
            });
          } catch (err) {
            if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
              throw new IdempotencyViolationException(idemKey);
            }
            throw err;
          }
        }

        await txClient.paymentActivity.create({
          data: {
            id: uuidv4(),
            paymentTransactionId: ptx.id,
            storeId: ptx.storeId,
            activityType: PaymentActivityType.PAYMENT_REFUND_INITIATED,
            actorType: PaymentActorType.SYSTEM,
            payload: { amountInPaise: input.amountInPaise, reason: input.reason ?? null } as any,
          },
        });

        return txClient.paymentRefund.create({
          data: {
            paymentTransactionId: ptx.id,
            storeId: ptx.storeId,
            amountInPaise: input.amountInPaise,
            reason: input.reason ?? null,
            status: 'PENDING',
            gatewayRefundId: null,
            processedAt: null,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.runRefundPhase2(ptx, pendingRefund, capturedAmount, input, alreadyRefunded);
  }

  // Phase 2: gateway call + persist result. Called after the PENDING refund slot is claimed.
  private async runRefundPhase2(
    ptx: PaymentTransaction,
    pendingRefund: PaymentRefund,
    capturedAmount: number,
    input: RefundPaymentInput,
    alreadyRefunded?: number,
  ): Promise<RefundPaymentResult> {
    const gateway = this.registry.resolve(ptx.gatewayCode);

    // P1-3: catch gateway throws
    let gatewayResult: RefundResult;
    try {
      gatewayResult = await gateway.refundPayment({
        transactionId: ptx.id,
        storeId: ptx.storeId,
        amountInPaise: input.amountInPaise,
        reason: input.reason,
        gatewayPaymentId: ptx.gatewayPaymentId ?? undefined,
        gatewayOrderId: ptx.gatewayOrderId ?? undefined,
        idempotencyKey: input.idempotencyKey,
      });
    } catch (err) {
      await this.prisma.paymentRefund.update({
        where: { id: pendingRefund.id },
        data: { status: 'FAILED', processedAt: new Date() },
      });
      await this.recordActivity(
        { id: ptx.id, storeId: ptx.storeId },
        PaymentActivityType.PAYMENT_FAILED,
        { error: String(err), operation: 'refund' },
      );
      throw err instanceof PaymentException
        ? err
        : new GatewayInitializationException(ptx.gatewayCode, err as Error);
    }

    if (!gatewayResult.success) {
      const failedRefund = await this.prisma.paymentRefund.update({
        where: { id: pendingRefund.id },
        data: {
          status: 'FAILED',
          gatewayRefundId: gatewayResult.gatewayRefundId ?? null,
          processedAt: new Date(),
        },
      });
      await this.recordActivity(
        { id: ptx.id, storeId: ptx.storeId },
        PaymentActivityType.PAYMENT_FAILED,
        { error: gatewayResult.error, operation: 'refund' },
      );
      return { transaction: ptx, refund: failedRefund };
    }

    const refundedPaise = gatewayResult.refundedPaise ?? input.amountInPaise;

    // Compute total to determine new status
    let totalRefunded: number;
    if (alreadyRefunded !== undefined) {
      totalRefunded = alreadyRefunded + refundedPaise;
    } else {
      // Idem-retry path: recompute from DB (pending refund is still PENDING, not counted yet)
      const completed = await this.prisma.paymentRefund.findMany({
        where: { paymentTransactionId: ptx.id, status: 'COMPLETED' },
        select: { amountInPaise: true },
      });
      totalRefunded = completed.reduce((sum, r) => sum + r.amountInPaise, 0) + refundedPaise;
    }

    const newStatus =
      totalRefunded >= capturedAmount
        ? PaymentTxStatus.REFUNDED
        : PaymentTxStatus.PARTIALLY_REFUNDED;

    const completedRefund = await this.prisma.paymentRefund.update({
      where: { id: pendingRefund.id },
      data: {
        status: 'COMPLETED',
        gatewayRefundId: gatewayResult.gatewayRefundId ?? null,
        processedAt: gatewayResult.refundedAt ?? new Date(),
      },
    });

    // P0-1: PARTIALLY_REFUNDED → PARTIALLY_REFUNDED is not in the state machine.
    // Skip transitionStatus when the status does not change.
    let updated: PaymentTransaction;
    if (newStatus !== ptx.status) {
      updated = await this.transitionStatus(ptx, newStatus, {
        ...(newStatus === PaymentTxStatus.REFUNDED ? { refundedAt: new Date() } : {}),
      });
    } else {
      updated = await this.findOrThrow(ptx.id, ptx.storeId);
    }

    await this.recordActivity(
      { id: updated.id, storeId: updated.storeId },
      PaymentActivityType.PAYMENT_REFUND_PROCESSED,
      {
        amountInPaise: refundedPaise,
        gatewayRefundId: gatewayResult.gatewayRefundId,
        newStatus,
        totalRefunded,
      },
    );

    return { transaction: updated, refund: completedRefund };
  }

  // ---------------------------------------------------------------------------
  // 7. retryPayment
  // ---------------------------------------------------------------------------

  async retryPayment(input: RetryPaymentInput): Promise<StartPaymentResult> {
    const original = await this.findOrThrow(input.transactionId, input.storeId);

    if (!this.stateValidator.isTerminal(original.status)) {
      throw new InvalidPaymentTransitionException(
        original.status,
        PaymentTxStatus.PENDING,
        original.id,
      );
    }

    // P1-4: atomically create new tx and mark the original as superseded
    const newTx = await this.prisma.$transaction(async (txClient) => {
      const created = await txClient.paymentTransaction.create({
        data: {
          storeId: original.storeId,
          checkoutSessionId: original.checkoutSessionId,
          gatewayCode: input.gatewayCode ?? original.gatewayCode,
          amountInPaise: original.amountInPaise,
          currency: original.currency,
          paymentMethodId: original.paymentMethodId ?? null,
          attemptNumber: original.attemptNumber + 1,
        },
      });
      await txClient.paymentTransaction.update({
        where: { id: original.id },
        data: { supersededById: created.id },
      });
      return created;
    });

    await this.recordActivity(
      { id: original.id, storeId: original.storeId },
      PaymentActivityType.RECOVERY_ATTEMPTED,
      { newTransactionId: newTx.id, attemptNumber: newTx.attemptNumber },
    );

    return this.startPayment(newTx.id, newTx.storeId, input.idempotencyKey, input.customerInfo);
  }

  // ---------------------------------------------------------------------------
  // 8. getPayment
  // ---------------------------------------------------------------------------

  async getPayment(transactionId: string, storeId: string): Promise<PaymentTransaction> {
    return this.findOrThrow(transactionId, storeId);
  }

  // ---------------------------------------------------------------------------
  // 9. getPaymentHistory
  // ---------------------------------------------------------------------------

  async getPaymentHistory(
    checkoutSessionId: string,
    storeId: string,
  ): Promise<PaymentTransaction[]> {
    return this.prisma.paymentTransaction.findMany({
      where: { checkoutSessionId, storeId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ---------------------------------------------------------------------------
  // 10. recordGatewayCapture  (webhook path — no outbound gateway call)
  // ---------------------------------------------------------------------------

  /**
   * Records a capture event that originated from the gateway webhook.
   * Does NOT call gateway.capturePayment() — the payment is already captured upstream.
   * All state transitions pass through the standard optimistic-lock path in transitionStatus.
   * Idempotent: returns existing tx if already at CAPTURED or beyond.
   */
  async recordGatewayCapture(input: GatewayCaptureInput): Promise<PaymentTransaction> {
    const tx = await this.findOrThrow(input.transactionId, input.storeId);

    // Already at or past CAPTURED — idempotent
    if (
      tx.status === PaymentTxStatus.CAPTURED          ||
      tx.status === PaymentTxStatus.PARTIALLY_REFUNDED ||
      this.stateValidator.isTerminal(tx.status)
    ) {
      return tx;
    }

    this.stateValidator.assertCanTransition(tx.status, PaymentTxStatus.CAPTURED, tx.id);

    const updated = await this.transitionStatus(tx, PaymentTxStatus.CAPTURED, {
      capturedPaise: input.capturedPaise,
      capturedAt:    input.capturedAt,
      ...(input.gatewayPaymentId !== undefined
        ? { gatewayPaymentId: input.gatewayPaymentId }
        : {}),
    });

    await this.recordActivity(
      { id: updated.id, storeId: updated.storeId },
      PaymentActivityType.PAYMENT_CAPTURED,
      {
        capturedPaise:    input.capturedPaise,
        gatewayPaymentId: input.gatewayPaymentId,
        source:           'webhook',
      },
    );

    return updated;
  }

  // ---------------------------------------------------------------------------
  // 11. recordGatewayFailure  (webhook path — no outbound gateway call)
  // ---------------------------------------------------------------------------

  /**
   * Records a failure event that originated from the gateway webhook.
   * Idempotent: returns existing tx if already terminal or past capture.
   */
  async recordGatewayFailure(
    transactionId: string,
    storeId:       string,
    reason:        string,
  ): Promise<PaymentTransaction> {
    const tx = await this.findOrThrow(transactionId, storeId);

    if (this.stateValidator.isTerminal(tx.status)) return tx;

    if (
      tx.status === PaymentTxStatus.CAPTURED          ||
      tx.status === PaymentTxStatus.PARTIALLY_REFUNDED
    ) {
      this.logger.warn(
        `recordGatewayFailure: tx ${transactionId} is in ${tx.status} — out-of-order, ignored`,
      );
      return tx;
    }

    this.stateValidator.assertCanTransition(tx.status, PaymentTxStatus.FAILED, tx.id);

    const updated = await this.transitionStatus(tx, PaymentTxStatus.FAILED, { failedAt: new Date() });

    await this.recordActivity(
      { id: updated.id, storeId: updated.storeId },
      PaymentActivityType.PAYMENT_FAILED,
      { reason, source: 'webhook' },
    );

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async findOrThrow(transactionId: string, storeId: string): Promise<PaymentTransaction> {
    const tx = await this.prisma.paymentTransaction.findFirst({
      where: { id: transactionId, storeId },
    });
    if (!tx) {
      throw new NotFoundException(`PaymentTransaction ${transactionId} not found`);
    }
    return tx;
  }

  private async transitionStatus(
    tx: PaymentTransaction,
    toStatus: PaymentTxStatus,
    updateData: Record<string, unknown> = {},
  ): Promise<PaymentTransaction> {
    this.stateValidator.assertCanTransition(tx.status, toStatus, tx.id);

    const { count } = await this.prisma.paymentTransaction.updateMany({
      where: { id: tx.id, status: tx.status },
      data: { status: toStatus, ...updateData } as any,
    });

    if (count === 0) {
      const fresh = await this.findOrThrow(tx.id, tx.storeId);
      if (fresh.status === toStatus) return fresh;
      throw new ConflictException(
        `PaymentTransaction ${tx.id} was concurrently modified (expected ${tx.status}, found ${fresh.status})`,
      );
    }

    return this.findOrThrow(tx.id, tx.storeId);
  }

  private async recordActivity(
    tx: { id: string; storeId: string },
    activityType: PaymentActivityType,
    payload: Record<string, unknown>,
    actorType: PaymentActorType = PaymentActorType.SYSTEM,
  ): Promise<void> {
    await this.prisma.paymentActivity.create({
      data: {
        id: uuidv4(),
        paymentTransactionId: tx.id,
        storeId: tx.storeId,
        activityType,
        actorType,
        payload: payload as any,
      },
    });
  }
}
