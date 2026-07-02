import React, { createContext, useContext, useState, useMemo } from 'react';
import { useCart } from '@/hooks/useCart';

interface CartContextValue {
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  itemCount: number;
  isLoading: boolean;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartOpen, setCartOpen] = useState(false);
  const { data, isLoading } = useCart();

  const value = useMemo<CartContextValue>(
    () => ({ cartOpen, setCartOpen, itemCount: data?.itemCount ?? 0, isLoading }),
    [cartOpen, data?.itemCount, isLoading],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export const useCartContext = (): CartContextValue => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCartContext must be used within CartProvider');
  return ctx;
};

interface ErrorBoundaryState { hasError: boolean }

export class CartErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', color: '#374151' }}>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Something went wrong loading the app.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{ fontSize: 13, color: '#7C3AED', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
