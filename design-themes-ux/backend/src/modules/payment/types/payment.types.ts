import { PaymentTxStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Gateway capability flags
// ---------------------------------------------------------------------------

export enum GatewayCapability {
  /** Gateway supports authorize-then-capture (two-step) flow */
  AUTHORIZE_THEN_CAPTURE = 'AUTHORIZE_THEN_CAPTURE',
  /** Gateway captures immediately on payment confirmation */
  DIRECT_CAPTURE = 'DIRECT_CAPTURE',
  /** Gateway supports full refunds */
  REFUND = 'REFUND',
  /** Gateway supports partial refunds */
  PARTIAL_REFUND = 'PARTIAL_REFUND',
  /** Gateway sends webhooks for async events */
  WEBHOOK = 'WEBHOOK',
  /** Gateway supports synchronous status queries */
  STATUS_QUERY = 'STATUS_QUERY',
  /** Gateway supports payment cancellation */
  CANCEL = 'CANCEL',
  /** Gateway uses a payment intent model (Stripe) */
  INTENT_BASED = 'INTENT_BASED',
  /** Gateway uses an order ID model (Razorpay) */
  ORDER_BASED = 'ORDER_BASED',
  /** Gateway requires a redirect to an external payment page */
  REDIRECT_FLOW = 'REDIRECT_FLOW',
}

// ---------------------------------------------------------------------------
// Errors returned inline from gateway operations
// ---------------------------------------------------------------------------

export interface GatewayError {
  code: string;
  message: string;
  isRetryable: boolean;
  gatewayRawCode?: string;
  gatewayRawMessage?: string;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface InitiatePaymentInput {
  transactionId: string;
  checkoutSessionId: string;
  storeId: string;
  amountInPaise: number;
  currency: string;
  orderId?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  description?: string;
  idempotencyKey: string;
  returnUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

export interface CaptureInput {
  transactionId: string;
  storeId: string;
  amountInPaise: number;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewayIntentId?: string;
  idempotencyKey: string;
}

export interface RefundInput {
  transactionId: string;
  storeId: string;
  amountInPaise: number;
  reason?: string;
  gatewayPaymentId?: string;
  gatewayOrderId?: string;
  idempotencyKey: string;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface PaymentGatewayResult {
  success: boolean;
  gatewayCode: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewayIntentId?: string;
  gatewayReferenceId?: string;
  /** Redirect URL for redirect-based flows (Razorpay standard checkout, PhonePe) */
  redirectUrl?: string;
  /** Client secret for in-page SDK flows (Stripe Elements) */
  clientSecret?: string;
  error?: GatewayError;
}

export interface CaptureResult extends PaymentGatewayResult {
  capturedPaise: number;
  capturedAt: Date;
}

export interface RefundResult extends PaymentGatewayResult {
  gatewayRefundId: string;
  refundedPaise: number;
  refundedAt: Date;
}

export interface VerificationResult extends PaymentGatewayResult {
  /** The PaymentTxStatus the transaction should be moved to based on gateway state */
  resolvedStatus: PaymentTxStatus;
  /** Raw status string returned by the gateway, for audit logging */
  rawGatewayStatus?: string;
  gatewayTimestamp?: Date;
}

export interface WebhookProcessingResult {
  eventType: string;
  transactionRef: string;
  processed: boolean;
  rawPayload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Gateway metadata / credentials
// ---------------------------------------------------------------------------

export interface GatewayCredentials {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
  extra?: Record<string, string>;
}
