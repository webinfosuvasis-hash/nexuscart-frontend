import { ExecutionContext } from '@nestjs/common';
import { extractCurrentCustomer } from './current-customer.decorator';

const CUSTOMER = {
  id: 'cust_1', storeId: 'store_1', email: 'priya@example.com', name: 'Priya', isActive: true,
};

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('extractCurrentCustomer', () => {
  it('returns the full customer when no key is requested', () => {
    const ctx = makeContext({ customer: CUSTOMER });
    expect(extractCurrentCustomer(undefined, ctx)).toEqual(CUSTOMER);
  });

  it('returns a single field when a key is requested', () => {
    const ctx = makeContext({ customer: CUSTOMER });
    expect(extractCurrentCustomer('email', ctx)).toBe('priya@example.com');
  });

  it('returns undefined when request.customer was never set', () => {
    const ctx = makeContext({});
    expect(extractCurrentCustomer(undefined, ctx)).toBeUndefined();
  });

  it('never reads from request.user, even if present', () => {
    const ctx = makeContext({ user: { id: 'merchant_1' } });
    expect(extractCurrentCustomer(undefined, ctx)).toBeUndefined();
  });
});
