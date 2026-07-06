import type { AuthenticatedCustomer } from '@/modules/customer-auth/types/customer-auth.types';

declare global {
  namespace Express {
    interface Request {
      storeId?: string;
      cartSessionId?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolvedCart?: any;
      traceId?: string;
      spanId?: string;
      correlationId?: string;
      requestId?: string;
      // FI-1 — set only by CustomerJwtAuthGuard; distinct from `user`
      // (the merchant/staff principal) so the two identities can never
      // be confused by a downstream handler.
      customer?: AuthenticatedCustomer;
    }
  }
}

export {};
