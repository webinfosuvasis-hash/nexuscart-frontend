import { UnauthorizedException } from '@nestjs/common';
import { VendorJwtStrategy } from '../strategies/vendor-jwt.strategy';
import { VendorJwtPayload } from '../vendor-auth.types';

const config = { get: (k: string) => (k === 'VENDOR_JWT_SECRET' ? 'v'.repeat(40) : undefined) } as any;
const USER = {
  id: 'vu1', storeId: 's1', vendorId: 'v1', email: 'a@v.test', name: 'Asha', status: 'ACTIVE', tokenVersion: 3,
  vendor: { status: 'ACTIVE', storeId: 's1' },
};
const payload = (over: Partial<VendorJwtPayload> = {}): VendorJwtPayload =>
  ({ sub: 'vu1', vid: 'v1', sid: 's1', tv: 3, typ: 'vendor', ...over });

function strategyWith(user: unknown) {
  const prisma = { vendorUser: { findUnique: jest.fn().mockResolvedValue(user) } } as any;
  return { strategy: new VendorJwtStrategy(config, prisma), prisma };
}

describe('VendorJwtStrategy.validate', () => {
  it('returns the principal for an active user of an active vendor with a current token version', async () => {
    const { strategy } = strategyWith(USER);
    await expect(strategy.validate(payload())).resolves.toEqual({
      vendorUserId: 'vu1', vendorId: 'v1', storeId: 's1', email: 'a@v.test', name: 'Asha',
    });
  });

  it.each([
    ['wrong token type',              payload({ typ: 'customer' as any }), USER],
    ['unknown user',                  payload(), null],
    ['suspended user',                payload(), { ...USER, status: 'SUSPENDED' }],
    ['revoked user',                  payload(), { ...USER, status: 'REVOKED' }],
    ['invited (not yet active) user', payload(), { ...USER, status: 'INVITED' }],
    ['inactive vendor',               payload(), { ...USER, vendor: { status: 'INACTIVE', storeId: 's1' } }],
    ['stale token version',           payload({ tv: 2 }), USER],
    ['forged vendor id claim',        payload({ vid: 'v2' }), USER],
    ['forged store id claim',         payload({ sid: 's2' }), USER],
    ['vendor moved to another store', payload(), { ...USER, vendor: { status: 'ACTIVE', storeId: 's9' } }],
  ])('rejects: %s', async (_label, p, user) => {
    const { strategy } = strategyWith(user);
    await expect(strategy.validate(p)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
