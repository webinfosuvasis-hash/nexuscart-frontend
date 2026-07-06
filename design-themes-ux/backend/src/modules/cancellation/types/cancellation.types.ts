import { Order, PaymentRefund, Refund } from '@prisma/client';

export type PaymentActionType =
  | 'CANCELLED'
  | 'REFUNDED'
  | 'REFUND_FAILED'
  | 'ALREADY_REFUNDED'
  | 'SKIPPED'
  | 'NO_PAYMENT';

export interface CancelOrderInput {
  orderId:        string;
  storeId:        string;
  reason:         string;
  actorId:        string;
  idempotencyKey: string;
}

export interface CancellationResult {
  order:             Order;
  paymentAction:     PaymentActionType;
  paymentRefund:     PaymentRefund | null;
  orderRefund:       Refund | null;
  inventoryReleased: boolean;
}
