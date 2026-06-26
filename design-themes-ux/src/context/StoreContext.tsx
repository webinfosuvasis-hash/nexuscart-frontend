import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeKey, Product } from '@/data/products';

export interface CartLine extends Product {
  qty: number;
}

interface StoreState {
  theme: ThemeKey;
  setTheme: (t: ThemeKey) => void;
  cart: CartLine[];
  addToCart: (p: Product, qty?: number) => void;
  removeFromCart: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
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
  const [cart, setCart] = useState<CartLine[]>(() => JSON.parse(localStorage.getItem('mt_cart') || '[]'));
  const [wishlist, setWishlist] = useState<string[]>(() => JSON.parse(localStorage.getItem('mt_wish') || '[]'));
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => { localStorage.setItem('mt_theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('mt_cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem('mt_wish', JSON.stringify(wishlist)); }, [wishlist]);

  const addToCart = (p: Product, qty = 1) => {
    setCart(prev => {
      const ex = prev.find(l => l.id === p.id);
      if (ex) return prev.map(l => l.id === p.id ? { ...l, qty: l.qty + qty } : l);
      return [...prev, { ...p, qty }];
    });
    setCartOpen(true);
  };
  const removeFromCart = (id: string) => setCart(prev => prev.filter(l => l.id !== id));
  const updateQty = (id: string, qty: number) =>
    setCart(prev => prev.map(l => l.id === id ? { ...l, qty: Math.max(1, qty) } : l));
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
