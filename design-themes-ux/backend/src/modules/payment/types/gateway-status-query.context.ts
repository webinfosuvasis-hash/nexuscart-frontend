/**
 * Context passed to a gateway's verifyPayment() and cancelPayment() methods.
 * Contains whichever gateway identifiers are available for this transaction.
 * The gateway implementation uses whichever field it recognizes.
 */
export interface GatewayStatusQueryContext {
  gatewayOrderId?: string;       // Razorpay order ID
  gatewayPaymentId?: string;     // Razorpay / PhonePe payment ID
  gatewayIntentId?: string;      // Stripe PaymentIntent ID
  gatewayReferenceId?: string;   // PhonePe / PayU transaction reference
  amountInPaise: number;
  storeId: string;
}
