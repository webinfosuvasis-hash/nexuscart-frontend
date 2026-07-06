import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomerJwtStrategy } from './customer-jwt.strategy';
import { CustomerJwtPayload } from '../types/customer-auth.types';

function makeConfigService(): ConfigService {
  return {
    get: jest.fn((key: string) => (key === 'CUSTOMER_JWT_SECRET' ? 'test-customer-secret' : undefined)),
  } as any;
}

function makePrisma(customer: any) {
  return {
    customer: {
      findFirst: jest.fn().mockResolvedValue(customer),
    },
  } as any;
}

function makePayload(overrides: Partial<CustomerJwtPayload> = {}): CustomerJwtPayload {
  return {
    sub: 'cust_1',
    storeId: 'store_1',
    email: 'priya@example.com',
    type: 'customer',
    ...overrides,
  };
}

const ACTIVE_CUSTOMER = {
  id: 'cust_1', storeId: 'store_1', email: 'priya@example.com', name: 'Priya', isActive: true,
};

describe('CustomerJwtStrategy', () => {
  it('resolves an active customer scoped by (id, storeId)', async () => {
    const prisma = makePrisma(ACTIVE_CUSTOMER);
    const strategy = new CustomerJwtStrategy(makeConfigService(), prisma);

    const result = await strategy.validate(makePayload());

    expect(result).toEqual(ACTIVE_CUSTOMER);
    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { id: 'cust_1', storeId: 'store_1' },
      select: {
        id: true, storeId: true, email: true, name: true, isActive: true,
      },
    });
  });

  it('rejects a payload missing type: customer', async () => {
    const prisma = makePrisma(ACTIVE_CUSTOMER);
    const strategy = new CustomerJwtStrategy(makeConfigService(), prisma);

    await expect(
      strategy.validate(makePayload({ type: undefined as unknown as 'customer' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.customer.findFirst).not.toHaveBeenCalled();
  });

  it('rejects when no customer matches (id, storeId) together', async () => {
    const prisma = makePrisma(null);
    const strategy = new CustomerJwtStrategy(makeConfigService(), prisma);

    await expect(strategy.validate(makePayload())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an inactive customer even when found', async () => {
    const prisma = makePrisma({ ...ACTIVE_CUSTOMER, isActive: false });
    const strategy = new CustomerJwtStrategy(makeConfigService(), prisma);

    await expect(strategy.validate(makePayload())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('never resolves a customer from a different store, even with the right id', async () => {
    // The lookup itself is scoped by (id, storeId); simulate the DB
    // correctly returning nothing when the token's storeId doesn't match.
    const prisma = makePrisma(null);
    const strategy = new CustomerJwtStrategy(makeConfigService(), prisma);

    await expect(
      strategy.validate(makePayload({ storeId: 'store_2' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { id: 'cust_1', storeId: 'store_2' },
      select: expect.any(Object),
    });
  });
});
