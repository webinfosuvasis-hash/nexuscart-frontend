import { PaymentActivity, PaymentRefund, PaymentTransaction } from '@prisma/client';

export interface CreatePaymentAttemptInput {
  checkoutSessionId: string;
  storeId: string;
  gatewayCode: string;
  amountInPaise: number;
  currency?: string;
  paymentMethodId?: string;
  idempotencyKey: string;
}

export interface CustomerInfo {
  email?: string;
  phone?: string;
  name?: string;
}

export interface StartPaymentResult {
  transaction: PaymentTransaction;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewayIntentId?: string;
  redirectUrl?: string;
  clientSecret?: string;
}

export interface AuthorizePaymentInput {
  transactionId: string;
  storeId: string;
  gatewayPaymentId: string;
  gatewaySignature?: string;
}

export interface CapturePaymentInput {
  transactionId: string;
  storeId: string;
  idempotencyKey: string;
}

export interface RefundPaymentInput {
  transactionId: string;
  storeId: string;
  amountInPaise: number;
  reason?: string;
  idempotencyKey: string;
}

export interface RefundPaymentResult {
  transaction: PaymentTransaction;
  refund: PaymentRefund;
}

export interface RetryPaymentInput {
  transactionId: string;
  storeId: string;
  idempotencyKey: string;
  gatewayCode?: string;
  customerInfo?: CustomerInfo;
}

export type PaymentTransactionWithActivities = PaymentTransaction & {
  activities: PaymentActivity[];
};

// Used by WebhookService to record a capture that originated from the gateway
// (no outbound API call — the payment is already captured upstream).
export interface GatewayCaptureInput {
  transactionId:    string;
  storeId:          string;
  capturedPaise:    number;
  gatewayPaymentId?: string;
  capturedAt:       Date;
}
