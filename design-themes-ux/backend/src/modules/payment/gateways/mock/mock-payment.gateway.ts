import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentTxStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import { GatewayInitializationException } from '../../exceptions/payment.exceptions';
import { GatewayStatusQueryContext } from '../../types/gateway-status-query.context';
import {
  CaptureInput,
  CaptureResult,
  GatewayCapability,
  InitiatePaymentInput,
  PaymentGatewayResult,
  RefundInput,
  RefundResult,
  VerificationResult,
} from '../../types/payment.types';
import { GatewayCapabilities, PaymentGateway } from '../payment-gateway.interface';
import { MockBehavior } from '../../config/payment.config';

@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  readonly capabilities: GatewayCapabilities = {
    gatewayCode: 'mock',
    displayName: 'Mock Payment Gateway (Dev/Test)',
    supports: new Set([
      GatewayCapability.AUTHORIZE_THEN_CAPTURE,
      GatewayCapability.DIRECT_CAPTURE,
      GatewayCapability.REFUND,
      GatewayCapability.PARTIAL_REFUND,
      GatewayCapability.STATUS_QUERY,
      GatewayCapability.CANCEL,
      GatewayCapability.WEBHOOK,
    ]),
    isLiveCapable: false,
    requiresWebhook: false,
    webhookSignatureAlgorithm: 'HMAC-SHA256',
  };

  constructor(private readonly configService: ConfigService) {}

  private get behavior(): MockBehavior {
    return this.configService.get<MockBehavior>('payment.mock.behavior', 'success');
  }

  private get delayMs(): number {
    return this.configService.get<number>('payment.mock.delayMs', 0);
  }

  private async simulate<T>(result: T): Promise<T> {
    const ms = this.delayMs;
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
    return result;
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<PaymentGatewayResult> {
    const behavior = this.behavior;

    if (behavior === 'timeout') {
      throw new GatewayInitializationException('mock', new Error('Simulated gateway timeout'));
    }

    if (behavior === 'fail') {
      return this.simulate({
        success: false,
        gatewayCode: 'mock',
        error: {
          code: 'MOCK_PAYMENT_FAILED',
          message: 'Mock gateway configured to fail',
          isRetryable: false,
          gatewayRawCode: 'MOCK_FAIL',
          gatewayRawMessage: 'Mock failure',
        },
      });
    }

    const gatewayOrderId = `mock_order_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    if (behavior === 'success') {
      const gatewayPaymentId = `mock_pay_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
      return this.simulate({
        success: true,
        gatewayCode: 'mock',
        gatewayOrderId,
        gatewayPaymentId,
      });
    }

    // authorize_capture: return order ID only; payment ID comes after authorization
    return this.simulate({
      success: true,
      gatewayCode: 'mock',
      gatewayOrderId,
    });
  }

  async capturePayment(input: CaptureInput): Promise<CaptureResult> {
    const behavior = this.behavior;

    if (behavior === 'fail') {
      return this.simulate({
        success: false,
        gatewayCode: 'mock',
        capturedPaise: 0,
        capturedAt: new Date(),
        error: {
          code: 'MOCK_CAPTURE_FAILED',
          message: 'Mock capture failed',
          isRetryable: false,
        },
      });
    }

    return this.simulate({
      success: true,
      gatewayCode: 'mock',
      gatewayOrderId: input.gatewayOrderId,
      gatewayPaymentId:
        input.gatewayPaymentId ??
        `mock_pay_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
      capturedPaise: input.amountInPaise,
      capturedAt: new Date(),
    });
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    return this.simulate({
      success: true,
      gatewayCode: 'mock',
      gatewayRefundId: `mock_refund_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
      refundedPaise: input.amountInPaise,
      refundedAt: new Date(),
    });
  }

  async verifyPayment(context: GatewayStatusQueryContext): Promise<VerificationResult> {
    const behavior = this.behavior;

    const resolvedStatus: PaymentTxStatus =
      behavior === 'fail'
        ? PaymentTxStatus.FAILED
        : behavior === 'authorize_capture'
          ? PaymentTxStatus.AUTHORIZED
          : PaymentTxStatus.CAPTURED;

    return this.simulate({
      success: true,
      gatewayCode: 'mock',
      gatewayOrderId: context.gatewayOrderId,
      gatewayPaymentId: context.gatewayPaymentId,
      resolvedStatus,
      rawGatewayStatus: behavior,
    });
  }

  async cancelPayment(context: GatewayStatusQueryContext): Promise<PaymentGatewayResult> {
    return this.simulate({
      success: true,
      gatewayCode: 'mock',
      gatewayOrderId: context.gatewayOrderId,
      gatewayPaymentId: context.gatewayPaymentId,
    });
  }
}
