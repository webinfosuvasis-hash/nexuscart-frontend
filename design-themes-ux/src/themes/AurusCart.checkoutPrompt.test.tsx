import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { screen, fireEvent, waitFor, render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AurusCart from './AurusCart';
import { mockFetch, ok } from '@/test/utils';
import type { Cart } from '@/lib/cartApi';

const auth = vi.hoisted(() => ({ status: 'unauthenticated' as 'bootstrapping' | 'authenticated' | 'unauthenticated' }));
vi.mock('@/context/CustomerAuthContext', () => ({
  useAuth: () => ({ status: auth.status, isAuthenticated: auth.status === 'authenticated', customer: null }),
}));

const cart = (status: Cart['status'] = 'ACTIVE'): Cart => ({
  id: 'c1', storeId: 's', customerId: null, status, version: 1, currencyCode: 'INR', locale: 'en-IN',
  couponCode: null,
  items: [{
    id: 'i1', productId: 'p1', variantId: null, quantity: 1, sku: 'SKU1', name: 'Gold Ring', brand: 'Aurus',
    slug: 'gold-ring', image: '/x.jpg', unitPrice: 1000, comparePrice: null, lineTotal: 1000, lineDiscount: 0,
    inventorySource: 'x', variantOptions: null,
  }],
  itemCount: 1, uniqueItemCount: 1,
  totals: { subtotal: 1000, discount: 0, promotionDiscount: 0, shippingCost: 0, tax: 0, grandTotal: 1000 },
  shipping: null, lockedUntil: null, lastActivityAt: '', createdAt: '', updatedAt: '',
} as Cart);

function renderCart() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/cart']}>
        <Routes>
          <Route path="/cart" element={<AurusCart />} />
          <Route path="/checkout" element={<p>Checkout page</p>} />
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const placeOrder = async () => fireEvent.click(await screen.findByRole('link', { name: 'PLACE ORDER' }));

describe('AurusCart — optional account prompt before checkout', () => {
  beforeEach(() => {
    sessionStorage.clear();
    auth.status = 'unauthenticated';
    mockFetch(() => ok(cart()));
  });

  it('shows the prompt to a guest instead of navigating straight to checkout', async () => {
    renderCart();
    await placeOrder();
    expect(screen.getByRole('dialog', { name: 'Enjoy a Better Shopping Experience!' })).toBeInTheDocument();
    expect(screen.queryByText('Checkout page')).not.toBeInTheDocument();
  });

  it('"Continue as Guest" goes to checkout without any sign-in', async () => {
    renderCart();
    await placeOrder();
    fireEvent.click(screen.getByRole('button', { name: /Continue as Guest/ }));
    expect(await screen.findByText('Checkout page')).toBeInTheDocument();
  });

  it('"Sign In / Create Account" goes to the existing login page', async () => {
    renderCart();
    await placeOrder();
    fireEvent.click(screen.getByRole('link', { name: 'Sign In / Create Account' }));
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('does not prompt again in the same checkout attempt once dismissed', async () => {
    renderCart();
    await placeOrder();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await placeOrder();
    expect(await screen.findByText('Checkout page')).toBeInTheDocument();
  });

  it('never prompts a signed-in customer', async () => {
    auth.status = 'authenticated';
    renderCart();
    await placeOrder();
    expect(await screen.findByText('Checkout page')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not hold checkout hostage while the session is still restoring', async () => {
    auth.status = 'bootstrapping';
    renderCart();
    await placeOrder();
    expect(await screen.findByText('Checkout page')).toBeInTheDocument();
  });
});
