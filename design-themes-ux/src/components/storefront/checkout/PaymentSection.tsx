import React from 'react';
import { Banknote } from 'lucide-react';
import { inr } from '@/context/StoreContext';
import { PaymentMethodId } from '@/lib/paymentMethods';
import PaymentMethodSelector from './PaymentMethodSelector';

/**
 * Body of the "Payment Method" checkout section: the method cards, plus extra
 * detail only where there is something true and useful to say. Selecting is
 * pure UI — turning a selection into a submission is CheckoutCta's job.
 */
const PaymentSection: React.FC<{
  method: PaymentMethodId;
  onMethodChange: (id: PaymentMethodId) => void;
  disabled?: boolean;
  grandTotal: number;
}> = ({ method, onMethodChange, disabled, grandTotal }) => (
  <div className="space-y-4">
    <PaymentMethodSelector value={method} onChange={onMethodChange} disabled={disabled} />
    {method === 'cod' && (
      <div className="flex items-start gap-4 rounded-lg border border-[#E8E3DB] bg-[#FAF8F5] px-4 py-4">
        <Banknote className="w-5 h-5 text-[#6D28D9] flex-shrink-0 mt-px" aria-hidden />
        <p className="text-[13px] leading-relaxed text-[#5F5953]">
          Pay <span className="font-semibold text-[#1C1917] tabular-nums">{inr(grandTotal)}</span> when your order is delivered.
          Please keep the amount ready for the delivery partner.
        </p>
      </div>
    )}
  </div>
);

export default PaymentSection;
