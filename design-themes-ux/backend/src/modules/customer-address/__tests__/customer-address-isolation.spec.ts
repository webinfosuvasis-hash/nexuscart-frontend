import { NotFoundException } from '@nestjs/common';
import { CustomerJwtStrategy } from '@/modules/customer-auth/strategies/customer-jwt.strategy';
import { CustomerAddressController } from '../customer-address.controller';
import { CustomerAddressService } from '../customer-address.service';

// ---------------------------------------------------------------------------
// Integration test — proves cross-customer/cross-tenant isolation through the
// REAL chain: CustomerJwtStrategy.validate() (resolves the principal attached
// to the request by CustomerJwtAuthGuard) → CustomerAddressController (real)
// → CustomerAddressService (real). Only PrismaService is a test double,
// standing in for two customers (in two different stores) each with their
// own address.
// ---------------------------------------------------------------------------

const STORE_A = 'store_a';
const STORE_B = 'store_b';

const CUSTOMER_A = { id: 'cust_a', storeId: STORE_A, email: 'alice@example.com', name: 'Alice', isActive: true };
const CUSTOMER_B = { id: 'cust_b', storeId: STORE_B, email: 'bob@example.com', name: 'Bob', isActive: true };

const ADDRESS_A = {
  id: 'addr_a', customerId: 'cust_a', label: 'Home', firstName: 'Alice', lastName: null,
  line1: '1 Alice St', line2: null, city: 'Mumbai', state: 'Maharashtra', postalCode: '400001',
  country: 'IN', phone: null, isDefault: true,
};
const ADDRESS_B = {
  id: 'addr_b', customerId: 'cust_b', label: 'Home', firstName: 'Bob', lastName: null,
  line1: '1 Bob St', line2: null, city: 'Delhi', state: 'Delhi', postalCode: '110001',
  country: 'IN', phone: null, isDefault: true,
};

function makeConfig() {
  return { get: jest.fn().mockReturnValue('test-customer-secret') } as any;
}

function makeSharedPrisma() {
  const customers: Record<string, any> = { cust_a: CUSTOMER_A, cust_b: CUSTOMER_B };
  const addresses: Record<string, any> = { addr_a: { ...ADDRESS_A }, addr_b: { ...ADDRESS_B } };

  return {
    customer: {
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        const row = customers[where.id];
        if (!row || row.storeId !== where.storeId) return Promise.resolve(null);
        return Promise.resolve(row);
      }),
    },
    customerAddress: {
      findMany: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(
        Object.values(addresses).filter(
          (a: any) => a.customerId === where.customerId && customers[a.customerId]?.storeId === where.customer.storeId,
        ),
      )),
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        const row = addresses[where.id];
        if (!row) return Promise.resolve(null);
        if (where.customerId && row.customerId !== where.customerId) return Promise.resolve(null);
        if (where.customer?.storeId && customers[row.customerId]?.storeId !== where.customer.storeId) return Promise.resolve(null);
        return Promise.resolve(row);
      }),
      updateMany: jest.fn().mockImplementation(({ where, data }: any) => {
        const matches = Object.values(addresses).filter((a: any) => {
          if (where.id && a.id !== where.id) return false;
          if (where.customerId && a.customerId !== where.customerId) return false;
          if (where.customer?.storeId && customers[a.customerId]?.storeId !== where.customer.storeId) return false;
          if (where.isDefault !== undefined && a.isDefault !== where.isDefault) return false;
          return true;
        });
        matches.forEach((a: any) => Object.assign(a, data));
        return Promise.resolve({ count: matches.length });
      }),
      update: jest.fn().mockImplementation(({ where, data }: any) => {
        const row = addresses[where.id];
        Object.assign(row, data);
        return Promise.resolve(row);
      }),
      deleteMany: jest.fn().mockImplementation(({ where }: any) => {
        const row = addresses[where.id];
        const matches = row && row.customerId === where.customerId
          && customers[row.customerId]?.storeId === where.customer.storeId;
        if (matches) delete addresses[where.id];
        return Promise.resolve({ count: matches ? 1 : 0 });
      }),
      create: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((ops: any[]) => Promise.all(ops)),
  } as any;
}

async function resolvePrincipal(prisma: any, customerId: string, storeId: string) {
  const strategy = new CustomerJwtStrategy(makeConfig(), prisma);
  return strategy.validate({
    sub: customerId, storeId, email: 'irrelevant@example.com', type: 'customer',
  });
}

describe('Customer Address Book — cross-customer isolation (integration)', () => {
  it('customer A\'s address list never includes customer B\'s address', async () => {
    const prisma = makeSharedPrisma();
    const controller = new CustomerAddressController(new CustomerAddressService(prisma));

    const principalA = await resolvePrincipal(prisma, 'cust_a', STORE_A);
    const listA = await controller.list(principalA);

    expect(listA).toHaveLength(1);
    expect(listA[0].id).toBe('addr_a');
  });

  it('customer B cannot fetch customer A\'s address via update (404, not a leak)', async () => {
    const prisma = makeSharedPrisma();
    const controller = new CustomerAddressController(new CustomerAddressService(prisma));

    const principalB = await resolvePrincipal(prisma, 'cust_b', STORE_B);

    await expect(controller.update(principalB, 'addr_a', { city: 'Hijacked' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('customer B cannot delete customer A\'s address', async () => {
    const prisma = makeSharedPrisma();
    const controller = new CustomerAddressController(new CustomerAddressService(prisma));

    const principalB = await resolvePrincipal(prisma, 'cust_b', STORE_B);

    await expect(controller.remove(principalB, 'addr_a')).rejects.toBeInstanceOf(NotFoundException);

    // Confirm it's genuinely untouched, not silently soft-failed.
    const principalA = await resolvePrincipal(prisma, 'cust_a', STORE_A);
    const listA = await controller.list(principalA);
    expect(listA).toHaveLength(1);
  });

  it('customer B cannot set customer A\'s address as their own default', async () => {
    const prisma = makeSharedPrisma();
    const controller = new CustomerAddressController(new CustomerAddressService(prisma));

    const principalB = await resolvePrincipal(prisma, 'cust_b', STORE_B);

    await expect(controller.setDefaultShipping(principalB, 'addr_a')).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.setDefaultBilling(principalB, 'addr_a')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a forged principal (A\'s id, B\'s storeId) cannot reach A\'s address either', async () => {
    const prisma = makeSharedPrisma();
    const controller = new CustomerAddressController(new CustomerAddressService(prisma));
    const forgedPrincipal = { ...CUSTOMER_A, storeId: STORE_B };

    await expect(controller.update(forgedPrincipal, 'addr_a', { city: 'Hijacked' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('setting customer A\'s own default only ever touches customer A\'s rows', async () => {
    const prisma = makeSharedPrisma();
    const controller = new CustomerAddressController(new CustomerAddressService(prisma));

    const principalA = await resolvePrincipal(prisma, 'cust_a', STORE_A);
    await controller.setDefaultShipping(principalA, 'addr_a');

    // addr_b (customer B's) must remain untouched.
    const principalB = await resolvePrincipal(prisma, 'cust_b', STORE_B);
    const listB = await controller.list(principalB);
    expect(listB[0].isDefault).toBe(true); // still true — never unset by A's action
  });
});
