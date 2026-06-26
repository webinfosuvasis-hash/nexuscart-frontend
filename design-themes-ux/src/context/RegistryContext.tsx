import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { Product } from '@/data/products';

/* ── Occasion types ──────────────────────────────────────────── */
export type OccasionKey = 'wedding' | 'puja' | 'party' | 'office' | 'gift';

export const OCCASIONS: Record<OccasionKey, {
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  desc: string;
}> = {
  wedding: { label: 'Wedding',  icon: '💍', color: '#9F1239', bg: '#FFF1F2', border: '#FECDD3', desc: 'Bridal & wedding occasion wear' },
  puja:    { label: 'Puja',     icon: '🪔', color: '#92400E', bg: '#FFFBEB', border: '#FDE68A', desc: 'Traditional & festive puja wear' },
  party:   { label: 'Party',    icon: '✨', color: '#6D28D9', bg: '#F5F3FF', border: '#DDD6FE', desc: 'Elegant party & celebration wear' },
  office:  { label: 'Office',   icon: '💼', color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE', desc: 'Everyday professional wear' },
  gift:    { label: 'Gift',     icon: '🎁', color: '#9D174D', bg: '#FDF2F8', border: '#FBCFE8', desc: 'Perfect gifts for her' },
};

/* ── Registry item ───────────────────────────────────────────── */
export interface RegistryItem {
  product: Product;
  occasion: OccasionKey;
  isPurchased: boolean;
  addedAt: string;
}

/* ── Context shape ───────────────────────────────────────────── */
interface RegistryState {
  registryName: string;
  ownerName: string;
  shareCode: string;
  items: RegistryItem[];
  totalItems: number;
  purchasedItems: number;
  setRegistryName:    (n: string) => void;
  setOwnerName:       (n: string) => void;
  addToRegistry:      (product: Product, occasion: OccasionKey) => void;
  removeFromRegistry: (productId: string, occasion: OccasionKey) => void;
  markPurchased:      (productId: string, occasion: OccasionKey) => void;
  isInRegistry:       (productId: string, occasion?: OccasionKey) => boolean;
  clearRegistry:      () => void;
}

const RegistryContext = createContext<RegistryState | undefined>(undefined);

/* ── Helpers ─────────────────────────────────────────────────── */
const KEY = 'aurus_registry';

const generateCode = (): string =>
  Math.random().toString(36).slice(2, 8).toUpperCase();

function loadStored() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

/* ── Provider ────────────────────────────────────────────────── */
export const RegistryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const stored = loadStored();

  const [registryName, setRegistryNameState] = useState<string>(stored?.registryName ?? '');
  const [ownerName,    setOwnerNameState]    = useState<string>(stored?.ownerName    ?? '');
  const [shareCode]                          = useState<string>(stored?.shareCode    ?? generateCode());
  const [items, setItems]                    = useState<RegistryItem[]>(stored?.items ?? []);

  /* Persist on every state change */
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ registryName, ownerName, shareCode, items }));
  }, [registryName, ownerName, shareCode, items]);

  const setRegistryName = useCallback((n: string) => setRegistryNameState(n), []);
  const setOwnerName    = useCallback((n: string) => setOwnerNameState(n),    []);

  const addToRegistry = useCallback((product: Product, occasion: OccasionKey) => {
    setItems(prev => {
      if (prev.some(i => i.product.id === product.id && i.occasion === occasion)) return prev;
      return [...prev, { product, occasion, isPurchased: false, addedAt: new Date().toISOString() }];
    });
  }, []);

  const removeFromRegistry = useCallback((productId: string, occasion: OccasionKey) => {
    setItems(prev => prev.filter(i => !(i.product.id === productId && i.occasion === occasion)));
  }, []);

  const markPurchased = useCallback((productId: string, occasion: OccasionKey) => {
    setItems(prev =>
      prev.map(i =>
        i.product.id === productId && i.occasion === occasion
          ? { ...i, isPurchased: true }
          : i
      )
    );
  }, []);

  const isInRegistry = useCallback((productId: string, occasion?: OccasionKey): boolean => {
    if (occasion) return items.some(i => i.product.id === productId && i.occasion === occasion);
    return items.some(i => i.product.id === productId);
  }, [items]);

  const clearRegistry = useCallback(() => {
    setItems([]);
    setRegistryNameState('');
    setOwnerNameState('');
  }, []);

  const value = useMemo<RegistryState>(() => ({
    registryName, ownerName, shareCode, items,
    totalItems:     items.length,
    purchasedItems: items.filter(i => i.isPurchased).length,
    setRegistryName, setOwnerName,
    addToRegistry, removeFromRegistry, markPurchased, isInRegistry, clearRegistry,
  }), [registryName, ownerName, shareCode, items,
       setRegistryName, setOwnerName,
       addToRegistry, removeFromRegistry, markPurchased, isInRegistry, clearRegistry]);

  return <RegistryContext.Provider value={value}>{children}</RegistryContext.Provider>;
};

export const useRegistry = (): RegistryState => {
  const ctx = useContext(RegistryContext);
  if (!ctx) throw new Error('useRegistry must be used within RegistryProvider');
  return ctx;
};
