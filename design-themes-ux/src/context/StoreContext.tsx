import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeKey, Product } from '@/data/products';

/** Identifies the specific variant being added — distinct from the parent Product. */
export interface CartVariantInfo {
  variantId:      string;
  variantSku:     string;
  variantOptions?: Record<string, string>;
}

export interface CartLine extends Product {
  qty: number;
  variantId?:      string;
  variantSku?:     string;
  variantOptions?: Record<string, string>;
}

/**
 * A cart line's true identity is productId + variantId (falling back to just
 * productId for products with no variants) — never productId alone. Two
 * different variants of the same product (e.g. Red/M vs Blue/L) must occupy
 * independent lines; merging them by productId would silently drop the
 * variant distinction and freeze the price/SKU at whichever variant was
 * added first.
 */
export function cartLineKey(line: { id: string; variantId?: string }): string {
  return line.variantId ? `${line.id}::${line.variantId}` : line.id;
}

interface StoreState {
  theme: ThemeKey;
  setTheme: (t: ThemeKey) => void;
  cart: CartLine[];
  addToCart: (p: Product, qty?: number, variant?: CartVariantInfo) => void;
  removeFromCart: (lineKey: string) => void;
  updateQty: (lineKey: string, qty: number) => void;
  cartCount: number;
  cartTotal: number;
  wishlist: string[];
  toggleWishlist: (id: string) => void;
  cartOpen: boolean;
  setCartOpen: (b: boolean) => void;
}

const StoreContext = createContext<StoreState | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeKey>(() => (localStorage.getItem('mt_theme') as ThemeKey) || 'aurus');
  const [cart, setCart] = useState<CartLine[]>(() => {
    try { return JSON.parse(localStorage.getItem('mt_cart') || '[]'); } catch { return []; }
  });
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('mt_wish') || '[]'); } catch { return []; }
  });
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => { localStorage.setItem('mt_theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('mt_cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem('mt_wish', JSON.stringify(wishlist)); }, [wishlist]);

  const addToCart = (p: Product, qty = 1, variant?: CartVariantInfo) => {
    const key = cartLineKey({ id: p.id, variantId: variant?.variantId });
    setCart(prev => {
      const ex = prev.find(l => cartLineKey(l) === key);
      if (ex) return prev.map(l => cartLineKey(l) === key ? { ...l, qty: l.qty + qty } : l);
      return [...prev, {
        ...p, qty,
        variantId:      variant?.variantId,
        variantSku:     variant?.variantSku,
        variantOptions: variant?.variantOptions,
      }];
    });
    setCartOpen(true);
  };
  const removeFromCart = (lineKey: string) => setCart(prev => prev.filter(l => cartLineKey(l) !== lineKey));
  const updateQty = (lineKey: string, qty: number) =>
    setCart(prev => prev.map(l => cartLineKey(l) === lineKey ? { ...l, qty: Math.max(1, qty) } : l));
  const toggleWishlist = (id: string) =>
    setWishlist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const cartCount = cart.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cart.reduce((s, l) => s + l.qty * l.price, 0);

  const value = useMemo(() => ({
    theme, setTheme, cart, addToCart, removeFromCart, updateQty,
    cartCount, cartTotal, wishlist, toggleWishlist, cartOpen, setCartOpen,
  }), [theme, cart, wishlist, cartOpen, cartCount, cartTotal]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export const useStore = (): StoreState => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};

export const inr = (n: number) => '\u20B9' + n.toLocaleString('en-IN');
