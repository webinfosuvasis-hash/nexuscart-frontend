import { Injectable } from '@nestjs/common';
import { PaymentTxStatus } from '@prisma/client';

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

/**
 * Cash-on-Delivery gateway.
 *
 * No external API calls are made. Initiation succeeds immediately.
 * COD does not have authorize-then-capture: the "capture" event is
 * delivery confirmation, which logistics triggers externally. From the
 * payment gateway perspective this is DIRECT_CAPTURE.
 *
 * Refunds for COD are bank transfers arranged out-of-band; we record
 * them in the system but no API call is made.
 */
@Injectable()
export class CodPaymentGateway implements PaymentGateway {
  readonly capabilities: GatewayCapabilities = {
    gatewayCode: 'cod',
    displayName: 'Cash on Delivery',
    supports: new Set([
      GatewayCapability.DIRECT_CAPTURE,
      GatewayCapability.CANCEL,
      GatewayCapability.REFUND,
    ]),
    isLiveCapable: true,
    requiresWebhook: false,
  };

  async initiatePayment(input: InitiatePaymentInput): Promise<PaymentGatewayResult> {
    return {
      success: true,
      gatewayCode: 'cod',
      gatewayOrderId: `cod_${input.transactionId}`,
    };
  }

  async capturePayment(input: CaptureInput): Promise<CaptureResult> {
    return {
      success: true,
      gatewayCode: 'cod',
      gatewayOrderId: input.gatewayOrderId,
      capturedPaise: input.amountInPaise,
      capturedAt: new Date(),
    };
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    return {
      success: true,
      gatewayCode: 'cod',
      gatewayRefundId: `cod_refund_${input.transactionId}_${Date.now()}`,
      refundedPaise: input.amountInPaise,
      refundedAt: new Date(),
    };
  }

  async verifyPayment(context: GatewayStatusQueryContext): Promise<VerificationResult> {
    return {
      success: true,
      gatewayCode: 'cod',
      gatewayOrderId: context.gatewayOrderId,
      resolvedStatus: PaymentTxStatus.GATEWAY_CREATED,
      rawGatewayStatus: 'cod_pending_delivery',
    };
  }

  async cancelPayment(context: GatewayStatusQueryContext): Promise<PaymentGatewayResult> {
    return {
      success: true,
      gatewayCode: 'cod',
      gatewayOrderId: context.gatewayOrderId,
    };
  }
}
