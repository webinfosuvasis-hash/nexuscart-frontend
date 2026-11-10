/**
 * cartApi.ts — Cart API client for the Aurus storefront.
 *
 * All requests:
 *   - include `credentials: 'include'` so the backend httpOnly session
 *     cookie (`aurus_cart_sid`) is sent automatically
 *   - include `X-Store-Id` derived from VITE_STORE_ID (falls back to 'default'
 *     unlike storefrontApi which throws, since the backend session middleware
 *     also falls back)
 *   - include a freshly-generated `Idempotency-Key` on every mutating request
 */

import { API_BASE_URL, STORE_ID as CONFIGURED_STORE_ID } from './env';

const BASE_URL = API_BASE_URL;
const STORE_ID = CONFIGURED_STORE_ID || 'default';

// ─── Response types (match CartResponseDto exactly) ──────────────────────────

export interface CartItem {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  sku: string;
  name: string;
  brand: string | null;
  slug: string;
  image: string;
  unitPrice: number;
  comparePrice: number | null;
  lineTotal: number;
  lineDiscount: number;
  inventorySource: string;
  variantOptions: Record<string, string> | null;
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  promotionDiscount: number;
  shippingCost: number;
  tax: number;
  grandTotal: number;
}

export interface CartShipping {
  methods: Array<{ id: string; name: string; cost: number; estimatedDays: string | null }>;
  cheapestCost: number;
  cheapestDays: string | null;
}

export interface Cart {
  id: string;
  storeId: string;
  customerId: string | null;
  status: string;
  version: number;
  currencyCode: string;
  locale: string;
  couponCode: string | null;
  items: CartItem[];
  totals: CartTotals;
  shipping: CartShipping | null;
  itemCount: number;
  uniqueItemCount: number;
  lockedUntil: string | null;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartActivity {
  id: string;
  activityType: string;
  actorType: string;
  actorId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

// ─── Error type ───────────────────────────────────────────────────────────────

export class CartApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly errorCode: string | null,
    message: string,
  ) {
    super(message);
    this.name = 'CartApiError';
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts (HTTP) and Safari <15.4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

async function cartFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? 'GET').toUpperCase();
  const url    = `${BASE_URL}/cart${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Store-Id':   STORE_ID,
    ...(options?.headers as Record<string, string> ?? {}),
  };

  if (!SAFE_METHODS.has(method)) {
    headers['Idempotency-Key'] = generateUUID();
  }

  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (!res.ok) {
    let errorCode: string | null = null;
    let message = res.statusText;
    try {
      const errBody = await res.json() as { errorCode?: string; message?: string };
      errorCode = errBody.errorCode ?? null;
      message   = errBody.message ?? res.statusText;
    } catch { /* non-JSON error body */ }
    throw new CartApiError(res.status, errorCode, message);
  }

  const body = await res.json() as { success: boolean; data: T };
  return body.data;
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

export const getCart = (): Promise<Cart> =>
  cartFetch<Cart>('');

/**
 * Logout: the backend issues this browser a fresh, empty cart session cookie,
 * so the next person on a shared device doesn't inherit the previous bag,
 * address or checkout. 204, no body.
 */
export async function rotateCartSession(): Promise<void> {
  const res = await fetch(`${BASE_URL}/cart/session/rotate`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Store-Id': STORE_ID },
  });
  if (!res.ok) throw new CartApiError(res.status, null, res.statusText);
}

export interface AddToCartInput {
  productId:   string;
  quantity:    number;
  variantId?:  string;
  warehouseId?: string;
}
export const addToCart = (input: AddToCartInput): Promise<Cart> =>
  cartFetch<Cart>('/items', { method: 'POST', body: JSON.stringify(input) });

export const updateCartItem = (itemId: string, quantity: number): Promise<Cart> =>
  cartFetch<Cart>(`/items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    body:   JSON.stringify({ quantity }),
  });

export const removeCartItem = (itemId: string): Promise<Cart> =>
  cartFetch<Cart>(`/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' });

export const clearCart = (): Promise<Cart> =>
  cartFetch<Cart>('/items', { method: 'DELETE' });

export const mergeCarts = (guestCartId: string): Promise<Cart> =>
  cartFetch<Cart>('/merge', { method: 'POST', body: JSON.stringify({ guestCartId }) });

export const applyPromotion = (code: string): Promise<Cart> =>
  cartFetch<Cart>('/promotions', { method: 'POST', body: JSON.stringify({ code }) });

export const removePromotion = (code: string): Promise<Cart> =>
  cartFetch<Cart>(`/promotions/${encodeURIComponent(code)}`, { method: 'DELETE' });

export const lockCart = (): Promise<Cart> =>
  cartFetch<Cart>('/lock', { method: 'POST' });

export const unlockCart = (): Promise<Cart> =>
  cartFetch<Cart>('/unlock', { method: 'POST' });

export const getCartActivity = (): Promise<CartActivity[]> =>
  cartFetch<CartActivity[]>('/activity');
