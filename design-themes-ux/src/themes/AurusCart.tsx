import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { inr } from '@/context/StoreContext';
import {
  ArrowLeft, X, Plus, Minus,
  MapPin, Tag, MessageCircle, Phone,
  RefreshCw, Award, Clock, ShoppingBag, ChevronRight, Check, Loader2, AlertCircle,
} from 'lucide-react';
import { useCart, useUpdateCartItem, useRemoveCartItem, useClearCart, useApplyPromotion, useRemovePromotion } from '@/hooks/useCart';
import { useAuth } from '@/context/CustomerAuthContext';
import GuestCheckoutPrompt from '@/components/storefront/checkout/GuestCheckoutPrompt';
import { CHECKOUT_PATH } from '@/lib/authRedirect';
import { hasSeenCheckoutPrompt, markCheckoutPromptSeen } from '@/lib/checkoutPrompt';

const UI = { fontFamily: 'system-ui, -apple-system, sans-serif' };

function parseVariantOptions(opts: Record<string, string> | string | null | undefined): Record<string, string> | null {
  if (!opts) return null;
  if (typeof opts === 'string') {
    try { return JSON.parse(opts) as Record<string, string>; } catch { return null; }
  }
  return opts;
}

/* ─── TRUST FOOTER ──────────────────────────────────────────────────────────── */
const TrustBar: React.FC = () => (
  <footer className="bg-white border-t border-gray-200 mt-auto" style={UI}>
    <div className="px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-8 flex-wrap">
        {([
          [RefreshCw, '15 Day Exchange',   'On Online Orders'],
          [Award,     '100% Certified',    ''],
          [RefreshCw, 'Lifetime Exchange', ''],
          [Clock,     'One Year Warranty', ''],
        ] as const).map(([Icon, title, sub]: any, i) => (
          <div key={i} className="flex items-center gap-2">
            <Icon className="w-[22px] h-[22px] text-gray-500 flex-shrink-0" strokeWidth={1.5}/>
            <div>
              <p className="text-[13px] font-semibold text-gray-700 leading-none">{title}</p>
              {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {['VISA', 'Mastercard', 'PayPal', 'American Express'].map((b) => (
          <div key={b} className="border border-gray-300 rounded px-2.5 py-1.5 h-[30px] flex items-center">
            <span className="text-[10px] font-bold text-gray-500 whitespace-nowrap">{b}</span>
          </div>
        ))}
      </div>
    </div>
  </footer>
);

/* ─── HEADER ─────────────────────────────────────────────────────────────────── */
const CartHeader: React.FC<{
  activeTab: 'bag' | 'trial';
  setActiveTab: (t: 'bag' | 'trial') => void;
  itemCount: number;
  navigate: ReturnType<typeof useNavigate>;
}> = ({ activeTab, setActiveTab, itemCount, navigate }) => (
  <header className="bg-white border-b border-gray-200 sticky top-0 z-40" style={UI}>
    <div className="px-4 sm:px-6 h-[54px] flex items-center gap-3 sm:gap-4">
      <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-purple-700 transition-colors flex-shrink-0" aria-label="Go back">
        <ArrowLeft className="w-5 h-5"/>
      </button>

      <Link to="/jewellery" aria-label="Aurus — continue shopping" className="w-8 h-8 rounded-full border-2 border-purple-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
        <div className="grid grid-cols-3 gap-[2px] p-1">
          {[...Array(9)].map((_, i) => (
            <div key={i} className={`w-[4px] h-[4px] rounded-full ${[0,2,4,6,8].includes(i) ? 'bg-purple-700' : 'bg-purple-300'}`}/>
          ))}
        </div>
      </Link>

      <div className="flex-1 flex justify-center">
        <div className="inline-flex border border-gray-300 rounded-full overflow-hidden text-[13px]">
          <button
            onClick={() => setActiveTab('bag')}
            className="px-3 sm:px-6 py-[7px] font-medium transition-all whitespace-nowrap"
            style={activeTab === 'bag'
              ? { background: 'linear-gradient(90deg,#9333EA,#7B22F9)', color: '#fff' }
              : { background: '#fff', color: '#555' }}
            aria-pressed={activeTab === 'bag'}
          >
            Shopping Bag ({itemCount})
          </button>
          <button
            onClick={() => setActiveTab('trial')}
            className="px-3 sm:px-6 py-[7px] font-medium transition-all whitespace-nowrap"
            style={activeTab === 'trial'
              ? { background: 'linear-gradient(90deg,#9333EA,#7B22F9)', color: '#fff' }
              : { background: '#fff', color: '#555' }}
            aria-pressed={activeTab === 'trial'}
          >
            Home Trial (0)
          </button>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
        <span className="text-[12px] text-gray-500">Need Assistance?</span>
        <MessageCircle className="w-5 h-5 text-green-500 cursor-pointer"/>
        <Phone className="w-5 h-5 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors"/>
      </div>
    </div>
  </header>
);

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════════ */
const AurusCart: React.FC = () => {
  const navigate = useNavigate();
  const { status: authStatus } = useAuth();

  const { data: cart, isLoading, isError, refetch } = useCart();
  const { mutate: updateItem, isPending: updatingItem } = useUpdateCartItem();
  const { mutate: removeItem, isPending: removingItem } = useRemoveCartItem();
  const { mutate: clearCart, isPending: clearingCart } = useClearCart();
  const { mutate: applyPromo, isPending: applyingPromo } = useApplyPromotion();
  const { mutate: removePromo, isPending: removingPromo } = useRemovePromotion();

  const [activeTab,          setActiveTab]          = useState<'bag'|'trial'>('bag');
  const [pincode,            setPincode]            = useState('');
  const [pincodeOk,          setPincodeOk]          = useState(false);
  const [showPincodeInput,   setShowPincodeInput]   = useState(false);
  const [couponOpen,         setCouponOpen]         = useState(false);
  const [couponInput,        setCouponInput]        = useState('');
  const [accountPromptOpen,  setAccountPromptOpen]  = useState(false);

  const items   = cart?.items ?? [];
  const totals  = cart?.totals;
  const isMutating = updatingItem || removingItem || clearingCart;

  /* ── LOADING ── */
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#F5F3F8', ...UI }}>
        <CartHeader activeTab={activeTab} setActiveTab={setActiveTab} itemCount={0} navigate={navigate}/>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
          <Loader2 className="w-10 h-10 animate-spin text-purple-600"/>
          <p className="text-[14px]" aria-live="polite">Loading your bag…</p>
        </div>
        <TrustBar/>
      </div>
    );
  }

  /* ── ERROR ── */
  if (isError) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#F5F3F8', ...UI }}>
        <CartHeader activeTab={activeTab} setActiveTab={setActiveTab} itemCount={0} navigate={navigate}/>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
          <AlertCircle className="w-12 h-12 text-red-400"/>
          <p className="text-[16px] font-semibold text-gray-800">Unable to load your cart</p>
          <p className="text-[13px] text-gray-500">Please check your connection and try again.</p>
          <button
            onClick={() => refetch()}
            className="bg-purple-700 text-white px-6 py-2.5 text-[13px] font-bold hover:bg-purple-800 transition-colors"
          >
            Retry
          </button>
        </div>
        <TrustBar/>
      </div>
    );
  }

  /* ── EMPTY ── */
  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#F5F3F8', ...UI }}>
        <CartHeader activeTab={activeTab} setActiveTab={setActiveTab} itemCount={0} navigate={navigate}/>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <ShoppingBag className="w-14 h-14 text-purple-200 mb-4" aria-hidden="true"/>
          <h2 className="text-[20px] font-semibold text-gray-800 mb-2">Your Shopping Bag is Empty</h2>
          <p className="text-[13px] text-gray-500 mb-6">Looks like you haven't added anything yet.</p>
          <Link to="/jewellery" className="bg-purple-700 text-white px-8 py-2.5 text-[13px] font-bold tracking-wide hover:bg-purple-800 transition-colors">
            CONTINUE SHOPPING
          </Link>
        </div>
        <TrustBar/>
      </div>
    );
  }

  /* ── LOCKED WARNING ── */
  const isLocked = cart?.status === 'LOCKED';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F5F3F8', ...UI }}>

      <CartHeader activeTab={activeTab} setActiveTab={setActiveTab} itemCount={cart?.itemCount ?? 0} navigate={navigate}/>

      {/* Locked banner */}
      {isLocked && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center gap-2 text-[13px] text-amber-800 font-medium" role="alert">
          <AlertCircle className="w-4 h-4 flex-shrink-0"/>
          Your cart is locked during checkout. Complete or cancel checkout before making changes.
        </div>
      )}

      <div className="flex-1 w-full">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-6 lg:pt-[48px] pb-12">
          {/* Stacks below lg — a fixed-width summary beside the items overflowed phones and clipped PLACE ORDER. */}
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 lg:items-start">

            {/* ═══ LEFT — Cart Items ══════════════════════════════════════════ */}
            <div className="w-full lg:flex-1 min-w-0 space-y-3">

              {/* Video-call banner */}
              <div
                className="flex items-center gap-4 px-5 py-4 rounded-xl"
                style={{ background: 'linear-gradient(90deg,#C8F5EE 0%,#AEEAE1 100%)' }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,137,123,0.2)' }}>
                  <MessageCircle className="w-5 h-5" style={{ color: '#00695C' }}/>
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-bold leading-none mb-1" style={{ color: '#004D40' }}>See it Before You Buy It</p>
                  <p className="text-[12px]" style={{ color: '#00695C' }}>Experience our designs in detail via video call</p>
                </div>
                <button className="flex-shrink-0 text-white text-[11px] font-bold tracking-[0.12em] uppercase px-5 py-2 rounded" style={{ background: '#00796B' }}>
                  SEE IT LIVE
                </button>
              </div>

              {/* Cart items */}
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-lg"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)', opacity: isMutating ? 0.7 : 1, transition: 'opacity 0.15s' }}
                >
                  <div className="flex gap-4 p-4">

                    {/* Product image */}
                    <div className="relative flex-shrink-0" style={{ width: 150, height: 150 }}>
                      <div className="w-full h-full rounded overflow-hidden flex items-center justify-center" style={{ background: '#FAFAFA', border: '1px solid #F0F0F0' }}>
                        <img
                          src={item.image || '/placeholder-product.jpg'}
                          alt={item.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 justify-between">
                        <Link
                          to={`/products/${item.productId}`}
                          className="text-[14px] font-semibold text-gray-900 hover:text-purple-700 transition-colors leading-snug line-clamp-2 flex-1"
                        >
                          {item.name}
                        </Link>
                        <button
                          onClick={() => removeItem(item.id)}
                          disabled={removingItem || isLocked}
                          className="flex-shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
                          style={{ background: '#333' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#C62828')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '#333')}
                          aria-label={`Remove ${item.name}`}
                        >
                          <X className="w-3 h-3 text-white"/>
                        </button>
                      </div>

                      {/* Brand */}
                      {item.brand && (
                        <p className="text-[11px] text-purple-600 font-semibold mt-0.5 uppercase tracking-wide">{item.brand}</p>
                      )}

                      {/* Price row */}
                      <div className="flex items-baseline gap-2 mt-2 flex-wrap">
                        <span className="text-[15px] font-bold text-gray-900">{inr(item.lineTotal)}</span>
                        {item.comparePrice && item.comparePrice > item.unitPrice && (
                          <span className="text-[13px] text-gray-500 line-through">{inr(item.comparePrice * item.quantity)}</span>
                        )}
                        {item.lineDiscount > 0 && (
                          <span className="text-[12px] font-bold" style={{ color: '#C2185B' }}>
                            Save {inr(item.lineDiscount)}
                          </span>
                        )}
                      </div>

                      {/* SKU */}
                      <p className="text-[11px] text-gray-500 mt-0.5 uppercase tracking-wide">{item.sku}</p>

                      {/* Quantity controls */}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2 text-[13px] text-gray-700">
                          <span>Quantity:</span>
                          <div className="flex items-center" role="group" aria-label="Quantity">
                            <button
                              onClick={() => {
                                if (item.quantity <= 1) removeItem(item.id);
                                else updateItem({ itemId: item.id, quantity: item.quantity - 1 });
                              }}
                              disabled={updatingItem || removingItem || isLocked}
                              className="w-[20px] h-[20px] rounded-full border border-gray-400 flex items-center justify-center hover:border-purple-600 disabled:opacity-30 transition-colors"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3 h-3"/>
                            </button>
                            <span className="font-semibold px-2 min-w-[24px] text-center" aria-label={`Quantity: ${item.quantity}`}>
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateItem({ itemId: item.id, quantity: item.quantity + 1 })}
                              disabled={updatingItem || removingItem || isLocked || item.quantity >= 100}
                              className="w-[20px] h-[20px] rounded-full border border-gray-400 flex items-center justify-center hover:border-purple-600 disabled:opacity-30 transition-colors"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3 h-3"/>
                            </button>
                          </div>
                        </div>
                        <button className="text-[12.5px] underline underline-offset-2" style={{ color: '#C2185B' }}>
                          Check Delivery Date
                        </button>
                      </div>

                      {/* Variant chips */}
                      {(() => {
                        const opts = parseVariantOptions(item.variantOptions);
                        if (!opts || Object.keys(opts).length === 0) return null;
                        return (
                          <div className="flex gap-2 mt-2.5 flex-wrap">
                            {Object.entries(opts).map(([k, v]) => (
                              <span key={k} className="text-[10px] border border-gray-300 text-gray-600 px-2.5 py-0.5 rounded-full bg-white capitalize">
                                {k}: {v}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}

              {/* Clear cart */}
              {items.length > 0 && !isLocked && (
                <div className="text-right">
                  <button
                    onClick={() => clearCart()}
                    disabled={clearingCart || updatingItem || removingItem}
                    className="text-[12px] text-gray-600 hover:text-red-500 transition-colors underline underline-offset-2 disabled:opacity-40"
                  >
                    {clearingCart ? 'Clearing…' : 'Clear cart'}
                  </button>
                </div>
              )}
            </div>

            {/* ═══ RIGHT — Order Summary ═══════════════════════════════════ */}
            <div className="w-full lg:w-[360px] flex-shrink-0 space-y-3 lg:mt-6">

              {/* Apply Coupon */}
              <div className="rounded-xl overflow-hidden" style={{ background: '#EDE9FE' }}>
                <button
                  onClick={() => setCouponOpen((o) => !o)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-100 transition-colors"
                  aria-expanded={couponOpen}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#DDD6FE' }}>
                    <Tag className="w-4 h-4" style={{ color: '#7C3AED' }}/>
                  </div>
                  <span className="flex-1 text-[13px] font-semibold text-gray-800 text-left">
                    {cart?.couponCode ? `Coupon: ${cart.couponCode}` : 'Apply Coupon'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-500"/>
                </button>

                {couponOpen && (
                  <div className="px-4 pb-3 border-t border-purple-200">
                    {cart?.couponCode ? (
                      <div className="flex items-center justify-between mt-2.5">
                        <span className="text-[12px] font-bold text-purple-800">{cart.couponCode}</span>
                        <button
                          onClick={() => removePromo(cart.couponCode!)}
                          disabled={removingPromo}
                          className="text-[11px] text-red-600 font-semibold hover:underline disabled:opacity-40"
                        >
                          {removingPromo ? 'Removing…' : 'Remove'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2 mt-2.5">
                        <input
                          type="text"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                          placeholder="Enter coupon code"
                          className="flex-1 border border-purple-300 bg-white px-3 py-1.5 text-[12px] rounded outline-none focus:border-purple-600"
                          aria-label="Coupon code"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && couponInput && !applyingPromo) {
                              applyPromo(couponInput, { onSuccess: () => { setCouponInput(''); setCouponOpen(false); } });
                            }
                          }}
                        />
                        <button
                          disabled={!couponInput || applyingPromo}
                          onClick={() => applyPromo(couponInput, { onSuccess: () => { setCouponInput(''); setCouponOpen(false); } })}
                          className="bg-purple-700 hover:bg-purple-800 disabled:opacity-40 text-white px-3 py-1.5 text-[12px] font-bold rounded transition-colors"
                        >
                          {applyingPromo ? '…' : 'Apply'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Delivery check */}
              <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div className="flex items-center gap-2.5 px-4 py-3">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-gray-500"/>
                  </div>
                  <span className="flex-1 text-[12.5px] font-semibold text-gray-700 leading-tight">
                    Check Delivery &amp; Store Details
                  </span>
                  {pincodeOk ? (
                    <span className="text-[11px] text-green-600 font-semibold flex items-center gap-0.5">
                      <Check className="w-3 h-3"/> Done
                    </span>
                  ) : (
                    <button
                      onClick={() => setShowPincodeInput((o) => !o)}
                      className="text-[12px] font-semibold hover:opacity-80 transition-opacity whitespace-nowrap"
                      style={{ color: '#C2185B' }}
                    >
                      {showPincodeInput ? 'Cancel' : 'Enter Pincode'}
                    </button>
                  )}
                </div>
                {showPincodeInput && !pincodeOk && (
                  <div className="px-4 pb-3 border-t border-gray-100 pt-2.5 flex gap-2">
                    <input
                      type="number"
                      value={pincode}
                      autoFocus
                      onChange={(e) => setPincode(e.target.value.slice(0, 6))}
                      placeholder="Enter 6-digit pincode"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-[12px] outline-none focus:border-pink-400 transition-colors"
                      aria-label="Delivery pincode"
                    />
                    <button
                      onClick={() => { if (pincode.length === 6) { setPincodeOk(true); setShowPincodeInput(false); } }}
                      disabled={pincode.length !== 6}
                      className="text-[11px] font-bold border rounded-lg px-3 py-1.5 disabled:opacity-40 transition-colors hover:border-pink-400"
                      style={{ color: '#C2185B', borderColor: '#C2185B' }}
                    >
                      Check
                    </button>
                  </div>
                )}
              </div>

              {/* Shipping estimate */}
              {cart?.shipping && cart.shipping.methods.length > 0 && (
                <div className="bg-white rounded-xl px-4 py-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Shipping Options</p>
                  {cart.shipping.methods.map((m) => (
                    <div key={m.id} className="flex justify-between items-center py-1 text-[12px]">
                      <span className="text-gray-700">{m.name}</span>
                      <span className="font-semibold text-emerald-700">
                        {m.cost === 0 ? 'Free' : inr(m.cost)}
                        {m.estimatedDays && <span className="text-gray-400 font-normal ml-1">({m.estimatedDays})</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Price breakdown */}
              {totals && (
                <div className="bg-white rounded-xl px-4 py-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <div className="space-y-3 text-[13px]">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="font-semibold text-gray-800">{inr(totals.subtotal)}</span>
                    </div>
                    {totals.discount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Discount</span>
                        <span className="font-bold" style={{ color: '#00796B' }}>− {inr(totals.discount)}</span>
                      </div>
                    )}
                    {totals.promotionDiscount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Coupon {cart?.couponCode && `(${cart.couponCode})`}</span>
                        <span className="font-bold" style={{ color: '#00796B' }}>− {inr(totals.promotionDiscount)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Shipping</span>
                      <span className="font-semibold" style={{ color: '#00796B' }}>
                        {totals.shippingCost === 0 ? 'Free' : inr(totals.shippingCost)}
                      </span>
                    </div>
                    {totals.tax > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Tax</span>
                        <span className="font-semibold text-gray-800">{inr(totals.tax)}</span>
                      </div>
                    )}
                  </div>

                  <div className="h-px my-3" style={{ background: '#E5E7EB' }}/>

                  <div className="flex items-center justify-between">
                    <span className="text-[14.5px] font-bold text-gray-900">Total Cost</span>
                    <span className="text-[15px] font-black text-gray-900" aria-live="polite">{inr(totals.grandTotal)}</span>
                  </div>
                </div>
              )}

              {/* PLACE ORDER */}
              <Link
                to="/checkout"
                className={`block w-full py-3.5 text-white text-[13.5px] font-black tracking-[0.14em] uppercase rounded-xl hover:opacity-90 active:scale-[0.98] transition-all text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}
                style={{ background: 'linear-gradient(90deg,#9333EA 0%,#7B22F9 100%)', boxShadow: '0 4px 14px rgba(124,58,237,0.4)' }}
                aria-disabled={isLocked}
                onClick={(e) => {
                  if (isLocked) { e.preventDefault(); return; }
                  // Guests get the optional account prompt once per checkout
                  // attempt; everyone else (incl. auth still restoring) goes
                  // straight through, since checkout works either way.
                  if (authStatus === 'unauthenticated' && !hasSeenCheckoutPrompt()) {
                    e.preventDefault();
                    markCheckoutPromptSeen();
                    setAccountPromptOpen(true);
                  }
                }}
              >
                {isLocked ? 'CHECKOUT IN PROGRESS' : 'PLACE ORDER'}
              </Link>
              <GuestCheckoutPrompt
                open={accountPromptOpen}
                onOpenChange={setAccountPromptOpen}
                onContinueAsGuest={() => navigate(CHECKOUT_PATH)}
              />

              {/* Activity indicator */}
              {cart?.lastActivityAt && (
                <p className="text-[10px] text-gray-600 text-center">
                  Last updated {new Date(cart.lastActivityAt).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <TrustBar/>
    </div>
  );
};

export default AurusCart;
