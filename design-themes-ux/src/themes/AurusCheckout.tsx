import React, { useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { inr } from '@/context/StoreContext';
import { useCart, useApplyPromotion, useRemovePromotion, CART_QUERY_KEY } from '@/hooks/useCart';
import { useAuth } from '@/context/CustomerAuthContext';
import { useAddresses, useCreateAddress } from '@/hooks/useCustomerAddresses';
import {
  useStartCheckout, useUpdateCheckoutAddress, useUpdateCheckoutShipping, useValidateCheckout, useCancelCheckout,
  checkoutErrorMessage,
} from '@/hooks/useCheckout';
import { useInitiatePayment, useRetryPayment } from '@/hooks/useCustomerPayment';
import { CheckoutSession, AddressInput, CheckoutAddress, CheckoutShippingMethod } from '@/lib/checkoutApi';
import { CustomerAddress } from '@/lib/customerAddressApi';
import { normalizeIndiaStateCode } from '@/lib/indiaStateCodes';
import { resetCheckoutPrompt } from '@/lib/checkoutPrompt';
import GuestCheckoutPrompt from '@/components/storefront/checkout/GuestCheckoutPrompt';
import PaymentSection from '@/components/storefront/checkout/PaymentSection';
import CheckoutCta from '@/components/storefront/checkout/CheckoutCta';
import OrderSummary from '@/components/storefront/checkout/OrderSummary';
import {
  BTN_PRIMARY, BTN_SECONDARY, C, CARD, CenterState, CheckoutShell, EASE, FOCUS, Field, HEADER_OFFSET, LINK_BTN, LineItem,
  Disclosure, PriceRow, RadioDot, SERIF, SectionCard, SectionStatus, optionCard, optionIcon,
} from '@/components/storefront/checkout/checkoutUi';
import { DEFAULT_PAYMENT_METHOD, GatewayCode, PaymentMethodId, getPaymentMethod } from '@/lib/paymentMethods';
import {
  AlertTriangle, Check, ChevronDown, Clock, Loader2, Mail, MapPin, Pencil, Phone, ShieldCheck, ShoppingBag, Tag, Truck,
  UserRound, X, Zap,
} from 'lucide-react';

type Step = 'address' | 'shipping' | 'review' | 'payment';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function stepFromCheckout(checkout: CheckoutSession | null): Step {
  if (!checkout) return 'address';
  const hasShippingAddress = checkout.addresses.some((a) => a.type === 'SHIPPING');
  if (!hasShippingAddress) return 'address';
  if (!checkout.selectedShippingMethod) return 'shipping';
  return 'review';
}

/** Progress-bar index: 0 Bag · 1 Address · 2 Shipping · 3 Review & Pay. */
const STEP_INDEX: Record<Step, number> = { address: 1, shipping: 2, review: 3, payment: 3 };

/* Layout shared by the bag-review and checkout screens: content left, summary
 * right (sticky) on desktop; one column below lg with the summary after the
 * checkout content and the CTA docked to the bottom of the viewport. */
const PAGE_GRID =
  'max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 lg:pt-8 pb-36 lg:pb-16 grid grid-cols-1 ' +
  'lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px] gap-4 lg:gap-8 items-start';
const ASIDE = `lg:sticky ${HEADER_OFFSET} space-y-4 min-w-0`;
const CTA_DOCK =
  'fixed inset-x-0 bottom-0 z-30 bg-white border-t border-[#E8E3DB] px-4 sm:px-6 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(28,25,23,0.18)] ' +
  'lg:static lg:z-auto lg:bg-transparent lg:border-0 lg:p-0 lg:shadow-none';

const SecureNote: React.FC = () => (
  <p className="hidden lg:flex items-center justify-center gap-2 text-[12px] text-[#5F5953]">
    <ShieldCheck className="w-4 h-4 text-[#0F766E]" aria-hidden /> 100% Secure &amp; Encrypted Payment
  </p>
);

/**
 * Review Your Bag — the only point in this flow where a coupon can be
 * applied or removed. Once `POST /checkout/start` runs, the cart is locked and
 * the checkout engine hard-blocks the session the moment `cart.version` no
 * longer matches the version it was started with (CART_CHANGED — no "resync"
 * endpoint exists), so a coupon change after start goes through a real
 * checkout cancel (which unlocks the cart) and back to this step.
 */
const BagReviewSection: React.FC<{
  onProceed: () => void;
  isStartingCheckout: boolean;
  openCoupon?: boolean;
}> = ({ onProceed, isStartingCheckout, openCoupon }) => {
  const navigate = useNavigate();
  const { data: cart, isLoading } = useCart();
  const applyPromotion = useApplyPromotion();
  const removePromotion = useRemovePromotion();
  const [couponCode, setCouponCode] = useState('');
  const [couponOpen, setCouponOpen] = useState(!!openCoupon);
  const couponInputId = useId();

  if (isLoading) {
    return <CenterState><Loader2 className="w-8 h-8 animate-spin motion-reduce:animate-none text-[#6D28D9]" aria-label="Loading your bag" /></CenterState>;
  }

  const items = cart?.items ?? [];
  if (items.length === 0) return <EmptyBag />;

  const totals = cart!.totals;
  const savings = totals.discount + totals.promotionDiscount;

  const applyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (!code || applyPromotion.isPending) return;
    applyPromotion.mutate(code, { onSuccess: () => setCouponCode('') });
  };

  const couponPanel = (
    <Disclosure
      open={couponOpen}
      onToggle={() => setCouponOpen((o) => !o)}
      icon={<Tag className="w-4 h-4 text-[#6D28D9] flex-shrink-0" aria-hidden />}
      summary={cart?.couponCode
        ? <>Coupon applied: <span className="font-semibold text-[#0F766E]">{cart.couponCode}</span></>
        : 'Have a coupon code?'}
    >
      {cart?.couponCode ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-[#F0FDF9] border border-[#B7E4DA] px-4 py-2">
          <span className="text-[13px] text-[#0F766E]">
            <span className="font-semibold">{cart.couponCode}</span>
            {totals.promotionDiscount > 0 && <> · you save {inr(totals.promotionDiscount)}</>}
          </span>
          <button
            type="button"
            onClick={() => removePromotion.mutate(cart.couponCode!)}
            disabled={removePromotion.isPending}
            className={`w-10 h-10 -mr-2 flex items-center justify-center rounded-lg text-[#0F766E] hover:bg-white hover:text-[#B42318] disabled:opacity-50 ${FOCUS}`}
            aria-label="Remove coupon"
          >
            {removePromotion.isPending ? <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" /> : <X className="w-4 h-4" />}
          </button>
        </div>
      ) : (
        <form onSubmit={applyCoupon} className="flex gap-2">
          <label htmlFor={couponInputId} className="sr-only">Coupon code</label>
          <input
            id={couponInputId}
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="Enter coupon code"
            autoComplete="off"
            autoCapitalize="characters"
            className="flex-1 min-w-0 h-12 px-4 rounded-lg border border-[#D6CFC4] bg-white text-[14px] uppercase tracking-wide placeholder:normal-case placeholder:tracking-normal outline-none focus:border-[#6D28D9] focus:ring-4 focus:ring-[#6D28D9]/15"
          />
          <button type="submit" disabled={applyPromotion.isPending || !couponCode.trim()} className={`${BTN_SECONDARY} h-12 px-6 text-[13px] font-semibold`}>
            {applyPromotion.isPending ? 'Applying…' : 'Apply'}
          </button>
        </form>
      )}
    </Disclosure>
  );

  return (
    <CheckoutShell currentStep={0} onBackToBag={() => navigate('/cart')}>
      <main className={PAGE_GRID}>
        <section aria-labelledby="bag-heading" className={CARD}>
          <div className="flex items-baseline justify-between gap-4 px-4 sm:px-6 pt-6 pb-4">
            <h1 id="bag-heading" className="text-[28px] leading-tight font-semibold" style={SERIF}>Review Your Bag</h1>
            <span className="text-[13px] text-[#5F5953]">{cart!.itemCount} item{cart!.itemCount === 1 ? '' : 's'}</span>
          </div>
          <ul className="px-4 sm:px-6 pb-6 divide-y divide-[#F1EDE7]">
            {items.map((item) => <LineItem key={item.id} item={item} formatPrice={inr} />)}
          </ul>
        </section>

        <aside className={ASIDE} aria-label="Bag total">
          <section className={`${CARD} p-4 sm:p-6 space-y-4`}>
            <h2 className="text-[24px] font-semibold leading-tight" style={SERIF}>Bag Total</h2>
            {couponPanel}
            <dl className="space-y-3 pt-4 border-t border-[#E8E3DB]">
              <PriceRow label="Subtotal" value={inr(totals.subtotal)} />
              {totals.discount > 0 && <PriceRow label="Discount" value={`− ${inr(totals.discount)}`} tone="success" />}
              {totals.promotionDiscount > 0 && <PriceRow label="Coupon Discount" value={`− ${inr(totals.promotionDiscount)}`} tone="success" />}
              <PriceRow label="Shipping & tax" value="Calculated next" tone="muted" />
            </dl>
            <div className="rounded-xl bg-[#F6F2FF] border border-[#E4DAFE] px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[12px] sm:text-[13px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap text-[#4C1D95]">Estimated Total</p>
                <p className="text-[26px] sm:text-[30px] leading-none font-semibold tabular-nums whitespace-nowrap" style={SERIF}>{inr(totals.grandTotal)}</p>
              </div>
              {savings > 0 && <p className="mt-2 text-[12px] font-medium text-[#0F766E]">You save {inr(savings)} on this order</p>}
            </div>
          </section>
          <div className={CTA_DOCK}>
            <button
              type="button"
              onClick={onProceed}
              disabled={isStartingCheckout}
              aria-busy={isStartingCheckout || undefined}
              className={`${BTN_PRIMARY} w-full h-14 text-[14px]`}
            >
              {isStartingCheckout && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden />}
              {isStartingCheckout ? 'Starting Checkout…' : 'Proceed to Checkout'}
            </button>
          </div>
          <SecureNote />
        </aside>
      </main>
    </CheckoutShell>
  );
};

const EmptyBag: React.FC = () => (
  <CenterState>
    <ShoppingBag className="w-12 h-12 text-[#C4B5FD] mb-4" aria-hidden />
    <p className="text-[28px] font-semibold mb-2" style={SERIF}>Your bag is empty</p>
    <p className="text-[14px] text-[#5F5953] mb-6">Discover pieces you’ll love.</p>
    <Link to="/jewellery" className={`${BTN_PRIMARY} h-12 px-8 text-[13px]`}>Browse Collection</Link>
  </CenterState>
);

/* ─── Order success overlay ──────────────────────────────────────── */
type PlacedOrder = { orderNumber: string | null; total: number; isCod: boolean };

const OrderSuccess: React.FC<PlacedOrder & { onClose: () => void }> = ({ orderNumber, total, isCod, onClose }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-[#1C1917]/50">
    <div className="bg-white rounded-xl shadow-2xl max-w-[440px] w-full p-8 text-center" role="dialog" aria-modal="true" aria-labelledby="order-success-title">
      <div className="w-16 h-16 rounded-full bg-[#F0FDF9] flex items-center justify-center mx-auto mb-6">
        <Check className="w-8 h-8 text-[#0F766E]" strokeWidth={2.5} aria-hidden />
      </div>
      <h2 id="order-success-title" className="text-[32px] leading-tight font-semibold mb-2" style={SERIF}>Order Confirmed!</h2>
      <p className="text-[14px] text-[#5F5953] mb-6">Thank you for shopping with Aurus. Your order is on its way.</p>

      {/* The customer-facing number — the internal order id is never shown. */}
      {orderNumber && (
        <div className="rounded-lg bg-[#F6F2FF] border border-[#E4DAFE] px-6 py-4 mb-2">
          <p className="text-[11px] text-[#6D28D9] uppercase tracking-[0.16em] font-semibold">Order Number</p>
          <p className="text-[18px] font-semibold text-[#4C1D95] mt-1 tracking-wider break-all">{orderNumber}</p>
        </div>
      )}
      {orderNumber && (
        <p className="text-[12px] text-[#5F5953] mb-6">Please note your order number — quote it if you contact us about this order.</p>
      )}

      <div className="flex justify-between text-[14px] border-t border-[#E8E3DB] pt-4 mb-6">
        <span className="text-[#5F5953]">{isCod ? 'Amount payable on delivery' : 'Amount paid'}</span>
        <span className="font-semibold tabular-nums">{inr(total)}</span>
      </div>

      <Link to="/jewellery" onClick={onClose} className={`${BTN_PRIMARY} w-full h-12 text-[13px]`}>
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
  const queryClient = useQueryClient();
  const { data: cartData, isLoading: isCartLoading } = useCart();
  const { status: authStatus } = useAuth();
  // Guests pay through the cart-session-owned guest endpoints. Decided only
  // once auth has finished restoring, so a returning customer's order is
  // never placed as a guest just because their session was still loading.
  const isGuest = authStatus === 'unauthenticated';

  // Checkout is only started once the customer leaves the bag-review step —
  // see the comment above BagReviewSection for why.
  const [hasProceededPastBag, setHasProceededPastBag] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutSession | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // Set when the shopper leaves checkout to change their coupon: the bag step
  // opens its coupon panel, and their delivery address is offered back to them.
  const [returnedForCoupon, setReturnedForCoupon] = useState(false);
  const [rememberedAddress, setRememberedAddress] = useState<CheckoutAddress | null>(null);

  const startCheckout = useStartCheckout();
  const updateAddress = useUpdateCheckoutAddress();
  const updateShipping = useUpdateCheckoutShipping();
  const validateCheckout = useValidateCheckout();
  const cancelCheckout = useCancelCheckout();
  const initiatePayment = useInitiatePayment();
  const retryPayment = useRetryPayment();

  // What the shopper picked (UI only). Which gateway — if any — processes it is
  // decided by CheckoutCta via resolvePaymentSubmission.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>(DEFAULT_PAYMENT_METHOD);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<PlacedOrder | null>(null);
  const [pendingShippingId, setPendingShippingId] = useState<string | null>(null);

  const items = cartData?.items ?? [];

  // This checkout attempt is over — the next one may show the account prompt again.
  useEffect(() => {
    if (orderSuccess) resetCheckoutPrompt();
  }, [orderSuccess]);

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

  // Totals always come back from the backend: the shipping PATCH returns the
  // recalculated session, then validate refreshes it once more.
  const handleShippingSelect = (shippingMethodId: string) => {
    if (!checkout || updateShipping.isPending) return;
    setPendingShippingId(shippingMethodId);
    updateShipping.mutate(
      { checkoutId: checkout.id, shippingMethodId },
      {
        onSuccess: (session) => {
          setCheckout(session);
          validateCheckout.mutate(session.id, { onSuccess: setCheckout });
        },
        onSettled: () => setPendingShippingId(null),
      },
    );
  };

  // Leaving checkout to change the coupon: a real cancel unlocks the cart.
  const handleChangeCoupon = () => {
    if (!checkout || cancelCheckout.isPending) return;
    const shippingAddress = checkout.addresses.find((a) => a.type === 'SHIPPING') ?? null;
    cancelCheckout.mutate(checkout.id, {
      onSuccess: () => {
        setRememberedAddress(shippingAddress);
        setReturnedForCoupon(true);
        setCheckout(null);
        setHasProceededPastBag(false);
        setPaymentFailed(false);
        setPaymentId(null);
        queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      },
    });
  };

  const onPaymentResult = (result: { paymentId: string; redirectUrl?: string | null; status: string; orderId?: string | null; orderNumber?: string | null; gatewayCode: string }) => {
    setPaymentId(result.paymentId);
    if (result.redirectUrl) {
      window.location.href = result.redirectUrl;
      return;
    }
    if (result.status === 'CAPTURED' && result.orderId && checkout) {
      setOrderSuccess({ orderNumber: result.orderNumber ?? null, total: checkout.totals.grandTotal, isCod: result.gatewayCode === 'cod' });
      return;
    }
    if (result.status === 'FAILED') {
      setPaymentFailed(true);
    }
  };

  const handlePay = (gatewayCode: GatewayCode) => {
    if (!checkout || initiatePayment.isPending) return;
    setPaymentFailed(false);
    initiatePayment.mutate({ checkoutId: checkout.id, gatewayCode, asGuest: isGuest }, { onSuccess: onPaymentResult });
  };

  const handleRetryPayment = () => {
    if (!paymentId || retryPayment.isPending) return;
    setPaymentFailed(false);
    retryPayment.mutate({ paymentId, asGuest: isGuest }, { onSuccess: onPaymentResult });
  };

  /* Loading */
  if (isCartLoading || (startCheckout.isPending && !checkout)) {
    return <CenterState><Loader2 className="w-8 h-8 animate-spin motion-reduce:animate-none text-[#6D28D9]" aria-label="Loading checkout" /></CenterState>;
  }

  /* Empty cart */
  if (items.length === 0) return <EmptyBag />;

  /* Checkout failed to start */
  if (checkoutError && !checkout) {
    return (
      <CenterState>
        <AlertTriangle className="w-12 h-12 text-[#F4A29B] mb-4" aria-hidden />
        <p className="text-[16px] font-semibold mb-4 max-w-[420px]" role="alert">{checkoutError}</p>
        <Link to="/cart" className={LINK_BTN}>Back to Bag</Link>
      </CenterState>
    );
  }

  /* Bag review — the only place a coupon can be applied/removed (see BagReviewSection) */
  if (!hasProceededPastBag || !checkout) {
    return (
      <BagReviewSection
        onProceed={() => setHasProceededPastBag(true)}
        isStartingCheckout={startCheckout.isPending}
        openCoupon={returnedForCoupon}
      />
    );
  }

  const totals = checkout.totals;
  const isRecalculating = updateShipping.isPending || validateCheckout.isPending;
  const atPayment = step === 'review' || step === 'payment';
  const shippingStatus: SectionStatus = step === 'address' ? 'upcoming' : step === 'shipping' ? 'active' : 'done';
  const paymentStatus: SectionStatus = atPayment ? 'active' : 'upcoming';
  const savings = totals.totalDiscount + totals.promotionDiscount;
  const issues = checkout.validation.issues;

  const couponExtras = (
    <CheckoutCouponPanel
      appliedCode={checkout.appliedPromotion?.code ?? null}
      discount={totals.promotionDiscount}
      onChange={handleChangeCoupon}
      isLeaving={cancelCheckout.isPending}
      disabled={initiatePayment.isPending || retryPayment.isPending}
    />
  );

  return (
    <CheckoutShell currentStep={STEP_INDEX[step]} onBackToBag={() => navigate('/cart')}>
      <main className={PAGE_GRID}>
        {/* ── LEFT: the three checkout sections ── */}
        <div className="space-y-4 min-w-0">
          <h1 className="sr-only">Checkout</h1>
          {isGuest && <GuestCheckoutBanner />}

          <AddressSection
            checkout={checkout}
            isSaving={updateAddress.isPending}
            onSubmit={handleAddressSubmit}
            initialAddress={rememberedAddress}
          />

          <SectionCard
            index={2}
            title="Shipping Method"
            status={shippingStatus}
            upcomingHint="Choose how fast you’d like it, once your address is confirmed."
          >
            <ShippingOptions
              methods={checkout.availableShippingMethods}
              selectedId={checkout.selectedShippingMethod?.id ?? null}
              pendingId={pendingShippingId}
              disabled={updateShipping.isPending || initiatePayment.isPending}
              onSelect={handleShippingSelect}
            />
          </SectionCard>

          <SectionCard
            index={3}
            title="Payment Method"
            status={paymentStatus}
            upcomingHint="Available once your delivery method is selected."
          >
            <PaymentSection
              method={paymentMethod}
              onMethodChange={setPaymentMethod}
              disabled={initiatePayment.isPending || retryPayment.isPending}
              grandTotal={totals.grandTotal}
            />
          </SectionCard>
        </div>

        {/* ── RIGHT: sticky summary + CTA ── */}
        <aside className={ASIDE} aria-label="Order total and payment">
          <OrderSummary
            items={checkout.items}
            total={totals.grandTotal}
            isUpdating={isRecalculating}
            extras={couponExtras}
            breakdown={(
              <>
                <PriceRow label="Subtotal" value={inr(totals.subtotal)} />
                {totals.totalDiscount > 0 && <PriceRow label="Discount" value={`− ${inr(totals.totalDiscount)}`} tone="success" />}
                {totals.promotionDiscount > 0 && (
                  <PriceRow label={`Coupon (${checkout.appliedPromotion?.code ?? ''})`} value={`− ${inr(totals.promotionDiscount)}`} tone="success" />
                )}
                <PriceRow
                  label="Shipping"
                  value={!checkout.selectedShippingMethod ? 'Select a method' : totals.shippingCost === 0 ? 'FREE' : inr(totals.shippingCost)}
                  tone={!checkout.selectedShippingMethod ? 'muted' : totals.shippingCost === 0 ? 'success' : 'default'}
                />
                <PriceRow label="Tax" value={inr(totals.taxAmount)} />
                {atPayment && <PriceRow label="Payment" value={getPaymentMethod(paymentMethod).label} />}
              </>
            )}
            notes={(
              <>
                {totals.taxAmount > 0 && <span>Includes {inr(totals.taxAmount)} tax</span>}
                {savings > 0 && <span className="font-medium text-[#0F766E]">You save {inr(savings)}</span>}
              </>
            )}
          />

          {issues.length > 0 && (
            <div role="alert" className="rounded-lg border border-[#F5D9A8] bg-[#FFFAEB] px-4 py-4 text-[13px] text-[#93370D] space-y-1">
              {issues.map((issue, i) => <p key={i}>{issue.message}</p>)}
            </div>
          )}

          {atPayment && (
            <div className={CTA_DOCK}>
              <CheckoutCta
                method={paymentMethod}
                grandTotal={totals.grandTotal}
                canPay={checkout.validation.isValid}
                isAuthResolving={authStatus === 'bootstrapping'}
                onPay={handlePay}
                isPaying={initiatePayment.isPending}
                paymentFailed={paymentFailed}
                onRetry={handleRetryPayment}
                isRetrying={retryPayment.isPending}
                isUpdating={isRecalculating}
              />
            </div>
          )}
          <SecureNote />
        </aside>
      </main>

      {orderSuccess && (
        <OrderSuccess
          {...orderSuccess}
          onClose={() => { setOrderSuccess(null); navigate('/jewellery'); }}
        />
      )}
    </CheckoutShell>
  );
};

/* ─── Coupon panel (checkout step) ─────────────────────────────────────── */
/**
 * Expandable coupon row in the summary. The cart is locked during checkout,
 * so changing a coupon means leaving checkout: a real cancel unlocks the cart
 * and returns the shopper to the bag step with the coupon field open.
 */
const CheckoutCouponPanel: React.FC<{
  appliedCode: string | null;
  discount: number;
  onChange: () => void;
  isLeaving: boolean;
  disabled: boolean;
}> = ({ appliedCode, discount, onChange, isLeaving, disabled }) => {
  const [open, setOpen] = useState(false);
  return (
    <Disclosure
      open={open}
      onToggle={() => setOpen((o) => !o)}
      icon={<Tag className="w-4 h-4 text-[#6D28D9] flex-shrink-0" aria-hidden />}
      summary={appliedCode
        ? <>Coupon <span className="font-semibold text-[#0F766E]">{appliedCode}</span> applied</>
        : 'Have a coupon code?'}
    >
      <div className="space-y-2">
        {appliedCode && discount > 0 && (
          <p className="text-[13px] font-medium text-[#0F766E]">You’re saving {inr(discount)} with {appliedCode}.</p>
        )}
        <p className="text-[13px] leading-relaxed text-[#5F5953]">
          Coupons are applied to your bag. {appliedCode ? 'To change or remove it' : 'To use one'}, return to your bag — you’ll confirm delivery details again afterwards.
        </p>
        <button type="button" onClick={onChange} disabled={isLeaving || disabled} className={`${BTN_SECONDARY} h-10 px-4 text-[13px]`}>
          {isLeaving && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden />}
          {appliedCode ? 'Change coupon' : 'Apply a coupon'}
        </button>
      </div>
    </Disclosure>
  );
};

/* ─── Guest banner ───────────────────────────────────────────────────── */
/**
 * The explicit way back to the optional account prompt for a guest who
 * already chose (or dismissed) it on the cart page. Signing in from here
 * resumes this same checkout — it's owned by the cart-session cookie.
 */
const GuestCheckoutBanner: React.FC = () => {
  const [promptOpen, setPromptOpen] = useState(false);
  return (
    <div className={`${CARD} px-4 sm:px-6 py-4 flex flex-wrap items-center gap-x-4 gap-y-2`}>
      <UserRound className="w-5 h-5 text-[#6D28D9] flex-shrink-0" aria-hidden />
      <p className="flex-1 min-w-[180px] text-[14px] text-[#5F5953]">
        You&apos;re checking out as a guest.
      </p>
      <button type="button" onClick={() => setPromptOpen(true)} className={LINK_BTN}>
        Sign in or create an account
      </button>
      <GuestCheckoutPrompt open={promptOpen} onOpenChange={setPromptOpen} onContinueAsGuest={() => {}} />
    </div>
  );
};

/* ─── Address section ─────────────────────────────────────────────────── */
const AddressSection: React.FC<{
  checkout: CheckoutSession;
  isSaving: boolean;
  onSubmit: (address: AddressInput) => void;
  initialAddress?: CheckoutAddress | null;
}> = ({ checkout, isSaving, onSubmit, initialAddress }) => {
  const { isAuthenticated, customer } = useAuth();
  const { data: addresses, isLoading: isLoadingAddresses } = useAddresses(isAuthenticated);
  const createAddress = useCreateAddress();

  const shippingAddress = checkout.addresses.find((a) => a.type === 'SHIPPING');
  const [isEditing, setIsEditing] = useState(!shippingAddress);
  const [mode, setMode] = useState<'select' | 'new'>('select');
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);

  // A shopper who stepped back to change their coupon gets their typed address back.
  const [form, setForm] = useState(() => ({
    firstName:  initialAddress?.firstName ?? '',
    lastName:   initialAddress?.lastName ?? '',
    line1:      initialAddress?.line1 ?? '',
    line2:      initialAddress?.line2 ?? '',
    city:       initialAddress?.city ?? '',
    state:      initialAddress?.state ?? '',
    postalCode: initialAddress?.postalCode ?? '',
    phone:      initialAddress?.phone ?? '',
    email:      initialAddress?.email ?? '',
  }));
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
      <SectionCard
        index={1}
        title="Delivery Address"
        status="done"
      >
        <address className="not-italic rounded-xl bg-[#FAF8F5] border border-[#E8E3DB] px-4 sm:px-6 py-4 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <p className="text-[17px] font-semibold leading-10 text-[#1C1917] break-words min-w-0">
              {shippingAddress.firstName} {shippingAddress.lastName}
            </p>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              aria-label="Change delivery address"
              className={`inline-flex flex-shrink-0 items-center gap-2 h-10 px-4 rounded-lg border border-[#E4DAFE] bg-white text-[13px] font-semibold text-[#6D28D9] hover:bg-[#F6F2FF] hover:border-[#C4B5FD] ${EASE} ${FOCUS}`}
            >
              <Pencil className="w-3.5 h-3.5" aria-hidden /> Change
            </button>
          </div>
          <ul className="mt-2 space-y-2 text-[14px] leading-6 text-[#5F5953]">
            <li className="flex gap-2">
              <MapPin className="w-4 h-4 mt-1 text-[#6D28D9] flex-shrink-0" aria-hidden />
              <span className="min-w-0 break-words">
                <span className="sr-only">Address: </span>
                {shippingAddress.line1}{shippingAddress.line2 ? `, ${shippingAddress.line2}` : ''}
                <br />
                {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}
              </span>
            </li>
            <li className="flex gap-2 items-center">
              <Phone className="w-4 h-4 text-[#6D28D9] flex-shrink-0" aria-hidden />
              <span><span className="sr-only">Phone: </span><span className="text-[#1C1917] tabular-nums">{shippingAddress.phone}</span></span>
            </li>
            {!isAuthenticated && shippingAddress.email && (
              <li className="flex gap-2 items-center min-w-0">
                <Mail className="w-4 h-4 text-[#6D28D9] flex-shrink-0" aria-hidden />
                <span className="truncate"><span className="sr-only">Email: </span>{shippingAddress.email}</span>
              </li>
            )}
          </ul>
        </address>
      </SectionCard>
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
    // Guests have no account email — the order and payment need one to reach them.
    if (!isAuthenticated && !EMAIL_PATTERN.test(form.email.trim())) {
      setAddressError('Please enter a valid email address for your order updates.');
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
      email: customer?.email ?? form.email.trim(),
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

  const cancelEdit = shippingAddress ? (
    <button type="button" onClick={() => { setIsEditing(false); setAddressError(null); }} className={LINK_BTN}>Cancel</button>
  ) : undefined;

  return (
    <SectionCard index={1} title="Delivery Address" status="active" action={cancelEdit}>
      {addressError && (
        <div role="alert" className="rounded-lg border border-[#F4C7C3] bg-[#FEF3F2] text-[#B42318] text-[13px] px-4 py-2 mb-4">{addressError}</div>
      )}

      {isAuthenticated && mode === 'select' && (
        <div className="space-y-4">
          {isLoadingAddresses && <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none text-[#6D28D9]" aria-label="Loading saved addresses" />}
          {!isLoadingAddresses && addresses && addresses.length === 0 && (
            <p className="text-[14px] text-[#5F5953]">You don&apos;t have any saved addresses yet.</p>
          )}
          {!isLoadingAddresses && addresses && addresses.length > 0 && (
            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 min-w-0">
              <legend className="sr-only">Saved addresses</legend>
              {addresses.map((addr) => {
                const sel = selectedAddressId === addr.id;
                return (
                  <label
                    key={addr.id}
                    className={`${optionCard(sel)} !items-start px-4 py-4`}
                  >
                    <input type="radio" name="address" checked={sel} onChange={() => setSelectedAddressId(addr.id)} className="sr-only" />
                    <span className="mt-0.5"><RadioDot checked={sel} /></span>
                    <span className="text-[13px] leading-relaxed min-w-0 break-words">
                      <span className="flex items-center gap-2 font-semibold text-[#1C1917]">
                        {addr.label || 'Address'}
                        {addr.isDefault && <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6D28D9] bg-white border border-[#E4DAFE] rounded px-2 py-px">Default</span>}
                      </span>
                      <span className="block text-[#1C1917]">{[addr.firstName, addr.lastName].filter(Boolean).join(' ')}</span>
                      <span className="block text-[#5F5953]">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} {addr.postalCode}</span>
                      {addr.phone && <span className="block text-[#5F5953] tabular-nums">{addr.phone}</span>}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <button
              type="button"
              disabled={!selectedAddressId || isSaving}
              onClick={() => {
                const addr = addresses?.find((a) => a.id === selectedAddressId);
                if (addr) submitSavedAddress(addr);
              }}
              className={`${BTN_PRIMARY} flex-1 h-12 text-[13px]`}
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden />}
              {isSaving ? 'Saving…' : 'Deliver to this address'}
            </button>
            <button type="button" onClick={() => setMode('new')} className={`${BTN_SECONDARY} flex-1 h-12 text-[13px]`}>
              + Add New Address
            </button>
          </div>
        </div>
      )}

      {(!isAuthenticated || mode === 'new') && (
        <form onSubmit={submitNewAddress} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="First Name" required value={form.firstName} onChange={set('firstName')} placeholder="Priya" autoComplete="given-name" />
            <Field label="Last Name" required value={form.lastName} onChange={set('lastName')} placeholder="Sharma" autoComplete="family-name" />
            {!isAuthenticated && (
              <Field className="sm:col-span-2" label="Email" required value={form.email} onChange={set('email')} placeholder="you@example.com" type="email" autoComplete="email" inputMode="email" />
            )}
            <Field label="Mobile Number" required value={form.phone} onChange={set('phone')} placeholder="10-digit number" type="tel" autoComplete="tel-national" inputMode="numeric" />
            <Field label="Pincode" required value={form.postalCode} onChange={set('postalCode')} placeholder="6-digit pincode" type="tel" autoComplete="postal-code" inputMode="numeric" />
            <Field label="City" required value={form.city} onChange={set('city')} placeholder="Mumbai" autoComplete="address-level2" />
            <Field label="State" required value={form.state} onChange={set('state')} placeholder="Maharashtra" autoComplete="address-level1" />
            <Field className="sm:col-span-2" label="Address (House / Flat / Area)" required value={form.line1} onChange={set('line1')} placeholder="House No., Street, Locality" autoComplete="address-line1" />
            <Field className="sm:col-span-2" label="Landmark" value={form.line2} onChange={set('line2')} placeholder="Optional" autoComplete="address-line2" />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-6">
            <button type="submit" disabled={isSaving || createAddress.isPending} className={`${BTN_PRIMARY} flex-1 h-12 text-[13px]`}>
              {(isSaving || createAddress.isPending) && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden />}
              {isSaving || createAddress.isPending ? 'Saving…' : 'Deliver to this address'}
            </button>
            {isAuthenticated && (
              <button type="button" onClick={() => setMode('select')} className={`${BTN_SECONDARY} flex-1 h-12 text-[13px]`}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </SectionCard>
  );
};

/* ─── Shipping options ─────────────────────────────────────────────────── */
const shippingIcon = (m: CheckoutShippingMethod) =>
  /same[\s-]?day/i.test(m.name) ? Clock : /express|priority/i.test(m.name) ? Zap : Truck;

/** "Delivered in 5–7 business days" already says "5–7 days" — don't repeat it. */
const shippingDetail = (m: CheckoutShippingMethod) => {
  const desc = m.description?.trim();
  if (!desc) return m.estimatedDays;
  const days = m.estimatedDays?.replace(/\s*days?$/i, '').trim();
  return days && desc.includes(days) ? desc : [m.estimatedDays, desc].filter(Boolean).join(' · ');
};

/**
 * Selectable shipping cards (a native radio group). Picking one PATCHes the
 * checkout; the summary shows the backend's recalculated totals once they land.
 */
const ShippingOptions: React.FC<{
  methods: CheckoutShippingMethod[];
  selectedId: string | null;
  pendingId: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
}> = ({ methods, selectedId, pendingId, disabled, onSelect }) => {
  if (methods.length === 0) {
    return <p className="text-[14px] text-[#5F5953]">No delivery options are available for this address. Please try a different address.</p>;
  }
  return (
    <fieldset className="grid grid-cols-1 auto-rows-fr gap-2 min-w-0" disabled={disabled}>
      <legend className="sr-only">Shipping method</legend>
      {methods.map((m) => {
        const sel = (pendingId ?? selectedId) === m.id;
        const Icon = shippingIcon(m);
        const isPending = pendingId === m.id;
        return (
          <label key={m.id} className={`${optionCard(sel)} min-h-[84px] px-4 py-4`}>
            <input
              type="radio"
              name="shipping-method"
              value={m.id}
              checked={sel}
              onChange={() => { if (m.id !== selectedId) onSelect(m.id); }}
              className="sr-only"
            />
            <RadioDot checked={sel} />
            <span aria-hidden className={`${optionIcon(sel)} hidden min-[400px]:flex`}>
              {isPending ? <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none" /> : <Icon className="w-5 h-5" strokeWidth={1.75} />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-semibold leading-5 text-[#1C1917]">{m.name}</span>
              <span className="block text-[13px] leading-5 text-[#5F5953] mt-1">{shippingDetail(m)}</span>
            </span>
            <span className="flex-shrink-0 text-right">
              {m.isFree ? (
                <span className="inline-flex items-center h-7 px-2 rounded-full bg-[#F0FDF9] border border-[#B7E4DA] text-[12px] font-semibold tracking-wide text-[#0F766E]">FREE</span>
              ) : (
                <span className="text-[15px] font-semibold tabular-nums" style={{ color: C.ink }}>{inr(m.cost)}</span>
              )}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
};

export default AurusCheckout;

