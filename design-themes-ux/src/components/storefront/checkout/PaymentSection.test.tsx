import { describe, it, expect, vi } from 'vitest';
import React, { useState } from 'react';
import { screen, fireEvent, within } from '@testing-library/react';
import PaymentSection from './PaymentSection';
import CheckoutCta from './CheckoutCta';
import { renderWithProviders } from '@/test/utils';
import { PaymentMethodId } from '@/lib/paymentMethods';

/** Payment cards + the CTA, wired the way AurusCheckout wires them. */
const Harness: React.FC<{
  onPay: (g: string) => void; canPay?: boolean; isPaying?: boolean; isUpdating?: boolean;
  paymentFailed?: boolean; onRetry?: () => void;
}> = ({ onPay, canPay = true, isPaying = false, isUpdating = false, paymentFailed = false, onRetry = () => {} }) => {
  const [method, setMethod] = useState<PaymentMethodId>('cod');
  return (
    <>
      <PaymentSection method={method} onMethodChange={setMethod} grandTotal={1234} disabled={isPaying} />
      <CheckoutCta
        method={method} grandTotal={1234} canPay={canPay} isAuthResolving={false}
        onPay={onPay} isPaying={isPaying} paymentFailed={paymentFailed} onRetry={onRetry} isRetrying={false}
        isUpdating={isUpdating}
      />
      <p data-testid="selected">{method}</p>
    </>
  );
};

const LABELS = ['Cash on Delivery', 'UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Wallets'];
const cta = () => screen.getByRole('button', { name: /place order|^pay|resolve issues|updating totals|placing order|processing/i });

describe('Payment method cards', () => {
  it('shows all six methods as normal, enabled, selectable options with no availability wording', () => {
    renderWithProviders(<Harness onPay={() => {}} />);
    const group = screen.getByRole('group', { name: 'Payment method' });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(6);
    for (const r of radios) expect(r).toBeEnabled();
    for (const label of LABELS) expect(screen.getByRole('radio', { name: new RegExp(label) })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Cash on Delivery/ })).toBeChecked();
    expect(document.body.textContent).not.toMatch(/coming soon|unavailable|not configured|demo mode/i);
  });

  it('every option can be selected, and the selection updates', () => {
    renderWithProviders(<Harness onPay={() => {}} />);
    for (const [label, id] of [['UPI', 'upi'], ['Credit Card', 'credit_card'], ['Debit Card', 'debit_card'], ['Net Banking', 'net_banking'], ['Wallets', 'wallet'], ['Cash on Delivery', 'cod']]) {
      fireEvent.click(screen.getByRole('radio', { name: new RegExp(label) }));
      expect(screen.getByRole('radio', { name: new RegExp(label) })).toBeChecked();
      expect(screen.getByTestId('selected')).toHaveTextContent(id);
    }
  });

  it('shows the cash-on-delivery detail only while COD is selected', () => {
    renderWithProviders(<Harness onPay={() => {}} />);
    expect(screen.getByText(/when your order is delivered/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /UPI/ }));
    expect(screen.queryByText(/when your order is delivered/)).not.toBeInTheDocument();
  });
});

describe('CheckoutCta', () => {
  it('reads "Place order – ₹total" for COD and "Pay ₹total" for online methods', () => {
    renderWithProviders(<Harness onPay={() => {}} />);
    expect(cta()).toHaveTextContent('Place order – ₹1,234');
    fireEvent.click(screen.getByRole('radio', { name: /UPI/ }));
    expect(cta()).toHaveTextContent(/^Pay ₹1,234$/);
    fireEvent.click(screen.getByRole('radio', { name: /Credit Card/ }));
    expect(cta()).toHaveTextContent(/^Pay ₹1,234$/);
  });

  it('Cash on Delivery submits through the cod gateway exactly as before', () => {
    const onPay = vi.fn();
    renderWithProviders(<Harness onPay={onPay} />);
    fireEvent.click(cta());
    expect(onPay).toHaveBeenCalledTimes(1);
    expect(onPay).toHaveBeenCalledWith('cod');
  });

  it('a rapid double click submits only once', () => {
    const onPay = vi.fn();
    renderWithProviders(<Harness onPay={onPay} />);
    const button = cta();
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onPay).toHaveBeenCalledTimes(1);
  });

  it('is disabled and shows a loading label while the order is being placed', () => {
    renderWithProviders(<Harness onPay={() => {}} isPaying />);
    expect(cta()).toBeDisabled();
    expect(cta()).toHaveTextContent('Placing order…');
  });

  it('holds while the backend recalculates totals', () => {
    const onPay = vi.fn();
    renderWithProviders(<Harness onPay={onPay} isUpdating />);
    expect(cta()).toBeDisabled();
    expect(cta()).toHaveTextContent('Updating totals…');
  });

  it.each(['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Wallets'])(
    '%s never submits: no payment attempt, no silent switch to COD',
    (label) => {
      const onPay = vi.fn();
      renderWithProviders(<Harness onPay={onPay} />);
      fireEvent.click(screen.getByRole('radio', { name: new RegExp(label) }));
      expect(screen.queryByRole('status')).not.toBeInTheDocument(); // nothing shown while just previewing
      fireEvent.click(cta());
      expect(onPay).not.toHaveBeenCalled();
      expect(screen.getByRole('radio', { name: new RegExp(label) })).toBeChecked();
      expect(screen.getByRole('status')).toHaveTextContent('Please choose Cash on Delivery');
    },
  );

  it('the note clears when the shopper picks another method, and COD then submits', () => {
    const onPay = vi.fn();
    renderWithProviders(<Harness onPay={onPay} />);
    fireEvent.click(screen.getByRole('radio', { name: /UPI/ }));
    fireEvent.click(cta());
    fireEvent.click(screen.getByRole('radio', { name: /Cash on Delivery/ }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(cta());
    expect(onPay).toHaveBeenCalledWith('cod');
  });

  it('cannot pay while the checkout has unresolved issues', () => {
    renderWithProviders(<Harness onPay={() => {}} canPay={false} />);
    expect(cta()).toBeDisabled();
    expect(cta()).toHaveTextContent('Resolve issues to continue');
  });

  it('after a failed payment offers a single Retry action', () => {
    const onRetry = vi.fn();
    renderWithProviders(<Harness onPay={() => {}} paymentFailed onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Payment failed');
    const retry = screen.getByRole('button', { name: /retry payment/i });
    fireEvent.click(retry);
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
