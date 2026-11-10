import api from '@/lib/api';

export type VendorUserStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
export type AuthEmailOutcome = 'sent' | 'not_configured' | 'failed';

export interface VendorUser {
  id: string;
  vendorId: string;
  email: string;
  name: string;
  status: VendorUserStatus;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

const base = (vendorId: string) => `/vendors/${vendorId}/users`;
const data = <T>(p: Promise<unknown>) => p.then((r) => (r as { data: T }).data);

// Owner-side management of vendor portal accounts. Invitation and reset links
// are emailed by the backend and never returned to the admin app.
export const vendorUserService = {
  list: (vendorId: string) => data<VendorUser[]>(api.get(base(vendorId))),
  invite: (vendorId: string, input: { email: string; name: string }) =>
    data<{ user: VendorUser; invitation: AuthEmailOutcome }>(api.post(base(vendorId), input)),
  resendInvitation: (vendorId: string, userId: string) =>
    data<{ user: VendorUser; invitation: AuthEmailOutcome }>(api.post(`${base(vendorId)}/${userId}/invitation`)),
  sendPasswordReset: (vendorId: string, userId: string) =>
    data<{ user: VendorUser; email: AuthEmailOutcome }>(api.post(`${base(vendorId)}/${userId}/password-reset`)),
  setStatus: (vendorId: string, userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED') =>
    data<VendorUser>(api.patch(`${base(vendorId)}/${userId}/status`, { status })),
};
