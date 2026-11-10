import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { VendorsService } from '../vendors.service';

const STORE = 'store_1';
const OTHER = 'store_2';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'v1', name: 'Suta', email: 'orders@suta.example', status: 'ACTIVE', notifyOnOrder: true,
  createdAt: new Date(), updatedAt: new Date(), _count: { products: 0, users: 0 }, ...over,
});

function setup() {
  const prisma = {
    vendor: {
      findMany:  jest.fn().mockResolvedValue([row()]),
      count:     jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue(row()),
      create:    jest.fn().mockResolvedValue(row()),
      update:    jest.fn().mockResolvedValue(row()),
      delete:    jest.fn().mockResolvedValue(row()),
    },
  } as any;
  return { prisma, service: new VendorsService(prisma) };
}

const p2002 = () => new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' });

describe('VendorsService', () => {
  it('lists only the caller\'s store, with filters', async () => {
    const { service, prisma } = setup();
    const res = await service.findAll(STORE, { status: 'ACTIVE' as any, search: 'sut', page: 1, limit: 50 });

    expect(prisma.vendor.findMany.mock.calls[0][0].where).toEqual({
      storeId: STORE, status: 'ACTIVE', OR: [{ name: { contains: 'sut' } }, { email: { contains: 'sut' } }],
    });
    expect(prisma.vendor.count).toHaveBeenCalledWith({ where: prisma.vendor.findMany.mock.calls[0][0].where });
    expect(res.pagination.total).toBe(1);
  });

  it('creates within the caller\'s store and maps a duplicate name to 409', async () => {
    const { service, prisma } = setup();
    await service.create(STORE, { name: 'Suta', email: 'orders@suta.example' });
    expect(prisma.vendor.create.mock.calls[0][0].data).toEqual({ name: 'Suta', email: 'orders@suta.example', storeId: STORE });

    prisma.vendor.create.mockRejectedValue(p2002());
    await expect(service.create(STORE, { name: 'Suta', email: 'x@y.co' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('ignores a storeId smuggled into the create body', async () => {
    const { service, prisma } = setup();
    await service.create(STORE, { name: 'X', email: 'x@y.co', storeId: OTHER } as any);
    expect(prisma.vendor.create.mock.calls[0][0].data.storeId).toBe(STORE);
  });

  describe('store isolation — another store\'s vendor is a 404', () => {
    it.each(['findOne', 'update', 'remove'] as const)('%s', async (method) => {
      const { service, prisma } = setup();
      prisma.vendor.findFirst.mockResolvedValue(null); // scoped lookup finds nothing

      const call = method === 'update'
        ? service.update(OTHER, 'v1', { name: 'Hijack' })
        : (service[method] as any)(OTHER, 'v1');
      await expect(call).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.vendor.findFirst.mock.calls[0][0].where).toEqual({ id: 'v1', storeId: OTHER });
      expect(prisma.vendor.update).not.toHaveBeenCalled();
      expect(prisma.vendor.delete).not.toHaveBeenCalled();
    });
  });

  it('updates after the scoped existence check', async () => {
    const { service, prisma } = setup();
    await service.update(STORE, 'v1', { status: 'INACTIVE' as any, notifyOnOrder: false });
    expect(prisma.vendor.update.mock.calls[0][0]).toEqual(expect.objectContaining({
      where: { id: 'v1' }, data: { status: 'INACTIVE', notifyOnOrder: false },
    }));
  });

  it('refuses to delete a vendor that still has live products, and deletes one that has none', async () => {
    const { service, prisma } = setup();
    prisma.vendor.findFirst.mockResolvedValue(row({ _count: { products: 3 } }));
    await expect(service.remove(STORE, 'v1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.vendor.delete).not.toHaveBeenCalled();

    prisma.vendor.findFirst.mockResolvedValue(row());
    await service.remove(STORE, 'v1');
    expect(prisma.vendor.delete).toHaveBeenCalledWith({ where: { id: 'v1' } });
  });

  describe('assertAssignable', () => {
    it('accepts an active vendor of the same store', async () => {
      const { service, prisma } = setup();
      prisma.vendor.findFirst.mockResolvedValue({ status: 'ACTIVE' });
      await expect(service.assertAssignable(STORE, 'v1')).resolves.toBeUndefined();
      expect(prisma.vendor.findFirst.mock.calls[0][0].where).toEqual({ id: 'v1', storeId: STORE });
    });

    it('rejects a vendor from another store (or a made-up id)', async () => {
      const { service, prisma } = setup();
      prisma.vendor.findFirst.mockResolvedValue(null);
      await expect(service.assertAssignable(STORE, 'other-store-vendor')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects newly assigning an inactive vendor but lets a product keep one it already has', async () => {
      const { service, prisma } = setup();
      prisma.vendor.findFirst.mockResolvedValue({ status: 'INACTIVE' });
      await expect(service.assertAssignable(STORE, 'v1')).rejects.toThrow('Inactive vendors cannot be assigned');
      await expect(service.assertAssignable(STORE, 'v1', 'v2')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.assertAssignable(STORE, 'v1', 'v1')).resolves.toBeUndefined();
    });
  });
});
