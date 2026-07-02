export const WEBHOOK_LOG_STATUS = {
  PENDING:   'PENDING',
  SUCCESS:   'SUCCESS',
  FAILED:    'FAILED',
  DUPLICATE: 'DUPLICATE',
  SKIPPED:   'SKIPPED',
} as const;

export type WebhookLogStatus = (typeof WEBHOOK_LOG_STATUS)[keyof typeof WEBHOOK_LOG_STATUS];

export interface SignatureVerificationResult {
  valid:    boolean;
  reason?:  string;
}

// ---------------------------------------------------------------------------
// Razorpay payload shapes
// ---------------------------------------------------------------------------

export interface RazorpayPaymentEntity {
  id:               string;
  entity:           string;
  amount:           number;
  currency:         string;
  status:           string;
  order_id:         string | null;
  amount_refunded:  number;
  captured:         boolean;
  email:            string | null;
  contact:          string | null;
  notes:            Record<string, string | null>;
  error_code:       string | null;
  error_description: string | null;
  created_at:       number;
}

export interface RazorpayRefundEntity {
  id:         string;
  entity:     string;
  amount:     number;
  payment_id: string;
  status:     string;
  created_at: number;
}

export interface RazorpayWebhookPayload {
  entity:     string;
  account_id: string;
  event:      string;
  contains:   string[];
  payload: {
    payment?: { entity: RazorpayPaymentEntity };
    refund?:  { entity: RazorpayRefundEntity };
  };
  created_at: number;
}

// ---------------------------------------------------------------------------
// Stripe payload shapes
// ---------------------------------------------------------------------------

export interface StripeWebhookPayload {
  id:       string;
  object:   'event';
  type:     string;
  created:  number;
  livemode: boolean;
  data: {
    object: Record<string, unknown>;
  };
  request?: {
    id:               string | null;
    idempotency_key:  string | null;
  };
}
