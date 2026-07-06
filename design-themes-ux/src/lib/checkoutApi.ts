/**
 * checkoutApi.ts — Checkout API client for the Aurus storefront.
 *
 * Uses native fetch (no axios — matches cartApi.ts/storefrontApi.ts). These
 * endpoints are `@Public()` on the backend (guest-checkout capable, scoped
 * by the httpOnly cart-session cookie), same trust model as cartApi.ts.
 * Payment itself is a separate, customer-authenticated API — see
 * customerPaymentApi.ts.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';
const STORE_ID = import.meta.env.VITE_STORE_ID || 'default';

// ─── Response types (match CheckoutSessionResponseDto exactly) ──────────────

export interface CheckoutAddress {
  id: string;
  type: 'SHIPPING' | 'BILLING';
  firstName: string;
  lastName: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string | null;
  isGuestAddress: boolean;
}

export interface CheckoutItem {
  id: string;
  productId: string;
  variantId: string | null;
  sku: string;
  name: string;
  brand: string | null;
  image: string;
  quantity: number;
  unitPrice: number;
  lineDiscount: number;
  lineTotal: number;
  taxAmount: number;
  taxCategory: string | null;
  variantOptions: Record<string, string> | null;
  hasStockWarning: boolean;
  hasPriceWarning: boolean;
}

export interface CheckoutShippingMethod {
  id: string;
  name: string;
  description: string | null;
  cost: number;
  estimatedDays: string;
  isFree: boolean;
  isSelected: boolean;
}

export interface CheckoutTaxBreakdown {
  label: string;
  type: string;
  rate: number;
  amount: number;
}

export interface CheckoutTotals {
  subtotal: number;
  totalDiscount: number;
  promotionDiscount: number;
  shippingCost: number;
  taxAmount: number;
  grandTotal: number;
  currencyCode: string;
}

export interface CheckoutPromoSummary {
  code: string;
  label: string;
  discountAmount: number;
  discountType: string;
}

export interface CheckoutValidationIssue {
  code: string;
  severity: string;
  message: string;
  itemId?: string;
}

export interface CheckoutValidationResult {
  isValid: boolean;
  hasBlockers: boolean;
  issues: CheckoutValidationIssue[];
}

export type CheckoutStatus =
  | 'PENDING' | 'ADDRESS_ADDED' | 'SHIPPING_SELECTED' | 'VALIDATED'
  | 'PAYMENT_INITIATED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

export interface CheckoutSession {
  id: string;
  storeId: string;
  cartId: string;
  cartVersion: number;
  sessionId: string;
  customerId: string | null;
  status: CheckoutStatus;
  addresses: CheckoutAddress[];
  selectedShippingMethod: CheckoutShippingMethod | null;
  availableShippingMethods: CheckoutShippingMethod[];
  items: CheckoutItem[];
  totals: CheckoutTotals;
  taxBreakdown: CheckoutTaxBreakdown[];
  appliedPromotion: CheckoutPromoSummary | null;
  validation: CheckoutValidationResult;
  warnings: string[];
  isValid: boolean;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Error type ───────────────────────────────────────────────────────────

export class CheckoutApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly errorCode: string | null,
    message: string,
    public readonly body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CheckoutApiError';
  }
}

/** Thrown specifically for the backend's "a checkout is already active for this cart" conflict. */
export class CheckoutAlreadyActiveError extends CheckoutApiError {
  constructor(public readonly checkoutId: string) {
    super(409, 'CHECKOUT_ALREADY_ACTIVE', 'A checkout session is already active for this cart.');
    this.name = 'CheckoutAlreadyActiveError';
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

async function checkoutFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? 'GET').toUpperCase();
  const url = `${BASE_URL}/checkout${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Store-Id': STORE_ID,
    ...(options?.headers as Record<string, string> ?? {}),
  };
  if (!SAFE_METHODS.has(method)) {
    headers['Idempotency-Key'] = generateUUID();
  }

  const res = await fetch(url, { ...options, credentials: 'include', headers });

  if (!res.ok) {
    let errorCode: string | null = null;
    let message = res.statusText;
    let body: Record<string, unknown> | undefined;
    try {
      body = await res.json() as Record<string, unknown>;
      errorCode = (body.error as string) ?? null;
      message = (body.message as string) ?? res.statusText;
    } catch { /* non-JSON error body */ }

    if (res.status === 409 && errorCode === 'CHECKOUT_ALREADY_ACTIVE' && typeof body?.checkoutId === 'string') {
      throw new CheckoutAlreadyActiveError(body.checkoutId);
    }
    throw new CheckoutApiError(res.status, errorCode, message, body);
  }

  const body = await res.json() as { success: boolean; data: T };
  return body.data;
}

// ─── Endpoints ────────────────────────────────────────────────────────────

export const startCheckout = (): Promise<CheckoutSession> =>
  checkoutFetch<CheckoutSession>('/start', { method: 'POST' });

export const getCheckout = (checkoutId: string): Promise<CheckoutSession> =>
  checkoutFetch<CheckoutSession>(`/${encodeURIComponent(checkoutId)}`);

export interface AddressInput {
  firstName: string;
  lastName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  email?: string;
  sourceAddressId?: string;
}

export const updateCheckoutAddress = (
  checkoutId: string,
  address: AddressInput,
  billingSameAsShipping = true,
): Promise<CheckoutSession> =>
  checkoutFetch<CheckoutSession>(`/${encodeURIComponent(checkoutId)}/address`, {
    method: 'PATCH',
    body: JSON.stringify({ type: 'SHIPPING', billingSameAsShipping, address }),
  });

export const updateCheckoutShipping = (checkoutId: string, shippingMethodId: string): Promise<CheckoutSession> =>
  checkoutFetch<CheckoutSession>(`/${encodeURIComponent(checkoutId)}/shipping`, {
    method: 'PATCH',
    body: JSON.stringify({ shippingMethodId }),
  });

export const validateCheckout = (checkoutId: string): Promise<CheckoutSession> =>
  checkoutFetch<CheckoutSession>(`/${encodeURIComponent(checkoutId)}/validate`, { method: 'POST' });

export const getCheckoutSummary = (checkoutId: string): Promise<CheckoutSession> =>
  checkoutFetch<CheckoutSession>(`/${encodeURIComponent(checkoutId)}/summary`);

export const cancelCheckout = (checkoutId: string): Promise<CheckoutSession> =>
  checkoutFetch<CheckoutSession>(`/${encodeURIComponent(checkoutId)}/cancel`, { method: 'POST' });
