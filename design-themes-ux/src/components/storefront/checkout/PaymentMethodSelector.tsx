import React from 'react';
import { Banknote, CreditCard, Landmark, Smartphone, Wallet, WalletCards, type LucideIcon } from 'lucide-react';
import { PAYMENT_METHODS, PaymentMethodId } from '@/lib/paymentMethods';
import { RadioDot, optionCard, optionIcon } from './checkoutUi';

const ICONS: Record<PaymentMethodId, LucideIcon> = {
  cod:         Banknote,
  upi:         Smartphone,
  credit_card: CreditCard,
  debit_card:  WalletCards,
  net_banking: Landmark,
  wallet:      Wallet,
};

/**
 * Payment method picker: a native radio group (arrow keys move the selection,
 * screen readers announce "radio, n of 6") styled as equal-height cards.
 * Selection only — processing is decided elsewhere (see resolvePaymentSubmission).
 *
 * Columns: 1 on phones · 2 on tablets · 1 in the narrower desktop column at
 * 1024px · 2 again from 1280px.
 */
const PaymentMethodSelector: React.FC<{
  value: PaymentMethodId;
  onChange: (id: PaymentMethodId) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => (
  <fieldset className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 auto-rows-fr gap-2 sm:gap-4 min-w-0" disabled={disabled}>
    <legend className="sr-only">Payment method</legend>
    {PAYMENT_METHODS.map((m) => {
      const Icon = ICONS[m.id];
      const sel = value === m.id;
      return (
        <label key={m.id} className={`${optionCard(sel)} min-h-[84px] px-4 py-4 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
          <input
            type="radio"
            name="payment-method"
            value={m.id}
            checked={sel}
            onChange={() => onChange(m.id)}
            className="sr-only"
          />
          <RadioDot checked={sel} />
          <span aria-hidden className={optionIcon(sel)}>
            <Icon className="w-5 h-5" strokeWidth={1.75} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-semibold leading-5 text-[#1C1917]">{m.label}</span>
            <span className="block text-[12px] leading-[18px] text-[#5F5953] mt-1">{m.description}</span>
          </span>
        </label>
      );
    })}
  </fieldset>
);

export default PaymentMethodSelector;
