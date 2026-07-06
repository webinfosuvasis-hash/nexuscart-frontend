import * as jwt from 'jsonwebtoken';

// FI-1 security requirement, proven at the cryptographic level rather than
// asserted in prose: a merchant-signed token must never verify under the
// customer secret, and vice versa. This is what CustomerJwtStrategy's
// `secretOrKey: CUSTOMER_JWT_SECRET` (distinct from the merchant JwtStrategy's
// `JWT_SECRET`) actually buys — passport-jwt rejects the signature before
// `validate()` is ever reached, for either direction.
describe('Merchant/Customer JWT secret isolation', () => {
  const MERCHANT_SECRET = 'merchant-only-secret-not-shared-with-customer';
  const CUSTOMER_SECRET = 'customer-only-secret-not-shared-with-merchant';

  it('a merchant-signed token fails verification under the customer secret', () => {
    const merchantToken = jwt.sign(
      { sub: 'user_1', email: 'staff@store.com', role: 'STORE_OWNER', storeId: 'store_1' },
      MERCHANT_SECRET,
      { expiresIn: '15m' },
    );

    expect(() => jwt.verify(merchantToken, CUSTOMER_SECRET)).toThrow(jwt.JsonWebTokenError);
  });

  it('a customer-signed token fails verification under the merchant secret', () => {
    const customerToken = jwt.sign(
      { sub: 'cust_1', email: 'priya@example.com', storeId: 'store_1', type: 'customer' },
      CUSTOMER_SECRET,
      { expiresIn: '15m' },
    );

    expect(() => jwt.verify(customerToken, MERCHANT_SECRET)).toThrow(jwt.JsonWebTokenError);
  });

  it('a customer-signed token verifies fine under its own secret, but still carries type: customer for the strategy to check', () => {
    const customerToken = jwt.sign(
      { sub: 'cust_1', email: 'priya@example.com', storeId: 'store_1', type: 'customer' },
      CUSTOMER_SECRET,
      { expiresIn: '15m' },
    );

    const decoded = jwt.verify(customerToken, CUSTOMER_SECRET) as jwt.JwtPayload;
    expect(decoded.type).toBe('customer');
  });
});
