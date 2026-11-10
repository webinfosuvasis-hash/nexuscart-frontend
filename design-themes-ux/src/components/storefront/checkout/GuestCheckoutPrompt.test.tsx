import { describe, it, expect, vi } from 'vitest';
import React, { useState } from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import GuestCheckoutPrompt from './GuestCheckoutPrompt';
import { renderWithProviders } from '@/test/utils';

const Harness: React.FC<{ onGuest?: () => void; onOpenChange?: (o: boolean) => void }> = ({ onGuest = () => {}, onOpenChange }) => {
  const [open, setOpen] = useState(true);
  return (
    <GuestCheckoutPrompt
      open={open}
      onOpenChange={(o) => { setOpen(o); onOpenChange?.(o); }}
      onContinueAsGuest={onGuest}
    />
  );
};

describe('GuestCheckoutPrompt', () => {
  it('is an accessible, labelled dialog with the heading and subtitle', () => {
    renderWithProviders(<Harness />);
    const dialog = screen.getByRole('dialog', { name: 'Enjoy a Better Shopping Experience!' });
    expect(dialog).toHaveAccessibleDescription('Create an account for a faster and more convenient checkout.');
  });

  it('lists only benefits the store actually supports', () => {
    renderWithProviders(<Harness />);
    expect(screen.getByText('Track Your Orders')).toBeInTheDocument();
    expect(screen.getByText('Save Your Addresses')).toBeInTheDocument();
    expect(screen.queryByText(/Wishlist/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reorder/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rewards/i)).not.toBeInTheDocument();
  });

  it('sends sign-in to the existing login page with a return to checkout', () => {
    renderWithProviders(<Harness />);
    expect(screen.getByRole('link', { name: 'Sign In / Create Account' }))
      .toHaveAttribute('href', '/login?redirect=%2Fcheckout');
  });

  it('focuses the primary action on open', async () => {
    renderWithProviders(<Harness />);
    await waitFor(() => expect(screen.getByRole('link', { name: 'Sign In / Create Account' })).toHaveFocus());
  });

  it('"Continue as Guest" closes the prompt and continues', async () => {
    const onGuest = vi.fn();
    renderWithProviders(<Harness onGuest={onGuest} />);
    fireEvent.click(screen.getByRole('button', { name: /Continue as Guest/ }));
    expect(onGuest).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes on Escape without forcing a choice', async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(<Harness onOpenChange={onOpenChange} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('states that an account is optional', () => {
    renderWithProviders(<Harness />);
    expect(screen.getByText('Creating an account is optional. Continue as a guest to proceed without registering.'))
      .toBeInTheDocument();
  });
});

describe('GuestCheckoutPrompt — focus restoration', () => {
  const Opener: React.FC = () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>Place order</button>
        <GuestCheckoutPrompt open={open} onOpenChange={setOpen} onContinueAsGuest={() => {}} />
      </>
    );
  };

  it('returns focus to whatever opened it when dismissed (it has no Radix trigger)', async () => {
    renderWithProviders(<Opener />);
    const opener = screen.getByRole('button', { name: 'Place order' });
    opener.focus();
    fireEvent.click(opener);
    await waitFor(() => expect(screen.getByRole('link', { name: 'Sign In / Create Account' })).toHaveFocus());

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
