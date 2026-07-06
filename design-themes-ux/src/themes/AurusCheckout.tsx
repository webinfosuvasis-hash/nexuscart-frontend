import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { inr } from '@/context/StoreContext';
import { useCart, useApplyPromotion, useRemovePromotion } from '@/hooks/useCart';
import { useAuth } from '@/context/CustomerAuthContext';
import { useAddresses, useCreateAddress } from '@/hooks/useCustomerAddresses';
import {
  useStartCheckout, useUpdateCheckoutAddress, useUpdateCheckoutShipping, useValidateCheckout,
  checkoutErrorMessage,
} from '@/hooks/useCheckout';
import { useInitiatePayment, useRetryPayment } from '@/hooks/useCustomerPayment';
import { CheckoutSession, AddressInput } from '@/lib/checkoutApi';
import { CustomerAddress } from '@/lib/customerAddressApi';
import { normalizeIndiaStateCode } from '@/lib/indiaStateCodes';
import {
  ArrowLeft, Check, ChevronRight, MapPin, CreditCard,
  Truck, Lock, ShoppingBag, Loader2, Tag, X, AlertTriangle, RefreshCw,
} from 'lucide-react';

const UI    = { fontFamily: 'system-ui, -apple-system, sans-serif' };
const SERIF = { fontFamily: "'Cormorant Garamond', Georgia, serif" };

type Step = 'address' | 'shipping' | 'review' | 'payment';

function stepFromCheckout(checkout: CheckoutSession | null): Step {
  if (!checkout) return 'address';
  const hasShippingAddress = checkout.addresses.some((a) => a.type === 'SHIPPING');
  if (!hasShippingAddress) return 'address';
  if (!checkout.selectedShippingMethod) return 'shipping';
  return 'review';
}

/**
 * Review Your Bag — the only point in this flow where a coupon can be
 * applied or removed. Once `POST /checkout/start` runs, the checkout engine
 * hard-blocks the session the moment `cart.version` no longer matches the
 * version it was started with (CART_CHANGED — a permanent blocker with no
 * "resync" endpoint available), so applying a coupon *after* checkout has
 * started would silently and permanently break that checkout. Discovered
 * live while building this integration — not a documented constraint
 * anywhere, just how the existing (unmodified) checkout engine behaves.
 */
const BagReviewSection: React.FC<{ onProceed: () => void; isStartingCheckout: boolean }> = ({ onProceed, isStartingCheckout }) => {
  const navigate = useNavigate();
  const { data: cart, isLoading } = useCart();
  const applyPromotion = useApplyPromotion();
  const removePromotion = useRemovePromotion();
  const [couponCode, setCouponCode] = useState('');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F3FA]" style={UI}>
        <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
      </div>
    );
  }

  const items = cart?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F3FA]" style={UI}>
        <ShoppingBag className="w-14 h-14 text-purple-200 mb-4" />
        <p className="text-[18px] font-semibold text-gray-700 mb-4">Your cart is empty</p>
        <Link to="/jewellery/rings" className="bg-purple-700 text-white px-8 py-2.5 rounded-full text-[13px] font-bold hover:bg-purple-800 transition-colors">
          Browse Collection
        </Link>
      </div>
    );
  }

  const totals = cart!.totals;

  return (
    <div className="min-h-screen bg-[#F5F3FA]" style={UI}>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-[1280px] mx-auto px-6 h-[54px] flex items-center gap-4">
          <button onClick={() => navigate('/cart')} className="text-gray-600 hover:text-purple-700 transition-colors flex items-center gap-1.5 text-[13px]">
            <ArrowLeft className="w-4 h-4" /> Back to Bag
          </button>
          <div className="flex-1 text-center">
            <span className="text-[18px] font-light text-gray-900" style={SERIF}>Review Your Bag</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px]" style={UI}>
            <span className="text-purple-700 font-bold">① Review</span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-gray-400">② Address</span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-gray-400">③ Shipping</span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-gray-400">④ Review &amp; Pay</span>
          </div>
        </div>
      </header>

      <div className="max-w-[1280px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-5">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-[15px] font-bold text-gray-900 mb-4">Your Items</h2>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-gray-800 line-clamp-1">{item.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Qty: {item.quantity}</p>
                  </div>
                  <span className="text-[13px] font-bold text-gray-900 flex-shrink-0">{inr(item.lineTotal)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Tag className="w-4.5 h-4.5 text-purple-600" style={{ width: 18, height: 18 }} />
              <h2 className="text-[15px] font-bold text-gray-900">Have a coupon?</h2>
            </div>
            {cart?.couponCode ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <p className="text-[13px] font-bold text-green-700">{cart.couponCode}</p>
                <button
                  onClick={() => removePromotion.mutate(cart.couponCode!)}
                  disabled={removePromotion.isPending}
                  className="text-green-700 hover:text-red-600 transition-colors disabled:opacity-50"
                  aria-label="Remove coupon"
                >
                  {removePromotion.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Enter coupon code"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-[13px] outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                />
                <button
                  onClick={() => applyPromotion.mutate(couponCode.trim().toUpperCase())}
                  disabled={applyPromotion.isPending || !couponCode.trim()}
                  className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-[13px] font-bold rounded-lg transition-colors"
                >
                  {applyPromotion.isPending ? 'Applying…' : 'Apply'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm px-5 py-4 space-y-2.5">
            <PriceRow label="Subtotal" value={inr(totals.subtotal)} />
            {totals.discount > 0 && <PriceRow label="Discount" value={`− ${inr(totals.discount)}`} valueColor="#00897B" />}
            {totals.promotionDiscount > 0 && <PriceRow label="Coupon Discount" value={`− ${inr(totals.promotionDiscount)}`} valueColor="#00897B" />}
            <div className="h-px bg-gray-200 my-1" />
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold text-gray-900">Estimated Total</span>
              <span className="text-[16px] font-black text-gray-900">{inr(totals.grandTotal)}</span>
            </div>
            <p className="text-[11px] text-gray-400">Shipping &amp; tax calculated at the next step</p>
          </div>

          <button
            onClick={onProceed}
            disabled={isStartingCheckout}
            className="w-full py-4 text-white text-[14px] font-black tracking-[0.12em] uppercase rounded-xl transition-all disabled:opacity-60 hover:opacity-90 active:scale-[0.98]"
            style={{ background: 'linear-gradient(90deg,#9333EA,#7B22F9)', boxShadow: '0 4px 14px rgba(124,58,237,0.4)' }}
          >
            {isStartingCheckout ? 'Starting Checkout…' : 'Proceed to Checkout'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Order success overlay ──────────────────────────────────────── */
const OrderSuccess: React.FC<{ orderId: string; total: number; onClose: () => void }> = ({ orderId, total, onClose }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
    <div className="bg-white rounded-2xl shadow-2xl max-w-[420px] w-full p-8 text-center" style={UI}>
      <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
        <Check className="w-10 h-10 text-green-500" strokeWidth={2.5} />
      </div>
      <h2 className="text-[22px] font-bold text-gray-900 mb-1">Order Confirmed!</h2>
      <p className="text-[13px] text-gray-500 mb-4">Thank you for shopping with Aurus. Your order is on its way.</p>

      <div className="bg-purple-50 border border-purple-100 rounded-xl px-5 py-3 mb-4">
        <p className="text-[11px] text-purple-500 uppercase tracking-wide font-semibold">Order ID</p>
        <p className="text-[16px] font-black text-purple-700 mt-0.5 tracking-wider break-all">{orderId}</p>
      </div>

      <div className="text-left space-y-2 text-[12.5px] text-gray-600 border-t border-gray-100 pt-4 mb-6">
        <div className="flex justify-between">
          <span>Amount paid</span>
          <span className="font-bold text-gray-900">{inr(total)}</span>
        </div>
      </div>

      <Link
        to="/jewellery/rings"
        onClick={onClose}
        className="block w-full py-3 bg-purple-700 hover:bg-purple-800 text-white font-bold text-[13px] tracking-wide rounded-full transition-colors mb-3"
      >
        Continue Shopping
      </Link>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════
   CHECKOUT PAGE
═══════════════════════════════════════════════════════════════════ */
const AurusCheckout: React.FC = () => {
  const navigate = useNavigate();
  const { data: cartData, isLoading: isCartLoading } = useCart();
  const { isAuthenticated, customer } = useAuth();

  // Checkout is only started once the customer leaves the bag-review step —
  // see the comment above BagReviewSection for why: the checkout engine
  // hard-blocks any checkout whose cart was mutated after `start` (its own
  // CART_CHANGED guard, not something this app can bypass), so a coupon can
  // only ever be applied to the cart *before* checkout begins.
  const [hasProceededPastBag, setHasProceededPastBag] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutSession | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const startCheckout = useStartCheckout();
  const updateAddress = useUpdateCheckoutAddress();
  const updateShipping = useUpdateCheckoutShipping();
  const validateCheckout = useValidateCheckout();
  const initiatePayment = useInitiatePayment();
  const retryPayment = useRetryPayment();

  const [gatewayCode, setGatewayCode] = useState<'cod' | 'razorpay'>('cod');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ orderId: string; total: number } | null>(null);

  const items = cartData?.items ?? [];

  // Auto-start checkout once the customer has confirmed their bag and the cart is loaded.
  useEffect(() => {
    if (!hasProceededPastBag || isCartLoading || items.length === 0 || checkout || startCheckout.isPending) return;
    startCheckout.mutate(undefined, {
      onSuccess: (session) => setCheckout(session),
      onError: (err) => setCheckoutError(checkoutErrorMessage(err, 'Could not start checkout. Please try again.')),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProceededPastBag, isCartLoading, items.length, checkout]);

  const step = stepFromCheckout(checkout);

  const handleAddressSubmit = (address: AddressInput) => {
    if (!checkout) return;
    updateAddress.mutate(
      { checkoutId: checkout.id, address, billingSameAsShipping: true },
      { onSuccess: setCheckout },
    );
  };

  const handleShippingSelect = (shippingMethodId: string) => {
    if (!checkout) return;
    updateShipping.mutate(
      { checkoutId: checkout.id, shippingMethodId },
      {
        onSuccess: (session) => {
          setCheckout(session);
          validateCheckout.mutate(session.id, { onSuccess: setCheckout });
        },
      },
    );
  };

  const handlePay = () => {
    if (!checkout) return;
    setPaymentFailed(false);
    initiatePayment.mutate(
      { checkoutId: checkout.id, gatewayCode },
      {
        onSuccess: (result) => {
          setPaymentId(result.paymentId);
          if (result.redirectUrl) {
            window.location.href = result.redirectUrl;
            return;
          }
          if (result.status === 'CAPTURED' && result.orderId) {
            setOrderSuccess({ orderId: result.orderId, total: checkout.totals.grandTotal });
            return;
          }
          if (result.status === 'FAILED') {
            setPaymentFailed(true);
          }
        },
      },
    );
  };

  const handleRetryPayment = () => {
    if (!paymentId) return;
    setPaymentFailed(false);
    retryPayment.mutate(paymentId, {
      onSuccess: (result) => {
        setPaymentId(result.paymentId);
        if (result.redirectUrl) {
          window.location.href = result.redirectUrl;
          return;
        }
        if (result.status === 'CAPTURED' && result.orderId && checkout) {
          setOrderSuccess({ orderId: result.orderId, total: checkout.totals.grandTotal });
          return;
        }
        if (result.status === 'FAILED') {
          setPaymentFailed(true);
        }
      },
    });
  };

  /* Loading */
  if (isCartLoading || (startCheckout.isPending && !checkout)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F3FA]" style={UI}>
        <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
      </div>
    );
  }

  /* Empty cart */
  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F3FA]" style={UI}>
        <ShoppingBag className="w-14 h-14 text-purple-200 mb-4" />
        <p className="text-[18px] font-semibold text-gray-700 mb-4">Your cart is empty</p>
        <Link to="/jewellery/rings" className="bg-purple-700 text-white px-8 py-2.5 rounded-full text-[13px] font-bold hover:bg-purple-800 transition-colors">
          Browse Collection
        </Link>
      </div>
    );
  }

  /* Checkout failed to start */
  if (checkoutError && !checkout) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F3FA] px-4" style={UI}>
        <AlertTriangle className="w-14 h-14 text-red-300 mb-4" />
        <p className="text-[16px] font-semibold text-gray-700 mb-2 text-center">{checkoutError}</p>
        <Link to="/cart" className="text-[13px] text-purple-700 font-semibold hover:underline mt-2">
          Back to Bag
        </Link>
      </div>
    );
  }

  /* Bag review — the only place a coupon can be applied/removed (see BagReviewSection) */
  if (!hasProceededPastBag || !checkout) {
    return <BagReviewSection onProceed={() => setHasProceededPastBag(true)} isStartingCheckout={startCheckout.isPending} />;
  }

  const totals = checkout.totals;

  return (
    <div className="min-h-screen bg-[#F5F3FA]" style={UI}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-[1280px] mx-auto px-6 h-[54px] flex items-center gap-4">
          <button onClick={() => navigate('/cart')} className="text-gray-600 hover:text-purple-700 transition-colors flex items-center gap-1.5 text-[13px]">
            <ArrowLeft className="w-4 h-4" /> Back to Bag
          </button>
          <div className="flex-1 text-center">
            <span className="text-[18px] font-light text-gray-900" style={SERIF}>Checkout</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px]" style={UI}>
            <span className={step === 'address' ? 'text-purple-700 font-bold' : 'text-gray-400'}>① Address</span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className={step === 'shipping' ? 'text-purple-700 font-bold' : 'text-gray-400'}>② Shipping</span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className={step === 'review' || step === 'payment' ? 'text-purple-700 font-bold' : 'text-gray-400'}>③ Review &amp; Pay</span>
          </div>
        </div>
      </header>

      <div className="max-w-[1280px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* ── LEFT ── */}
        <div className="space-y-5">
          <AddressSection
            checkout={checkout}
            isSaving={updateAddress.isPending}
            onSubmit={handleAddressSubmit}
          />

          {step !== 'address' && (
            <ShippingSection
              checkout={checkout}
              isSaving={updateShipping.isPending}
              onSelect={handleShippingSelect}
            />
          )}

        </div>

        {/* ── RIGHT: Summary + Pay ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-[14px] font-bold text-gray-900 mb-4">
              Order Summary ({checkout.items.length} item{checkout.items.length > 1 ? 's' : ''})
            </h2>
            <div className="space-y-3">
              {checkout.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-gray-800 line-clamp-1">{item.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Qty: {item.quantity}</p>
                  </div>
                  <span className="text-[13px] font-bold text-gray-900 flex-shrink-0">{inr(item.lineTotal)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm px-5 py-4 space-y-2.5">
            <PriceRow label="Subtotal" value={inr(totals.subtotal)} />
            {totals.totalDiscount > 0 && <PriceRow label="Discount" value={`− ${inr(totals.totalDiscount)}`} valueColor="#00897B" />}
            {totals.promotionDiscount > 0 && (
              <PriceRow label={`Coupon (${checkout.appliedPromotion?.code ?? ''})`} value={`− ${inr(totals.promotionDiscount)}`} valueColor="#00897B" />
            )}
            <PriceRow label="Shipping" value={totals.shippingCost === 0 ? 'FREE' : inr(totals.shippingCost)} valueColor={totals.shippingCost === 0 ? '#00897B' : undefined} />
            <PriceRow label="Tax" value={inr(totals.taxAmount)} />
            <div className="h-px bg-gray-200 my-1" />
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold text-gray-900">Total</span>
              <span className="text-[16px] font-black text-gray-900">{inr(totals.grandTotal)}</span>
            </div>
          </div>

          {checkout.validation.issues.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-[12px] text-amber-800 space-y-1">
              {checkout.validation.issues.map((issue, i) => (
                <p key={i}>{issue.message}</p>
              ))}
            </div>
          )}

          {(step === 'review' || step === 'payment') && (
            <PaymentSection
              isAuthenticated={isAuthenticated}
              checkout={checkout}
              gatewayCode={gatewayCode}
              onGatewayChange={setGatewayCode}
              onPay={handlePay}
              isPaying={initiatePayment.isPending}
              paymentFailed={paymentFailed}
              onRetry={handleRetryPayment}
              isRetrying={retryPayment.isPending}
              grandTotal={totals.grandTotal}
            />
          )}

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
            <Lock className="w-3 h-3" />
            100% Secure &amp; Encrypted Payment
          </div>
        </div>
      </div>

      {orderSuccess && (
        <OrderSuccess
          orderId={orderSuccess.orderId}
          total={orderSuccess.total}
          onClose={() => { setOrderSuccess(null); navigate('/jewellery/rings'); }}
        />
      )}
    </div>
  );
};

/* ─── Address section ─────────────────────────────────────────────────── */
const AddressSection: React.FC<{
  checkout: CheckoutSession;
  isSaving: boolean;
  onSubmit: (address: AddressInput) => void;
}> = ({ checkout, isSaving, onSubmit }) => {
  const { isAuthenticated, customer } = useAuth();
  const { data: addresses, isLoading: isLoadingAddresses } = useAddresses(isAuthenticated);
  const createAddress = useCreateAddress();

  const shippingAddress = checkout.addresses.find((a) => a.type === 'SHIPPING');
  const [isEditing, setIsEditing] = useState(!shippingAddress);
  const [mode, setMode] = useState<'select' | 'new'>('select');
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: '', lastName: '', line1: '', line2: '', city: '', state: '', postalCode: '', phone: '',
  });
  const FIELD_MAX_LENGTH: Partial<Record<keyof typeof form, number>> = { phone: 10, postalCode: 6 };
  const set = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v.slice(0, FIELD_MAX_LENGTH[key] ?? 255) }));

  useEffect(() => {
    if (isAuthenticated && addresses && addresses.length > 0 && !selectedAddressId) {
      const preferred = addresses.find((a) => a.isDefault) ?? addresses[0];
      setSelectedAddressId(preferred.id);
    }
  }, [isAuthenticated, addresses, selectedAddressId]);

  if (!isEditing && shippingAddress) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-purple-600" />
            <h2 className="text-[15px] font-bold text-gray-900">Delivery Address</h2>
          </div>
          <button onClick={() => setIsEditing(true)} className="text-[12px] font-semibold text-purple-700 hover:underline">
            Change
          </button>
        </div>
        <p className="text-[13px] text-gray-700">{shippingAddress.firstName} {shippingAddress.lastName}</p>
        <p className="text-[12.5px] text-gray-500">{shippingAddress.line1}{shippingAddress.line2 ? `, ${shippingAddress.line2}` : ''}</p>
        <p className="text-[12.5px] text-gray-500">{shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}</p>
        <p className="text-[12.5px] text-gray-500">{shippingAddress.phone}</p>
      </div>
    );
  }

  const submitSavedAddress = (addr: CustomerAddress) => {
    setAddressError(null);
    if (!addr.phone) {
      setAddressError('This address has no phone number. Please edit it in your Address Book, or add a new one below.');
      return;
    }
    const [fallbackFirst, ...rest] = (customer?.name ?? 'Customer').split(' ');
    onSubmit({
      firstName: addr.firstName || fallbackFirst,
      lastName: addr.lastName || rest.join(' ') || fallbackFirst,
      line1: addr.line1,
      line2: addr.line2 ?? undefined,
      city: addr.city,
      state: normalizeIndiaStateCode(addr.state),
      postalCode: addr.postalCode,
      country: addr.country,
      phone: addr.phone,
      email: customer?.email,
      sourceAddressId: addr.id,
    });
    setIsEditing(false);
  };

  const submitNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressError(null);
    if (!form.firstName.trim() || !form.lastName.trim() || !form.line1.trim() || !form.city.trim() || !form.state.trim() || !form.postalCode.trim() || !form.phone.trim()) {
      setAddressError('Please fill in all required fields.');
      return;
    }

    const input: AddressInput = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      line1: form.line1.trim(),
      line2: form.line2.trim() || undefined,
      city: form.city.trim(),
      state: normalizeIndiaStateCode(form.state.trim()),
      postalCode: form.postalCode.trim(),
      country: 'IN',
      phone: form.phone.trim(),
      email: customer?.email,
    };

    if (isAuthenticated) {
      try {
        // Saved to the Address Book in the user's own original wording
        // (form.state, not the normalized code) — normalization is only
        // needed at the checkout-submission boundary above.
        const saved = await createAddress.mutateAsync({
          label: 'Home', firstName: input.firstName, lastName: input.lastName, line1: input.line1,
          line2: input.line2, city: input.city, state: form.state.trim(), postalCode: input.postalCode, phone: input.phone,
        });
        input.sourceAddressId = saved.id;
      } catch {
        // Non-fatal — proceed with the entered address even if saving to the book failed.
      }
    }

    onSubmit(input);
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-2 mb-5">
        <MapPin className="w-4.5 h-4.5 text-purple-600" style={{ width: 18, height: 18 }} />
        <h2 className="text-[15px] font-bold text-gray-900">Delivery Address</h2>
      </div>

      {addressError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-[12.5px] rounded-lg px-4 py-3 mb-4">{addressError}</div>
      )}

      {isAuthenticated && mode === 'select' && (
        <div className="space-y-3">
          {isLoadingAddresses && <Loader2 className="w-5 h-5 animate-spin text-purple-600" />}
          {!isLoadingAddresses && addresses && addresses.length === 0 && (
            <p className="text-[13px] text-gray-500 mb-2">You don&apos;t have any saved addresses yet.</p>
          )}
          {!isLoadingAddresses && addresses?.map((addr) => (
            <label
              key={addr.id}
              className="flex items-start gap-3 border-2 rounded-xl px-4 py-3 cursor-pointer transition-colors"
              style={{ borderColor: selectedAddressId === addr.id ? '#7C3AED' : '#E5E7EB', background: selectedAddressId === addr.id ? '#FAF5FF' : '#fff' }}
            >
              <input
                type="radio"
                name="address"
                checked={selectedAddressId === addr.id}
                onChange={() => setSelectedAddressId(addr.id)}
                className="mt-1"
              />
              <div className="text-[12.5px]">
                <p className="font-semibold text-gray-800">{addr.label || 'Address'} {addr.isDefault && <span className="text-purple-600 text-[10px] font-bold uppercase ml-1">Default</span>}</p>
                <p className="text-gray-600">{[addr.firstName, addr.lastName].filter(Boolean).join(' ')}</p>
                <p className="text-gray-500">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} {addr.postalCode}</p>
                {addr.phone && <p className="text-gray-500">{addr.phone}</p>}
              </div>
            </label>
          ))}

          <div className="flex gap-3 pt-1">
            <button
              disabled={!selectedAddressId || isSaving}
              onClick={() => {
                const addr = addresses?.find((a) => a.id === selectedAddressId);
                if (addr) submitSavedAddress(addr);
              }}
              className="flex-1 py-2.5 text-white text-[13px] font-bold rounded-lg transition-all disabled:opacity-50 hover:opacity-90"
              style={{ background: 'linear-gradient(90deg,#9333EA,#7B22F9)' }}
            >
              {isSaving ? 'Saving…' : 'Deliver to this address'}
            </button>
            <button
              onClick={() => setMode('new')}
              className="flex-1 py-2.5 border border-purple-200 text-purple-700 text-[13px] font-semibold rounded-lg hover:bg-purple-50 transition-colors"
            >
              + Add New Address
            </button>
          </div>
        </div>
      )}

      {(!isAuthenticated || mode === 'new') && (
        <form onSubmit={submitNewAddress} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="First Name *" value={form.firstName} onChange={set('firstName')} placeholder="Priya" />
            <Field label="Last Name *" value={form.lastName} onChange={set('lastName')} placeholder="Sharma" />
            <Field label="Mobile Number *" value={form.phone} onChange={set('phone')} placeholder="10-digit number" type="tel" />
            <Field label="Pincode *" value={form.postalCode} onChange={set('postalCode')} placeholder="6-digit pincode" type="tel" />
            <Field label="City *" value={form.city} onChange={set('city')} placeholder="Mumbai" />
            <Field label="State *" value={form.state} onChange={set('state')} placeholder="Maharashtra" />
            <div className="sm:col-span-2">
              <Field label="Address (House / Flat / Area) *" value={form.line1} onChange={set('line1')} placeholder="House No., Street, Locality" />
            </div>
            <div className="sm:col-span-2">
              <Field label="Landmark" value={form.line2} onChange={set('line2')} placeholder="Optional" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              disabled={isSaving || createAddress.isPending}
              className="flex-1 py-2.5 text-white text-[13px] font-bold rounded-lg transition-all disabled:opacity-50 hover:opacity-90"
              style={{ background: 'linear-gradient(90deg,#9333EA,#7B22F9)' }}
            >
              {isSaving || createAddress.isPending ? 'Saving…' : 'Deliver to this address'}
            </button>
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => setMode('select')}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-[13px] font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
};

/* ─── Shipping section ─────────────────────────────────────────────────── */
const ShippingSection: React.FC<{
  checkout: CheckoutSession;
  isSaving: boolean;
  onSelect: (shippingMethodId: string) => void;
}> = ({ checkout, isSaving, onSelect }) => (
  <div className="bg-white rounded-xl shadow-sm p-6">
    <div className="flex items-center gap-2 mb-5">
      <Truck className="w-4.5 h-4.5 text-purple-600" style={{ width: 18, height: 18 }} />
      <h2 className="text-[15px] font-bold text-gray-900">Shipping Method</h2>
    </div>
    <div className="space-y-3">
      {checkout.availableShippingMethods.map((m) => {
        const sel = checkout.selectedShippingMethod?.id === m.id;
        return (
          <button
            key={m.id}
            disabled={isSaving}
            onClick={() => onSelect(m.id)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left disabled:opacity-60"
            style={{ borderColor: sel ? '#7C3AED' : '#E5E7EB', background: sel ? '#FAF5FF' : '#fff' }}
          >
            <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: sel ? '#7C3AED' : '#CBD5E1' }}>
              {sel && <div className="w-2 h-2 rounded-full bg-purple-700" />}
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-gray-800">{m.name}</p>
              <p className="text-[11px] text-gray-400">{m.estimatedDays}</p>
            </div>
            <span className="text-[13px] font-bold text-gray-900">{m.isFree ? 'FREE' : inr(m.cost)}</span>
          </button>
        );
      })}
    </div>
  </div>
);


/* ─── Payment section ───────────────────────────────────────────────────── */
const PaymentSection: React.FC<{
  isAuthenticated: boolean;
  checkout: CheckoutSession;
  gatewayCode: 'cod' | 'razorpay';
  onGatewayChange: (g: 'cod' | 'razorpay') => void;
  onPay: () => void;
  isPaying: boolean;
  paymentFailed: boolean;
  onRetry: () => void;
  isRetrying: boolean;
  grandTotal: number;
}> = ({
  isAuthenticated, checkout, gatewayCode, onGatewayChange, onPay, isPaying, paymentFailed, onRetry, isRetrying, grandTotal,
}) => {
  if (!isAuthenticated) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5 text-center">
        <p className="text-[13px] text-gray-600 mb-3">Log in to complete your purchase.</p>
        <Link
          to={`/login?redirect=${encodeURIComponent('/checkout')}`}
          className="block w-full py-3 text-white text-[13px] font-black tracking-wide uppercase rounded-xl transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(90deg,#9333EA,#7B22F9)' }}
        >
          Log In to Pay
        </Link>
      </div>
    );
  }

  if (paymentFailed) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center gap-2 text-red-600 mb-3">
          <AlertTriangle className="w-4 h-4" />
          <p className="text-[13px] font-semibold">Payment failed</p>
        </div>
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="w-full flex items-center justify-center gap-2 py-3 text-white text-[13px] font-black tracking-wide uppercase rounded-xl transition-all disabled:opacity-50 hover:opacity-90"
          style={{ background: 'linear-gradient(90deg,#9333EA,#7B22F9)' }}
        >
          {isRetrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Retry Payment
        </button>
      </div>
    );
  }

  const canPay = checkout.validation.isValid;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-2 mb-5">
        <CreditCard className="w-4.5 h-4.5 text-purple-600" style={{ width: 18, height: 18 }} />
        <h2 className="text-[15px] font-bold text-gray-900">Payment Method</h2>
      </div>
      <div className="space-y-3 mb-5">
        {([
          { id: 'cod' as const, label: 'Cash on Delivery', sub: 'Pay when you receive' },
          { id: 'razorpay' as const, label: 'Pay Online', sub: 'UPI, Card, Netbanking via Razorpay' },
        ]).map((m) => {
          const sel = gatewayCode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onGatewayChange(m.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left"
              style={{ borderColor: sel ? '#7C3AED' : '#E5E7EB', background: sel ? '#FAF5FF' : '#fff' }}
            >
              <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: sel ? '#7C3AED' : '#CBD5E1' }}>
                {sel && <div className="w-2 h-2 rounded-full bg-purple-700" />}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-800">{m.label}</p>
                <p className="text-[11px] text-gray-400">{m.sub}</p>
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={onPay}
        disabled={!canPay || isPaying}
        aria-label="Complete purchase"
        className="w-full py-4 text-white text-[14px] font-black tracking-[0.12em] uppercase rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]"
        style={{ background: canPay ? 'linear-gradient(90deg,#9333EA,#7B22F9)' : '#9CA3AF', boxShadow: canPay ? '0 4px 14px rgba(124,58,237,0.4)' : 'none' }}
      >
        {isPaying ? 'Processing…' : canPay ? `PAY ${inr(grandTotal)}` : 'RESOLVE ISSUES TO CONTINUE'}
      </button>
    </div>
  );
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const Field: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}> = ({
  label, value, onChange, placeholder, type = 'text',
}) => (
  <div>
    <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide block mb-1.5" style={UI}>
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-[13px] outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all"
      style={UI}
    />
  </div>
);

const PriceRow: React.FC<{ label: string; value: string; valueColor?: string }> = ({ label, value, valueColor }) => (
  <div className="flex items-center justify-between text-[12.5px]" style={UI}>
    <span className="text-gray-500">{label}</span>
    <span className="font-semibold" style={{ color: valueColor ?? '#1F2937' }}>{value}</span>
  </div>
);

export default AurusCheckout;
