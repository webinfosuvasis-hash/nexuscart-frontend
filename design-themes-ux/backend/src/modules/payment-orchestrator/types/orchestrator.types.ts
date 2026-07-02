export interface OrchestratorAddressSnapshot {
  firstName:  string;
  lastName:   string;
  line1:      string;
  line2:      string | null;
  city:       string;
  state:      string;
  postalCode: string;
  country:    string;
  phone:      string;
  email:      string | null;
}

export interface OrchestratorSnapshotItem {
  cartItemId:     string;
  productId:      string;
  variantId:      string | null;
  sku:            string;
  name:           string;
  brand:          string | null;
  thumbnail:      string;
  quantity:       number;
  unitPrice:      string;           // Decimal as string, rupees (e.g. "999.0000")
  comparePrice:   string | null;
  lineDiscount:   string;           // Decimal as string, rupees
  lineTotal:      string;           // unitPrice*qty - lineDiscount, rounded to 2dp
  taxCategory:    string | null;
  gstClass:       string | null;
  hsn:            string | null;
  variantOptions: Record<string, string> | null;
  warehouseId:    string | null;
}

export interface OrchestratorCheckoutSnapshot {
  checkoutSessionId:       string;
  cartId:                  string;
  storeId:                 string;
  customerId:              string | null;
  sessionId:               string;
  couponCode:              string | null;
  selectedShippingMethodId: string | null;
  shippingAddress:         OrchestratorAddressSnapshot | null;
  billingAddress:          OrchestratorAddressSnapshot | null;
  items:                   OrchestratorSnapshotItem[];
  subtotal:                string;           // sum of lineTotals, rupees
  promotionDiscount:       string;           // rupees
  shippingCost:            string;           // rupees
  tax:                     string;           // rupees (derived from grandTotal residual)
  grandTotal:              string;           // amountInPaise / 100, rupees
  currencyCode:            string;
  snapshotAt:              string;           // ISO timestamp
}

export interface CompletePaymentResult {
  orderId:     string;
  orderNumber: string;
  recovered:   boolean;
}
