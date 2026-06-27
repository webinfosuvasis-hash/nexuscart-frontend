/**
 * ProductPageContext — P6
 *
 * Shared state for all PDP primitives on a single product page.
 * Solves the "how does VariantSelector talk to ProductPrice?" problem:
 * all primitives read from / write to this context.
 *
 * Usage (NodeRenderer path):
 *   <ProductPageProvider product={product}>
 *     {children}  ← all PDP primitives live here
 *   </ProductPageProvider>
 *
 * Usage (canvas path):
 *   Same — the canvas wraps the product page with ProductPageProvider.
 */

import React, {
  createContext, useContext, useState, useCallback, useMemo,
} from 'react';
import type { Product, ProductVariant } from '@/types';
import { useCart } from '@/hooks/useCart';
import { formatCanvasPrice } from '@/hooks/useCanvasProducts';

// ─── Context value ────────────────────────────────────────────────────────────

export interface ProductPageState {
  product:          Product;
  selectedVariant:  ProductVariant | null;
  quantity:         number;
  effectivePrice:   number;    // variant.price if selected, else product.price
  comparePrice:     number | undefined;
  effectiveImage:   string;    // variant.image if selected, else product.image
  discountPct:      number;    // percentage saved (0 if no comparePrice)
  inStock:          boolean;
  formattedPrice:   string;
  formattedCompare: string | null;
  setVariant:       (v: ProductVariant | null) => void;
  setQuantity:      (n: number) => void;
  addToCart:        () => void;
  buyNow:           () => void;
  cartAdded:        boolean;   // shows "Added!" feedback for 2 seconds
}

const Ctx = createContext<ProductPageState | null>(null);

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProductPage(): ProductPageState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProductPage must be used inside <ProductPageProvider>');
  return ctx;
}

// Returns null instead of throwing — safe to call outside a PDP
export function useProductPageOptional(): ProductPageState | null {
  return useContext(Ctx);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface ProviderProps {
  product:  Product;
  children: React.ReactNode;
}

export const ProductPageProvider: React.FC<ProviderProps> = ({ product, children }) => {
  const [selectedVariant, setVariant]    = useState<ProductVariant | null>(null);
  const [quantity,         setQtyRaw]    = useState<number>(1);
  const [cartAdded,        setCartAdded] = useState(false);
  const cart = useCart();

  const setQuantity = useCallback((n: number) => {
    setQtyRaw(Math.max(1, Math.min(99, n)));
  }, []);

  const effectivePrice  = selectedVariant?.price    ?? product.price;
  const comparePrice    = selectedVariant?.comparePrice ?? product.comparePrice;
  const effectiveImage  = selectedVariant?.image    ?? product.image ?? product.images?.[0] ?? '';
  const inStock         = (selectedVariant?.stock   ?? product.stock) > 0;

  const discountPct = comparePrice && comparePrice > effectivePrice
    ? Math.round(((comparePrice - effectivePrice) / comparePrice) * 100)
    : 0;

  const addToCart = useCallback(() => {
    cart.addItem({
      productId:   product.id,
      variantId:   selectedVariant?.id,
      name:        product.name,
      variantName: selectedVariant?.name,
      price:       effectivePrice,
      image:       effectiveImage,
      sku:         selectedVariant?.sku ?? product.sku,
    }, quantity);
    setCartAdded(true);
    setTimeout(() => setCartAdded(false), 2000);
  }, [cart, product, selectedVariant, effectivePrice, effectiveImage, quantity]);

  const buyNow = useCallback(() => {
    addToCart();
    // P7: redirect to checkout
    // window.location.href = '/checkout';
  }, [addToCart]);

  const value = useMemo<ProductPageState>(() => ({
    product,
    selectedVariant,
    quantity,
    effectivePrice,
    comparePrice,
    effectiveImage,
    discountPct,
    inStock,
    formattedPrice:   formatCanvasPrice(effectivePrice),
    formattedCompare: comparePrice ? formatCanvasPrice(comparePrice) : null,
    setVariant,
    setQuantity,
    addToCart,
    buyNow,
    cartAdded,
  }), [
    product, selectedVariant, quantity, effectivePrice, comparePrice,
    effectiveImage, discountPct, inStock, cartAdded,
    setVariant, setQuantity, addToCart, buyNow,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
