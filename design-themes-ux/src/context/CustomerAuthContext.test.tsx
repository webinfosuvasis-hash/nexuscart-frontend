import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CustomerAuthProvider, useAuth } from './CustomerAuthContext';
import { CART_QUERY_KEY } from '@/hooks/useCart';

const api = vi.hoisted(() => ({
  bootstrapSession: vi.fn(),
  logout: vi.fn(),
  logoutAll: vi.fn(),
  clearTokens: vi.fn(),
}));
vi.mock('@/lib/customerAuthApi', () => api);

const cart = vi.hoisted(() => ({ rotateCartSession: vi.fn() }));
vi.mock('@/lib/cartApi', () => cart);

const Probe: React.FC = () => {
  const { status, logout } = useAuth();
  return <button type="button" onClick={() => void logout()}>{status}</button>;
};

function renderAuth() {
  const client = new QueryClient();
  client.setQueryData(CART_QUERY_KEY, { id: 'previous_shoppers_cart' });
  render(
    <QueryClientProvider client={client}>
      <CustomerAuthProvider><Probe /></CustomerAuthProvider>
    </QueryClientProvider>,
  );
  return client;
}

describe('CustomerAuthProvider — logout ends the cart session (shared devices)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    api.bootstrapSession.mockResolvedValue({ id: 'cust_1', email: 'priya@example.com', name: 'Priya' });
    api.logout.mockResolvedValue(undefined);
    cart.rotateCartSession.mockReset().mockResolvedValue(undefined);
  });

  it('rotates the cart session, drops the cached bag and resets the checkout prompt', async () => {
    const client = renderAuth();
    sessionStorage.setItem('aurus_checkout_prompt_seen', '1');
    fireEvent.click(await screen.findByRole('button', { name: 'authenticated' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'unauthenticated' })).toBeInTheDocument());
    expect(cart.rotateCartSession).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(CART_QUERY_KEY)).toBeUndefined();
    expect(sessionStorage.getItem('aurus_checkout_prompt_seen')).toBeNull();
  });

  it('still logs out when the cart-session rotation fails', async () => {
    cart.rotateCartSession.mockRejectedValue(new Error('offline'));
    renderAuth();
    fireEvent.click(await screen.findByRole('button', { name: 'authenticated' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'unauthenticated' })).toBeInTheDocument());
    expect(api.clearTokens).toHaveBeenCalled();
  });
});
