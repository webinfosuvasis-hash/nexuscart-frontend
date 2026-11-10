import React from 'react';
import { Loader2 } from 'lucide-react';
import { inr } from '@/context/StoreContext';
import { CARD, LineItem, SERIF, SummaryLine } from './checkoutUi';

/**
 * Order summary card. Desktop: the parent sidebar makes it sticky. Mobile: it
 * sits below the checkout sections. Every amount shown comes from the caller —
 * i.e. from the backend checkout/cart response — nothing is computed here.
 */
const OrderSummary: React.FC<{
  title?: string;
  items: SummaryLine[];
  total: number;
  totalLabel?: string;
  /** Price breakdown rows (PriceRow elements). */
  breakdown: React.ReactNode;
  /** Coupon panel — rendered between items and breakdown. */
  extras?: React.ReactNode;
  /** Short lines under the payable amount (tax included, savings). */
  notes?: React.ReactNode;
  isUpdating?: boolean;
}> = ({ title = 'Order Summary', items, total, totalLabel = 'Total payable', breakdown, extras, notes, isUpdating }) => {
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);

  return (
    <section aria-label="Order summary" className={CARD}>
      <div className="flex items-baseline justify-between gap-4 px-4 sm:px-6 pt-6 pb-4">
        <h2 className="text-[24px] font-semibold leading-tight" style={SERIF}>{title}</h2>
        <span className="text-[13px] text-[#5F5953]">{itemCount} item{itemCount === 1 ? '' : 's'}</span>
      </div>

      <ul className="px-4 sm:px-6 pt-2 pb-4 divide-y divide-[#F1EDE7] lg:max-h-[300px] lg:overflow-y-auto overscroll-contain">
        {items.map((item) => <LineItem key={item.id} item={item} formatPrice={inr} />)}
      </ul>

      {extras && <div className="px-4 sm:px-6 pb-4">{extras}</div>}

      <div className="relative px-4 sm:px-6 pb-6">
        <dl className="space-y-3 border-t border-[#E8E3DB] pt-4" aria-busy={isUpdating || undefined}>
          {breakdown}
        </dl>

        <div className="mt-4 rounded-xl bg-[#F6F2FF] border border-[#E4DAFE] px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[12px] sm:text-[13px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap text-[#4C1D95]">{totalLabel}</p>
            <p className="text-[26px] sm:text-[30px] leading-none font-semibold tabular-nums whitespace-nowrap text-[#1C1917]" style={SERIF} aria-live="polite">
              {inr(total)}
            </p>
          </div>
          {notes && <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[12px] text-[#5F5953]">{notes}</div>}
        </div>

        {isUpdating && (
          <div className="absolute inset-0 bg-white/75 flex items-center justify-center gap-2 text-[13px] font-medium text-[#6D28D9]" role="status">
            <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden /> Updating totals…
          </div>
        )}
      </div>
    </section>
  );
};

export default OrderSummary;
