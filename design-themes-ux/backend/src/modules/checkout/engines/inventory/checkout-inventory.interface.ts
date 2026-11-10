import { InventorySource } from '@prisma/client';

export type InventoryIssueCode =
  | 'OUT_OF_STOCK'
  | 'INSUFFICIENT_STOCK'
  | 'PRODUCT_DISABLED'
  | 'VARIANT_DELETED'
  | 'PRICE_CHANGED';

export interface CheckoutInventoryInput {
  itemId:            string;
  productId:         string;
  variantId?:        string;
  warehouseId?:      string;
  requestedQuantity: number;
  inventorySource:   InventorySource;
  unitPrice:         number;
}

export interface CheckoutInventoryResult {
  itemId:            string;
  productId:         string;
  isAvailable:       boolean;
  availableQuantity: number;
  adjustedQuantity?: number;
  isOutOfStock:      boolean;
  isLowStock:        boolean;
  priceChanged:      boolean;
  currentUnitPrice?: number;
  issue?:            InventoryIssueCode;
  message?:          string;
}

export interface ICheckoutInventoryEngine {
  /**
   * `checkoutId`, when given, credits units that checkout itself already
   * holds (InventoryReservationService) — they were taken out of stock for it.
   */
  validateBatch(
    storeId:     string,
    inputs:      CheckoutInventoryInput[],
    checkoutId?: string,
  ): Promise<CheckoutInventoryResult[]>;
}
