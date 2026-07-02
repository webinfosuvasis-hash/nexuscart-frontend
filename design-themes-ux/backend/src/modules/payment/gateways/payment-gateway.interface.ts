import { GatewayStatusQueryContext } from '../types/gateway-status-query.context';
import {
  GatewayCapability,
  InitiatePaymentInput,
  CaptureInput,
  RefundInput,
  PaymentGatewayResult,
  CaptureResult,
  RefundResult,
  VerificationResult,
  WebhookProcessingResult,
} from '../types/payment.types';

// ---------------------------------------------------------------------------
// Gateway capability declaration
// ---------------------------------------------------------------------------

export interface GatewayCapabilities {
  /** Unique code used as `gatewayCode` on PaymentTransaction */
  readonly gatewayCode: string;
  readonly displayName: string;
  readonly supports: ReadonlySet<GatewayCapability>;
  readonly isLiveCapable: boolean;
  /** Whether this gateway delivers async events via webhooks */
  readonly requiresWebhook: boolean;
  readonly webhookSignatureAlgorithm?: 'HMAC-SHA256' | 'HMAC-SHA512' | 'RSA-SHA256';
}

// ---------------------------------------------------------------------------
// Core gateway contract
// ---------------------------------------------------------------------------

export interface PaymentGateway {
  readonly capabilities: GatewayCapabilities;

  /**
   * Initiates a payment. For redirect-based gateways this returns a redirectUrl.
   * For intent-based gateways (Stripe) this returns a clientSecret.
   * The returned gateway IDs are persisted on PaymentTransaction by the caller.
   */
  initiatePayment(input: InitiatePaymentInput): Promise<PaymentGatewayResult>;

  /**
   * Captures a previously authorized payment.
   * Only required for gateways that support AUTHORIZE_THEN_CAPTURE.
   */
  capturePayment(input: CaptureInput): Promise<CaptureResult>;

  /**
   * Issues a full or partial refund.
   */
  refundPayment(input: RefundInput): Promise<RefundResult>;

  /**
   * Queries the gateway for the current payment status.
   * Used by the recovery job and status reconciliation flow.
   */
  verifyPayment(context: GatewayStatusQueryContext): Promise<VerificationResult>;

  /**
   * Requests cancellation of a payment that has not yet been captured.
   * Must be called before starting a new PaymentTransaction for the same checkout.
   */
  cancelPayment(context: GatewayStatusQueryContext): Promise<PaymentGatewayResult>;

  /**
   * Optional: processes a raw webhook payload from the gateway.
   * Only gateways with GatewayCapability.WEBHOOK need to implement this.
   */
  handleWebhookPayload?(
    rawBody: Buffer,
    signature: string,
    storeId: string,
  ): Promise<WebhookProcessingResult>;
}
