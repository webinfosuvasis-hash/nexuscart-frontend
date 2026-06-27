/**
 * useCart — P6
 *
 * localStorage-backed cart for the editor preview and early storefront.
 * Full backend cart integration (session-based, order creation) is P7.
 *
 * Cart key: 'nx-cart:{storeId}'  — partitioned per store.
 */

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartItem {
  id:        string;     // productId:variantId or productId
  productId: string;
  variantId?: string;
  name:      string;
  variantName?: string;
  price:     number;
  image?:    string;
  quantity:  number;
  sku:       string;
}

export interface CartState {
  items:     CartItem[];
  total:     number;
  itemCount: number;
}

export interface UseCartReturn extends CartState {
  addItem:    (item: Omit<CartItem, 'id' | 'quantity'>, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQty:  (id: string, quantity: number) => void;
  clearCart:  () => void;
  hasItem:    (productId: string, variantId?: string) => boolean;
}

// ─── Key helpers ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'nx-cart';

function makeId(productId: string, variantId?: string): string {
  return variantId ? `${productId}:${variantId}` : productId;
}

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
}

function deriveState(items: CartItem[]): CartState {
  return {
    items,
    total:     items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCart(): UseCartReturn {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  // Persist on every change
  useEffect(() => { saveCart(items); }, [items]);

  const addItem = useCallback((
    item:     Omit<CartItem, 'id' | 'quantity'>,
    quantity: number = 1,
  ) => {
    const id = makeId(item.productId, item.variantId);
    setItems((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (existing) {
        return prev.map((i) =>
          i.id === id ? { ...i, quantity: i.quantity + quantity } : i,
        );
      }
      return [...prev, { ...item, id, quantity }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQty = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    } else {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, quantity } : i)),
      );
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const hasItem = useCallback((productId: string, variantId?: string) => {
    const id = makeId(productId, variantId);
    return items.some((i) => i.id === id);
  }, [items]);

  return {
    ...deriveState(items),
    addItem,
    removeItem,
    updateQty,
    clearCart,
    hasItem,
  };
}
