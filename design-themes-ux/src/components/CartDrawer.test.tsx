import { describe, it, expect } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import React, { useEffect } from 'react';
import CartDrawer from './CartDrawer';
import { CartProvider, useCartContext } from '@/context/CartContext';
import { mockFetch, ok, fail, renderWithProviders } from '@/test/utils';
import type { Cart, CartItem } from '@/lib/cartApi';

const item = (over: Partial<CartItem> = {}): CartItem => ({
  id: 'i1', productId: 'p1', variantId: null, quantity: 2, sku: 'SKU1', name: 'Banarasi Silk Saree', brand: 'Aurus',
  slug: 'banarasi', image: '/x.jpg', unitPrice: 1000, comparePrice: 1500, lineTotal: 2000, lineDiscount: 0,
  inventorySource: 'x', variantOptions: { Size: 'Free' }, ...over,
});

const cart = (items: CartItem[]): Cart => ({
  id: 'c1', storeId: 's', customerId: null, status: 'ACTIVE', version: 1, currencyCode: 'INR', locale: 'en-IN',
  couponCode: null, items, itemCount: items.reduce((n, i) => n + i.quantity, 0), uniqueItemCount: items.length,
  totals: { subtotal: 2000, discount: 0, promotionDiscount: 0, shippingCost: 0, tax: 0, grandTotal: 2000 },
  shipping: null, lockedUntil: null, lastActivityAt: '', createdAt: '', updatedAt: '',
});

/** Opens the drawer on mount, as the header button would. */
const Open: React.FC = () => {
  const { setCartOpen } = useCartContext();
  useEffect(() => setCartOpen(true), [setCartOpen]);
  return null;
};

const renderDrawer = (open = true) =>
  renderWithProviders(<CartProvider>{open && <Open />}<CartDrawer /></CartProvider>);

describe('CartDrawer', () => {
  it('when closed it is hidden from assistive tech and the tab order', () => {
    mockFetch(() => ok(cart([])));
    renderDrawer(false);
    expect(screen.queryByRole('dialog', { name: 'Shopping cart' })).not.toBeInTheDocument();
    const aside = document.querySelector('aside[aria-label="Shopping cart"]')!;
    expect(aside).toHaveAttribute('aria-hidden', 'true');
    expect(aside).toHaveAttribute('inert');
  });

  it('shows the empty state', async () => {
    mockFetch(() => ok(cart([])));
    renderDrawer();
    expect(await screen.findByText('Your bag is empty.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Shopping cart' })).not.toHaveAttribute('inert');
  });

  it('lists items with quantity, price and a link to the full cart', async () => {
    mockFetch(() => ok(cart([item()])));
    renderDrawer();
    expect(await screen.findByText('Banarasi Silk Saree')).toBeInTheDocument();
    expect(screen.getByLabelText('Quantity: 2')).toBeInTheDocument();
    expect(screen.getAllByText(/2,000/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'View full cart' })).toHaveAttribute('href', '/cart');
  });

  it('+ sends PATCH with quantity + 1', async () => {
    const spy = mockFetch((url, init) => {
      if (init?.method === 'PATCH') return ok(cart([item({ quantity: 3 })]));
      if (init?.method === 'DELETE') return ok(cart([]));
      return ok(cart([item({ quantity: 1, lineTotal: 1000 })]));
    });
    renderDrawer();
    await screen.findByLabelText('Quantity: 1');

    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    await waitFor(() => expect(spy.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(true));
    const patch = spy.mock.calls.find(([, i]) => i?.method === 'PATCH')!;
    expect(JSON.parse(patch[1]!.body as string)).toEqual({ quantity: 2 });
  });

  it('− at quantity 1 removes the item instead of setting quantity 0', async () => {
    const spy = mockFetch((_url, init) => (init?.method === 'DELETE' ? ok(cart([])) : ok(cart([item({ quantity: 1 })]))));
    renderDrawer();
    await screen.findByLabelText('Quantity: 1');
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    await waitFor(() => expect(spy.mock.calls.some(([, i]) => i?.method === 'DELETE')).toBe(true));
    expect(spy.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(false);
    expect(await screen.findByText('Your bag is empty.')).toBeInTheDocument();
  });

  it('Escape closes the drawer', async () => {
    mockFetch(() => ok(cart([])));
    renderDrawer();
    await screen.findByRole('dialog', { name: 'Shopping cart' });
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Shopping cart' })).not.toBeInTheDocument());
  });

  it('a failing cart API shows an error state, not a crash', async () => {
    mockFetch(() => fail(500));
    renderDrawer();
    await waitFor(() => expect(screen.queryByText('Your bag is empty.')).not.toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: 'Shopping cart' })).toBeInTheDocument();
  });
});
