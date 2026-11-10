import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Minus, Plus, Trash2, ShoppingBag, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { useCartContext } from '@/context/CartContext';
import { useCart, useUpdateCartItem, useRemoveCartItem } from '@/hooks/useCart';
import { inr } from '@/context/StoreContext';

function parseVariantOptions(opts: Record<string, string> | string | null | undefined): Record<string, string> | null {
  if (!opts) return null;
  if (typeof opts === 'string') {
    try { return JSON.parse(opts) as Record<string, string>; } catch { return null; }
  }
  return opts;
}

interface Props {
  accentClass?: string;
  fontClass?: string;
}

const CartDrawer: React.FC<Props> = ({ accentClass = 'bg-gray-900', fontClass = '' }) => {
  const { cartOpen, setCartOpen } = useCartContext();
  const { data: cart, isLoading, isError } = useCart();
  const { mutate: updateItem, isPending: updatingId } = useUpdateCartItem();
  const { mutate: removeItem, isPending: removing } = useRemoveCartItem();

  const items = cart?.items ?? [];
  const totals = cart?.totals;

  useEffect(() => {
    if (!cartOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCartOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [cartOpen, setCartOpen]);

  return (
    <>
      {cartOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[110]"
          onClick={() => setCartOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        role="dialog"
        aria-label="Shopping cart"
        aria-modal="true"
        // Closed = slid off-screen but still mounted: hide it from screen readers and the tab order.
        aria-hidden={!cartOpen}
        {...(!cartOpen && { inert: '' })}
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white z-[120] shadow-2xl transition-transform duration-300 flex flex-col ${fontClass} ${cartOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" aria-hidden="true" />
            <span>Your Bag</span>
            {cart && <span aria-live="polite">({cart.itemCount})</span>}
          </h3>
          <button
            onClick={() => setCartOpen(false)}
            aria-label="Close cart"
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart status banner */}
        {cart?.status === 'LOCKED' && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-2 text-[12px] text-amber-800 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Cart is locked during checkout
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm" aria-live="polite">Loading your cart…</p>
            </div>
          )}

          {/* Error */}
          {isError && !isLoading && (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-500 text-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-sm">Unable to load cart. Please try again.</p>
            </div>
          )}

          {/* Empty */}
          {!isLoading && !isError && items.length === 0 && (
            <div className="text-center text-gray-400 mt-20">
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-40" aria-hidden="true" />
              <p className="text-sm">Your bag is empty.</p>
              <button
                onClick={() => setCartOpen(false)}
                className="mt-4 text-purple-700 text-sm font-semibold hover:underline"
              >
                Continue Shopping
              </button>
            </div>
          )}

          {/* Items */}
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 border-b pb-4">
              <img
                src={item.image || '/placeholder-product.jpg'}
                alt={item.name}
                className="w-20 h-20 rounded-lg object-cover bg-gray-100 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-snug line-clamp-2">{item.name}</p>
                {item.brand && (
                  <p className="text-xs text-gray-400 mt-0.5">{item.brand}</p>
                )}
                {(() => {
                  const opts = parseVariantOptions(item.variantOptions);
                  if (!opts || Object.keys(opts).length === 0) return null;
                  return (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {Object.entries(opts).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                    </p>
                  );
                })()}

                <div className="flex items-center justify-between mt-2">
                  {/* Qty controls */}
                  <div className="flex items-center border rounded-lg" role="group" aria-label="Quantity">
                    <button
                      className="px-2 py-1 hover:bg-gray-50 transition-colors disabled:opacity-40"
                      aria-label="Decrease quantity"
                      disabled={updatingId || removing}
                      onClick={() => {
                        if (item.quantity <= 1) {
                          removeItem(item.id);
                        } else {
                          updateItem({ itemId: item.id, quantity: item.quantity - 1 });
                        }
                      }}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-2 text-sm min-w-[24px] text-center" aria-label={`Quantity: ${item.quantity}`}>
                      {item.quantity}
                    </span>
                    <button
                      className="px-2 py-1 hover:bg-gray-50 transition-colors disabled:opacity-40"
                      aria-label="Increase quantity"
                      disabled={updatingId || removing || item.quantity >= 100}
                      onClick={() => updateItem({ itemId: item.id, quantity: item.quantity + 1 })}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="font-bold text-sm">{inr(item.lineTotal)}</span>
                    {item.comparePrice && item.comparePrice > item.unitPrice && (
                      <span className="block text-[10px] text-gray-400 line-through">
                        {inr(item.comparePrice * item.quantity)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => removeItem(item.id)}
                disabled={removing}
                aria-label={`Remove ${item.name}`}
                className="text-gray-300 hover:text-red-500 transition-colors self-start mt-1 disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        {!isLoading && !isError && items.length > 0 && totals && (
          <div className="border-t bg-white px-5 py-4 flex-shrink-0">
            {/* Mini totals */}
            <div className="space-y-1 mb-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-semibold">{inr(totals.subtotal)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-emerald-700 text-xs">
                  <span>Discount</span>
                  <span>−{inr(totals.discount)}</span>
                </div>
              )}
              {totals.promotionDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 text-xs">
                  <span>Coupon {cart?.couponCode && `(${cart.couponCode})`}</span>
                  <span>−{inr(totals.promotionDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 pt-1 border-t">
                <span>Total</span>
                <span className="text-lg">{inr(totals.grandTotal)}</span>
              </div>
            </div>

            <Link
              to="/cart"
              onClick={() => setCartOpen(false)}
              className={`w-full ${accentClass} text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500`}
              aria-label="View full cart"
            >
              View Full Bag <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      </aside>
    </>
  );
};

export default CartDrawer;
