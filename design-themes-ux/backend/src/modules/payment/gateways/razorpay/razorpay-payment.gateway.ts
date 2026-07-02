import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

import {
  GatewayVerificationException,
} from '../../exceptions/payment.exceptions';
import { GatewayStatusQueryContext } from '../../types/gateway-status-query.context';
import {
  CaptureInput,
  CaptureResult,
  GatewayCapability,
  GatewayError,
  InitiatePaymentInput,
  PaymentGatewayResult,
  RefundInput,
  RefundResult,
  VerificationResult,
} from '../../types/payment.types';
import { GatewayCapabilities, PaymentGateway } from '../payment-gateway.interface';
import { resolveRazorpayRefundStatus } from './razorpay-status.mapper';

// ---------------------------------------------------------------------------
// Minimal Razorpay client interface (SDK has no bundled @types)
// ---------------------------------------------------------------------------

interface RazorpayOrderParams {
  amount: number;
  currency: string;
  receipt: string;
  payment_capture?: 0 | 1;
  notes?: Record<string, string>;
}

interface RazorpayClient {
  orders: {
    create(params: RazorpayOrderParams): Promise<any>;
    fetchPayments(orderId: string): Promise<{ items: any[] }>;
  };
  payments: {
    fetch(paymentId: string): Promise<any>;
    capture(paymentId: string, amount: number, currency: string): Promise<any>;
    refund(paymentId: string, params: Record<string, any>): Promise<any>;
  };
}

@Injectable()
export class RazorpayPaymentGateway implements PaymentGateway, OnModuleInit {
  readonly capabilities: GatewayCapabilities = {
    gatewayCode: 'razorpay',
    displayName: 'Razorpay',
    supports: new Set([
      GatewayCapability.ORDER_BASED,
      GatewayCapability.AUTHORIZE_THEN_CAPTURE,
      GatewayCapability.REFUND,
      GatewayCapability.PARTIAL_REFUND,
      GatewayCapability.WEBHOOK,
      GatewayCapability.STATUS_QUERY,
      GatewayCapability.CANCEL,
      GatewayCapability.REDIRECT_FLOW,
    ]),
    isLiveCapable: true,
    requiresWebhook: true,
    webhookSignatureAlgorithm: 'HMAC-SHA256',
  };

  private client: RazorpayClient;
  private keySecret: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const keyId     = this.configService.get<string>('payment.razorpay.keyId',     '');
    const keySecret = this.configService.get<string>('payment.razorpay.keySecret', '');
    this.keySecret  = keySecret;
    this.client     = this.createClient(keyId, keySecret);
  }

  /**
   * Factory method — override in tests to inject a mock client.
   */
  protected createClient(keyId: string, keySecret: string): RazorpayClient {
    const Razorpay = require('razorpay');
    return new Razorpay({ key_id: keyId, key_secret: keySecret }) as RazorpayClient;
  }

  // ---------------------------------------------------------------------------
  // PaymentGateway implementation
  // ---------------------------------------------------------------------------

  async initiatePayment(input: InitiatePaymentInput): Promise<PaymentGatewayResult> {
    try {
      const order = await this.client.orders.create({
        amount:          input.amountInPaise,
        currency:        input.currency ?? 'INR',
        receipt:         input.orderId ?? input.transactionId,
        payment_capture: 0,   // manual capture; PaymentService calls capturePayment later
        notes: {
          storeId:       input.storeId,
          transactionId: input.transactionId,
        },
      });

      return {
        success:        true,
        gatewayCode:    'razorpay',
        gatewayOrderId: order.id,
      };
    } catch (err) {
      return {
        success:     false,
        gatewayCode: 'razorpay',
        error:       this.mapError(err),
      };
    }
  }

  async capturePayment(input: CaptureInput): Promise<CaptureResult> {
    try {
      const payment = await this.client.payments.capture(
        input.gatewayPaymentId,
        input.amountInPaise,
        'INR',
      );

      return {
        success:          true,
        gatewayCode:      'razorpay',
        gatewayOrderId:   payment.order_id,
        gatewayPaymentId: payment.id,
        capturedPaise:    payment.amount,
        capturedAt:       new Date(payment.created_at * 1000),
      };
    } catch (err) {
      return {
        success:       false,
        gatewayCode:   'razorpay',
        capturedPaise: 0,
        capturedAt:    new Date(),
        error:         this.mapError(err),
      };
    }
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    try {
      const refund = await this.client.payments.refund(input.gatewayPaymentId, {
        amount: input.amountInPaise,
        notes:  { reason: input.reason ?? 'Refund' },
      });

      return {
        success:        true,
        gatewayCode:    'razorpay',
        gatewayRefundId: refund.id,
        refundedPaise:  refund.amount,
        refundedAt:     new Date(refund.created_at * 1000),
      };
    } catch (err) {
      return {
        success:        false,
        gatewayCode:    'razorpay',
        gatewayRefundId: '',
        refundedPaise:  0,
        refundedAt:     new Date(),
        error:          this.mapError(err),
      };
    }
  }

  async verifyPayment(context: GatewayStatusQueryContext): Promise<VerificationResult> {
    try {
      let payment: any;

      if (context.gatewayPaymentId) {
        payment = await this.client.payments.fetch(context.gatewayPaymentId);
      } else if (context.gatewayOrderId) {
        const result = await this.client.orders.fetchPayments(context.gatewayOrderId);
        payment = result.items[result.items.length - 1];
        if (!payment) {
          throw new GatewayVerificationException(
            'razorpay',
            `No payments found for order ${context.gatewayOrderId}`,
          );
        }
      } else {
        throw new GatewayVerificationException(
          'razorpay',
          'Neither gatewayPaymentId nor gatewayOrderId provided',
        );
      }

      return {
        success:          true,
        gatewayCode:      'razorpay',
        gatewayOrderId:   payment.order_id,
        gatewayPaymentId: payment.id,
        resolvedStatus:   resolveRazorpayRefundStatus(payment),
        rawGatewayStatus: payment.status,
        gatewayTimestamp: new Date(payment.created_at * 1000),
      };
    } catch (err) {
      if (err instanceof GatewayVerificationException) throw err;
      return {
        success:         false,
        gatewayCode:     'razorpay',
        resolvedStatus:  null,
        rawGatewayStatus: null,
        error:           this.mapError(err),
      };
    }
  }

  /**
   * Razorpay does not have a direct cancel API for regular payments.
   * An authorized (not yet captured) payment expires after 5 days.
   * We record the cancellation intent locally; the gateway releases the hold automatically.
   */
  async cancelPayment(context: GatewayStatusQueryContext): Promise<PaymentGatewayResult> {
    return {
      success:          true,
      gatewayCode:      'razorpay',
      gatewayOrderId:   context.gatewayOrderId,
      gatewayPaymentId: context.gatewayPaymentId,
    };
  }

  // ---------------------------------------------------------------------------
  // Razorpay-specific: signature verification
  // ---------------------------------------------------------------------------

  /**
   * Verifies the payment signature returned by Razorpay checkout.
   * Razorpay signs: HMAC-SHA256( orderId + "|" + paymentId, keySecret )
   */
  verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    const body    = `${orderId}|${paymentId}`;
    const expected = createHmac('sha256', this.keySecret).update(body).digest('hex');
    return expected === signature;
  }

  /**
   * Verifies a Razorpay webhook signature.
   * Razorpay signs the raw request body with HMAC-SHA256 using the webhook secret.
   */
  verifyWebhookSignature(
    rawBody: string,
    razorpaySignature: string,
    webhookSecret: string,
  ): boolean {
    const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    return expected === razorpaySignature;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private mapError(err: any): GatewayError {
    const statusCode  = err?.statusCode ?? 0;
    const isRetryable = statusCode >= 500 || statusCode === 429;
    return {
      code:              err?.error?.code         ?? 'RAZORPAY_ERROR',
      message:           err?.error?.description  ?? err?.message ?? 'Unknown Razorpay error',
      isRetryable,
      gatewayRawCode:    String(statusCode),
      gatewayRawMessage: err?.error?.description  ?? '',
    };
  }
}
