/**
 * customerAddressApi.ts — Customer Address Book API client for the Aurus storefront.
 *
 * Talks to the Phase 3 CustomerAddressController (`/customer/addresses`).
 * Reuses `authenticatedFetch` from customerAuthApi.ts for the token-attach +
 * refresh-and-retry behavior — no authentication logic is duplicated here.
 */

import { authenticatedFetch, CustomerAuthApiError } from './customerAuthApi';

const ADDRESSES_PATH = '/customer/addresses';

export interface CustomerAddress {
  id: string;
  label: string | null;
  firstName: string | null;
  lastName: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefault: boolean;
}

export interface CustomerAddressInput {
  label?: string;
  firstName?: string;
  lastName?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  phone?: string;
}

export type UpdateCustomerAddressInput = Partial<CustomerAddressInput>;

export const listAddresses = (): Promise<CustomerAddress[]> =>
  authenticatedFetch<CustomerAddress[]>(ADDRESSES_PATH, { method: 'GET' });

export const createAddress = (input: CustomerAddressInput): Promise<CustomerAddress> =>
  authenticatedFetch<CustomerAddress>(ADDRESSES_PATH, { method: 'POST', body: JSON.stringify(input) });

export const updateAddress = (id: string, input: UpdateCustomerAddressInput): Promise<CustomerAddress> =>
  authenticatedFetch<CustomerAddress>(`${ADDRESSES_PATH}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const deleteAddress = (id: string): Promise<{ message: string }> =>
  authenticatedFetch<{ message: string }>(`${ADDRESSES_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const setDefaultShipping = (id: string): Promise<CustomerAddress> =>
  authenticatedFetch<CustomerAddress>(`${ADDRESSES_PATH}/${encodeURIComponent(id)}/default-shipping`, { method: 'POST' });

export const setDefaultBilling = (id: string): Promise<CustomerAddress> =>
  authenticatedFetch<CustomerAddress>(`${ADDRESSES_PATH}/${encodeURIComponent(id)}/default-billing`, { method: 'POST' });

export { CustomerAuthApiError };
