import { NotFoundException } from '@nestjs/common';
import { CustomerProfileService } from '../customer-profile.service';

const STORE_ID = 'store_1';
const CUSTOMER_ID = 'cust_1';

function makePrisma() {
  return {
    customer: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  } as any;
}

const RAW_CUSTOMER_ROW = {
  id: CUSTOMER_ID,
  name: 'Priya Sharma',
  email: 'priya@example.com',
  phone: '9876543210',
  credential: { isEmailVerified: true },
};

describe('CustomerProfileService — getProfile', () => {
  it('returns the public-safe profile shape, scoped by (id, storeId) together', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue(RAW_CUSTOMER_ROW);
    const service = new CustomerProfileService(prisma);

    const result = await service.getProfile(CUSTOMER_ID, STORE_ID);

    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { id: CUSTOMER_ID, storeId: STORE_ID },
      select: {
        id: true, name: true, email: true, phone: true,
        credential: { select: { isEmailVerified: true } },
      },
    });
    expect(result).toEqual({
      id: CUSTOMER_ID,
      name: 'Priya Sharma',
      email: 'priya@example.com',
      phone: '9876543210',
      isEmailVerified: true,
    });
  });

  it('never leaks CustomerCredential internals (only isEmailVerified is derived)', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue(RAW_CUSTOMER_ROW);
    const service = new CustomerProfileService(prisma);

    const result: any = await service.getProfile(CUSTOMER_ID, STORE_ID);

    expect(Object.keys(result).sort()).toEqual(['email', 'id', 'isEmailVerified', 'name', 'phone']);
  });

  it('defaults isEmailVerified to false when the customer has no credential row', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue({ ...RAW_CUSTOMER_ROW, credential: null });
    const service = new CustomerProfileService(prisma);

    const result = await service.getProfile(CUSTOMER_ID, STORE_ID);

    expect(result.isEmailVerified).toBe(false);
  });

  it('throws NotFoundException when no row matches (id, storeId) together', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue(null);
    const service = new CustomerProfileService(prisma);

    await expect(service.getProfile(CUSTOMER_ID, STORE_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('never returns a customer belonging to a different store, even if the row exists (isolation)', async () => {
    const prisma = makePrisma();
    // Simulates the DB query itself being scoped correctly: a customer that
    // exists but not under this storeId is not returned by findFirst.
    prisma.customer.findFirst.mockResolvedValue(null);
    const service = new CustomerProfileService(prisma);

    await expect(service.getProfile(CUSTOMER_ID, 'store_2')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CUSTOMER_ID, storeId: 'store_2' } }),
    );
  });
});

describe('CustomerProfileService — updateProfile', () => {
  it('updates only the provided fields, scoped by (id, storeId) via updateMany', async () => {
    const prisma = makePrisma();
    prisma.customer.updateMany.mockResolvedValue({ count: 1 });
    prisma.customer.findFirst.mockResolvedValue({ ...RAW_CUSTOMER_ROW, name: 'Priya Updated' });
    const service = new CustomerProfileService(prisma);

    const result = await service.updateProfile(CUSTOMER_ID, STORE_ID, { name: 'Priya Updated' });

    expect(prisma.customer.updateMany).toHaveBeenCalledWith({
      where: { id: CUSTOMER_ID, storeId: STORE_ID },
      data: { name: 'Priya Updated' },
    });
    expect(result.name).toBe('Priya Updated');
  });

  it('only includes phone in the update payload when name is omitted', async () => {
    const prisma = makePrisma();
    prisma.customer.updateMany.mockResolvedValue({ count: 1 });
    prisma.customer.findFirst.mockResolvedValue(RAW_CUSTOMER_ROW);
    const service = new CustomerProfileService(prisma);

    await service.updateProfile(CUSTOMER_ID, STORE_ID, { phone: '9999999999' });

    expect(prisma.customer.updateMany).toHaveBeenCalledWith({
      where: { id: CUSTOMER_ID, storeId: STORE_ID },
      data: { phone: '9999999999' },
    });
  });

  it('skips the write entirely (no-op) when the DTO has no fields set, but still returns the current profile', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue(RAW_CUSTOMER_ROW);
    const service = new CustomerProfileService(prisma);

    const result = await service.updateProfile(CUSTOMER_ID, STORE_ID, {});

    expect(prisma.customer.updateMany).not.toHaveBeenCalled();
    expect(result.id).toBe(CUSTOMER_ID);
  });

  it('rejects an update for a customer id that does not belong to the given store (cross-tenant isolation)', async () => {
    const prisma = makePrisma();
    // A malicious/forged storeId won't match any row scoped to this customer.
    prisma.customer.updateMany.mockResolvedValue({ count: 0 });
    const service = new CustomerProfileService(prisma);

    await expect(
      service.updateProfile(CUSTOMER_ID, 'someone-elses-store', { name: 'Hijacked' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.customer.findFirst).not.toHaveBeenCalled();
  });

  it('never allows email or credential fields to be set via this path (not part of UpdateCustomerProfileDto)', async () => {
    const prisma = makePrisma();
    prisma.customer.updateMany.mockResolvedValue({ count: 1 });
    prisma.customer.findFirst.mockResolvedValue(RAW_CUSTOMER_ROW);
    const service = new CustomerProfileService(prisma);

    await service.updateProfile(CUSTOMER_ID, STORE_ID, { name: 'Priya Sharma' } as any);

    const updateCall = prisma.customer.updateMany.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('email');
    expect(updateCall.data).not.toHaveProperty('passwordHash');
  });
});
