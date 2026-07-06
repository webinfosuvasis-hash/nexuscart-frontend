import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { CustomerJwtAuthGuard } from './customer-jwt-auth.guard';

const CUSTOMER = {
  id: 'cust_1', storeId: 'store_1', email: 'priya@example.com', name: 'Priya', isActive: true,
};

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('CustomerJwtAuthGuard', () => {
  it('uses the customer property option, not the default user property', () => {
    const guard = new CustomerJwtAuthGuard() as any;
    expect(guard.options).toEqual({ property: 'customer' });
  });

  describe('handleRequest', () => {
    it('returns the resolved customer on success', () => {
      const guard = new CustomerJwtAuthGuard();
      expect(guard.handleRequest(null, CUSTOMER)).toBe(CUSTOMER);
    });

    it('throws UnauthorizedException when no customer is resolved', () => {
      const guard = new CustomerJwtAuthGuard();
      expect(() => guard.handleRequest(null, null)).toThrow(UnauthorizedException);
    });

    it('rethrows the original error when present', () => {
      const guard = new CustomerJwtAuthGuard();
      const originalError = new Error('boom');
      expect(() => guard.handleRequest(originalError, null)).toThrow(originalError);
    });
  });

  describe('request attachment (via the underlying AuthGuard.canActivate contract)', () => {
    it('assigns the resolved principal to request.customer and leaves request.user untouched', () => {
      // Mirrors exactly what @nestjs/passport's AuthGuard.canActivate does:
      // `request[options.property || 'user'] = user` after handleRequest resolves.
      const guard = new CustomerJwtAuthGuard() as any;
      const request: Record<string, unknown> = {};
      const resolved = guard.handleRequest(null, CUSTOMER, undefined, makeContext(request));
      request[guard.options.property] = resolved;

      expect(request.customer).toEqual(CUSTOMER);
      expect(request.user).toBeUndefined();
    });
  });
});
