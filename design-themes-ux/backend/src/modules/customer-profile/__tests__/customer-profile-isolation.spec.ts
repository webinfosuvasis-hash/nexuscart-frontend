import { NotFoundException } from '@nestjs/common';
import { CustomerJwtStrategy } from '@/modules/customer-auth/strategies/customer-jwt.strategy';
import { CustomerProfileController } from '../customer-profile.controller';
import { CustomerProfileService } from '../customer-profile.service';

// ---------------------------------------------------------------------------
// Integration test — proves cross-customer/cross-tenant isolation through
// the REAL chain: CustomerJwtStrategy.validate() (resolves the principal
// attached to the request by CustomerJwtAuthGuard) → CustomerProfileController
// (real) → CustomerProfileService (real). Only PrismaService is a test
// double, standing in for two customers seeded in two different stores.
// ---------------------------------------------------------------------------

const STORE_A = 'store_a';
const STORE_B = 'store_b';

const CUSTOMER_A = {
  id: 'cust_a', storeId: STORE_A, email: 'alice@example.com', name: 'Alice', phone: '1111111111', isActive: true,
};
const CUSTOMER_B = {
  id: 'cust_b', storeId: STORE_B, email: 'bob@example.com', name: 'Bob', phone: '2222222222', isActive: true,
};

function makeConfig() {
  return { get: jest.fn().mockReturnValue('test-customer-secret') } as any;
}

function makeSharedPrisma() {
  const rows: Record<string, any> = {
    cust_a: { ...CUSTOMER_A, credential: { isEmailVerified: true } },
    cust_b: { ...CUSTOMER_B, credential: { isEmailVerified: true } },
  };

  return {
    // Backs both CustomerJwtStrategy.validate() and CustomerProfileService's
    // own lookups — real Prisma would project down to each caller's `select`,
    // but returning the full row is enough here since every assertion below
    // only reads fields that are present regardless (id/storeId/email/name).
    customer: {
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        const row = rows[where.id];
        if (!row || row.storeId !== where.storeId) return Promise.resolve(null);
        return Promise.resolve(row);
      }),
      updateMany: jest.fn().mockImplementation(({ where }: any) => {
        const row = rows[where.id];
        const matches = row && row.storeId === where.storeId;
        return Promise.resolve({ count: matches ? 1 : 0 });
      }),
    },
  } as any;
}

async function resolvePrincipal(prisma: any, customerId: string, storeId: string) {
  const strategy = new CustomerJwtStrategy(makeConfig(), prisma);
  return strategy.validate({
    sub: customerId, storeId, email: 'irrelevant@example.com', type: 'customer',
  });
}

describe('Customer Profile — cross-customer isolation (integration)', () => {
  it('a token resolved for customer A returns only customer A\'s profile, never customer B\'s', async () => {
    const prisma = makeSharedPrisma();
    const service = new CustomerProfileService(prisma);
    const controller = new CustomerProfileController(service);

    const principalA = await resolvePrincipal(prisma, 'cust_a', STORE_A);
    const profileA = await controller.getProfile(principalA);

    expect(profileA.email).toBe('alice@example.com');
    expect(profileA.email).not.toBe('bob@example.com');
  });

  it('a token resolved for customer B returns only customer B\'s profile, never customer A\'s', async () => {
    const prisma = makeSharedPrisma();
    const service = new CustomerProfileService(prisma);
    const controller = new CustomerProfileController(service);

    const principalB = await resolvePrincipal(prisma, 'cust_b', STORE_B);
    const profileB = await controller.getProfile(principalB);

    expect(profileB.email).toBe('bob@example.com');
    expect(profileB.email).not.toBe('alice@example.com');
  });

  it('a forged principal claiming customer A\'s id under customer B\'s storeId resolves nothing (guard-level isolation)', async () => {
    const prisma = makeSharedPrisma();
    // CustomerJwtStrategy itself refuses to resolve id+storeId that don't
    // match together — this is what stops a tampered/cross-store JWT before
    // it ever reaches the controller.
    await expect(resolvePrincipal(prisma, 'cust_a', STORE_B)).rejects.toThrow();
  });

  it('even if a forged principal object reached the controller directly, the service layer re-scopes by (id, storeId) and 404s rather than leaking cross-tenant data', async () => {
    const prisma = makeSharedPrisma();
    const service = new CustomerProfileService(prisma);
    const controller = new CustomerProfileController(service);

    const forgedPrincipal = { ...CUSTOMER_A, storeId: STORE_B }; // A's id, wrong store
    await expect(controller.getProfile(forgedPrincipal)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('customer A updating their profile never mutates customer B\'s row', async () => {
    const prisma = makeSharedPrisma();
    const service = new CustomerProfileService(prisma);
    const controller = new CustomerProfileController(service);

    const principalA = await resolvePrincipal(prisma, 'cust_a', STORE_A);
    await controller.updateProfile(principalA, { name: 'Alice Updated' });

    expect(prisma.customer.updateMany).toHaveBeenCalledWith({
      where: { id: 'cust_a', storeId: STORE_A },
      data: { name: 'Alice Updated' },
    });
    expect(prisma.customer.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'cust_b' }) }),
    );
  });

  it('a forged principal cannot update a customer outside their own store — service returns 404, no row is touched', async () => {
    const prisma = makeSharedPrisma();
    const service = new CustomerProfileService(prisma);
    const controller = new CustomerProfileController(service);

    const forgedPrincipal = { ...CUSTOMER_A, storeId: STORE_B };
    await expect(
      controller.updateProfile(forgedPrincipal, { name: 'Hijacked' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
