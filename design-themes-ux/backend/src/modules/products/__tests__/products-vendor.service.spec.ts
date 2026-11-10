import { BadRequestException } from '@nestjs/common';
import { ProductsService } from '../products.service';

const STORE = 'store_1';

function setup(existing: Record<string, unknown> = {}) {
  const prisma = {
    store:          { findUnique: jest.fn().mockResolvedValue({ subscription: { plan: { maxProducts: 100 } } }) },
    product: {
      count:     jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockImplementation(({ where }: any) =>
        where.OR ? Promise.resolve(null) // slug/SKU clash check on create
          : Promise.resolve({ id: 'p1', storeId: STORE, sku: 'SKU-1', vendorId: null, ...existing })),
      create:    jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'p1', ...data })),
      update:    jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'p1', ...data })),
    },
    productVersion: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({}) },
    vendor:         { findFirst: jest.fn() },
  } as any;
  const vendors = { assertAssignable: jest.fn().mockResolvedValue(undefined) } as any;
  return { prisma, vendors, service: new ProductsService(prisma, vendors) };
}

const base = { name: 'Kurta', price: 999 };

describe('ProductsService — vendor assignment', () => {
  it('create: validates the vendor against the store and persists vendorId', async () => {
    const { service, prisma, vendors } = setup();
    await service.create(STORE, { ...base, vendorId: 'v1' });

    expect(vendors.assertAssignable).toHaveBeenCalledWith(STORE, 'v1', null);
    expect(prisma.product.create.mock.calls[0][0].data.vendorId).toBe('v1');
    expect(prisma.product.create.mock.calls[0][0].include.vendor).toBeDefined();
  });

  it('create: without a vendor the product is unassigned and no vendor check runs', async () => {
    const { service, prisma, vendors } = setup();
    await service.create(STORE, base);
    expect(vendors.assertAssignable).not.toHaveBeenCalled();
    expect(prisma.product.create.mock.calls[0][0].data.vendorId).toBeNull();
  });

  it('create: a cross-store or inactive vendor is rejected and nothing is written', async () => {
    const { service, prisma, vendors } = setup();
    vendors.assertAssignable.mockRejectedValue(new BadRequestException('vendorId does not refer to a vendor in this store'));

    await expect(service.create(STORE, { ...base, vendorId: 'foreign' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('update: omitting vendorId leaves the assignment untouched (backward compatible payloads)', async () => {
    const { service, prisma, vendors } = setup({ vendorId: 'v1' });
    await service.update(STORE, 'p1', { name: 'Renamed' });

    expect(vendors.assertAssignable).not.toHaveBeenCalled();
    expect(prisma.product.update.mock.calls[0][0].data).not.toHaveProperty('vendorId');
  });

  it.each([null, ''])('update: vendorId=%p unassigns the vendor', async (value) => {
    const { service, prisma, vendors } = setup({ vendorId: 'v1' });
    await service.update(STORE, 'p1', { vendorId: value as any });

    expect(vendors.assertAssignable).not.toHaveBeenCalled();
    expect(prisma.product.update.mock.calls[0][0].data.vendorId).toBeNull();
  });

  it('update: reassignment is checked with the product\'s current vendor and persisted', async () => {
    const { service, prisma, vendors } = setup({ vendorId: 'v1' });
    await service.update(STORE, 'p1', { vendorId: 'v2' });

    expect(vendors.assertAssignable).toHaveBeenCalledWith(STORE, 'v2', 'v1');
    expect(prisma.product.update.mock.calls[0][0].data.vendorId).toBe('v2');
    expect(prisma.product.update.mock.calls[0][0].where).toEqual({ id: 'p1', storeId: STORE });
  });

  it('update: a rejected vendor leaves the product unchanged', async () => {
    const { service, prisma, vendors } = setup({ vendorId: null });
    vendors.assertAssignable.mockRejectedValue(new BadRequestException('Inactive vendors cannot be assigned to products'));

    await expect(service.update(STORE, 'p1', { vendorId: 'inactive' })).rejects.toThrow('Inactive vendors');
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('list and detail return the vendor summary (id, name, status — no email)', async () => {
    const { service, prisma } = setup();
    prisma.product.findMany = jest.fn().mockResolvedValue([]);
    await service.findAll(STORE, {});
    await service.findOne(STORE, 'p1');

    const summary = { select: { id: true, name: true, status: true } };
    expect(prisma.product.findMany.mock.calls[0][0].include.vendor).toEqual(summary);
    expect(prisma.product.findFirst.mock.calls.at(-1)[0].include.vendor).toEqual(summary);
  });
});

describe('ProductsService — duplicate', () => {
  function withProduct(vendor: Record<string, unknown> | null) {
    const t = setup({
      vendorId: vendor?.id ?? null, vendor, slug: 'kurta', name: 'Kurta',
      category: { id: 'c1', name: 'Kurtas' }, reviews: [], _count: { orderItems: 3, reviews: 0 },
      variants: [{ id: 'var1', productId: 'p1', name: 'M', sku: 'SKU-1-M', price: 999 }],
      createdAt: new Date(), updatedAt: new Date(),
    });
    return t;
  }

  it('writes only scalar fields (no included relations) and keeps an active vendor', async () => {
    const { service, prisma } = withProduct({ id: 'v1', name: 'Suta', status: 'ACTIVE' });
    await service.duplicate(STORE, 'p1');

    const data = prisma.product.create.mock.calls[0][0].data;
    for (const rel of ['category', 'reviews', '_count', 'vendor', 'id', 'createdAt', 'updatedAt']) {
      expect(data).not.toHaveProperty(rel);
    }
    expect(data.vendorId).toBe('v1');
    expect(data.variants.create[0]).not.toHaveProperty('id');
    expect(data.variants.create[0]).not.toHaveProperty('productId');
  });

  it('does not copy an inactive vendor onto the new product', async () => {
    const { service, prisma } = withProduct({ id: 'v1', name: 'Old', status: 'INACTIVE' });
    await service.duplicate(STORE, 'p1');
    expect(prisma.product.create.mock.calls[0][0].data.vendorId).toBeNull();
  });

  it('duplicates an unassigned product as unassigned', async () => {
    const { service, prisma } = withProduct(null);
    await service.duplicate(STORE, 'p1');
    expect(prisma.product.create.mock.calls[0][0].data.vendorId).toBeNull();
  });
});

describe('ProductsService — tags/images persistence (LongText JSON columns)', () => {
  it('create JSON-encodes the arrays (Prisma rejects arrays for String columns)', async () => {
    const { service, prisma } = setup();
    await service.create(STORE, { ...base, tags: ['cotton', 'summer'], images: ['https://cdn/a.jpg'] });
    const data = prisma.product.create.mock.calls[0][0].data;
    expect(data.tags).toBe('["cotton","summer"]');
    expect(data.images).toBe('["https://cdn/a.jpg"]');
  });

  it('create without arrays stores empty JSON arrays', async () => {
    const { service, prisma } = setup();
    await service.create(STORE, base);
    expect(prisma.product.create.mock.calls[0][0].data).toEqual(expect.objectContaining({ tags: '[]', images: '[]' }));
  });

  it('update encodes arrays it is given and leaves omitted ones untouched', async () => {
    const { service, prisma } = setup();
    await service.update(STORE, 'p1', { tags: ['silk'] });
    const data = prisma.product.update.mock.calls[0][0].data;
    expect(data.tags).toBe('["silk"]');
    expect(data).not.toHaveProperty('images');
  });
});
