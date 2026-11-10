import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Info, Loader2, Lock, RefreshCw } from 'lucide-react';
import { inr } from '@/context/StoreContext';
import { GatewayCode, PaymentMethodId, getPaymentMethod, resolvePaymentSubmission } from '@/lib/paymentMethods';
import { BTN_PRIMARY } from './checkoutUi';

/**
 * The checkout's single call to action.
 *   • COD → "Place order – ₹total"; online methods → "Pay ₹total".
 *   • A method with a gateway (today: Cash on Delivery) → onPay(gatewayCode).
 *   • A method without one → nothing is sent to the backend (no payment
 *     attempt, no transaction, no order); the shopper is asked to choose a
 *     method that can complete the order. The selection is never switched to
 *     COD behind their back.
 *   • Duplicate submissions are blocked twice over: the button is disabled
 *     while a payment request is in flight, and a synchronous lock swallows a
 *     second click that lands before React re-renders.
 */
const CheckoutCta: React.FC<{
  method: PaymentMethodId;
  grandTotal: number;
  canPay: boolean;
  isAuthResolving: boolean;
  onPay: (gatewayCode: GatewayCode) => void;
  isPaying: boolean;
  paymentFailed: boolean;
  onRetry: () => void;
  isRetrying: boolean;
  /** Totals are being recalculated by the backend — hold the CTA until they land. */
  isUpdating?: boolean;
}> = ({ method, grandTotal, canPay, isAuthResolving, onPay, isPaying, paymentFailed, onRetry, isRetrying, isUpdating }) => {
  // The method the "can't complete yet" note applies to; picking another method clears it.
  const [blockedFor, setBlockedFor] = useState<PaymentMethodId | null>(null);
  const blocked = blockedFor === method;
  const lock = useRef(false);

  // Release the click lock once the in-flight request settles (success or failure).
  useEffect(() => {
    if (!isPaying && !isRetrying) lock.current = false;
  }, [isPaying, isRetrying]);

  const isCod = getPaymentMethod(method).gatewayCode === 'cod';
  const busy = isPaying || isRetrying;

  if (paymentFailed) {
    return (
      <div className="space-y-2">
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-[#F4C7C3] bg-[#FEF3F2] px-4 py-2 text-[13px] text-[#B42318]">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
          <span><span className="font-semibold">Payment failed.</span> Please try again.</span>
        </div>
        <button
          type="button"
          onClick={() => {
            if (lock.current || busy) return;
            lock.current = true;
            onRetry();
          }}
          disabled={busy}
          aria-busy={isRetrying || undefined}
          className={`${BTN_PRIMARY} w-full h-14 text-[14px]`}
        >
          {isRetrying ? <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <RefreshCw className="w-4 h-4" aria-hidden />}
          Retry Payment
        </button>
      </div>
    );
  }

  const handleClick = () => {
    if (lock.current || busy || isUpdating) return;
    const submission = resolvePaymentSubmission(method);
    if (submission.kind !== 'submit') {
      setBlockedFor(method);
      return;
    }
    setBlockedFor(null);
    lock.current = true;
    onPay(submission.gatewayCode);
  };

  const label = isPaying
    ? (isCod ? 'Placing order…' : 'Processing…')
    : isUpdating
      ? 'Updating totals…'
      : !canPay
        ? 'Resolve issues to continue'
        : isCod ? `Place order – ${inr(grandTotal)}` : `Pay ${inr(grandTotal)}`;

  return (
    <div className="space-y-2">
      {blocked && (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-[#F6F2FF] px-4 py-2 text-[13px] leading-snug text-[#4C1D95]">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
          This payment method can’t complete an order yet. Please choose Cash on Delivery to place your order.
        </p>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={!canPay || busy || isAuthResolving || isUpdating}
        aria-busy={isPaying || undefined}
        className={`${BTN_PRIMARY} w-full h-14 text-[14px] shadow-[0_8px_20px_-8px_rgba(109,40,217,0.55)] disabled:shadow-none`}
      >
        {isPaying ? <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden /> : canPay && <Lock className="w-4 h-4" aria-hidden />}
        <span className="tabular-nums">{label}</span>
      </button>
    </div>
  );
};

export default CheckoutCta;
