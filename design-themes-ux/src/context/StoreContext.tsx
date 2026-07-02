import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeKey } from '@/data/products';

interface StoreState {
  theme: ThemeKey;
  setTheme: (t: ThemeKey) => void;
  wishlist: string[];
  toggleWishlist: (id: string) => void;
}

const StoreContext = createContext<StoreState | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeKey>(
    () => (localStorage.getItem('mt_theme') as ThemeKey) || 'aurus',
  );
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('mt_wish') || '[]'); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem('mt_theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('mt_wish', JSON.stringify(wishlist)); }, [wishlist]);

  const toggleWishlist = (id: string) =>
    setWishlist((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const value = useMemo(
    () => ({ theme, setTheme, wishlist, toggleWishlist }),
    [theme, wishlist],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export const useStore = (): StoreState => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};

/** Indian rupee formatter — ₹1,23,456 */
export const inr = (n: number) => '₹' + n.toLocaleString('en-IN');
