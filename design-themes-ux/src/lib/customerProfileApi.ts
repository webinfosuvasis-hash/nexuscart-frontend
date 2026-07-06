/**
 * customerProfileApi.ts — Customer Profile API client for the Aurus storefront.
 *
 * Talks to the Phase 2 CustomerProfileController (`/customer/profile`).
 * Reuses `authenticatedFetch` from customerAuthApi.ts for the token-attach +
 * refresh-and-retry behavior — no authentication logic is duplicated here.
 */

import { authenticatedFetch, CustomerAuthApiError } from './customerAuthApi';

const PROFILE_PATH = '/customer/profile';

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isEmailVerified: boolean;
}

export interface UpdateCustomerProfileInput {
  name?: string;
  phone?: string;
}

export const getProfile = (): Promise<CustomerProfile> =>
  authenticatedFetch<CustomerProfile>(PROFILE_PATH, { method: 'GET' });

export const updateProfile = (input: UpdateCustomerProfileInput): Promise<CustomerProfile> =>
  authenticatedFetch<CustomerProfile>(PROFILE_PATH, { method: 'PATCH', body: JSON.stringify(input) });

export { CustomerAuthApiError };
