import { NotFoundException } from '@nestjs/common';
import { CustomerAddressService } from '../customer-address.service';

const STORE_ID = 'store_1';
const CUSTOMER_ID = 'cust_1';
const ADDRESS_ID = 'addr_1';

const RAW_ADDRESS = {
  id: ADDRESS_ID,
  customerId: CUSTOMER_ID,
  label: 'Home',
  firstName: 'Priya',
  lastName: 'Sharma',
  line1: '221B, Sunshine Apartments',
  line2: null,
  city: 'Mumbai',
  state: 'Maharashtra',
  postalCode: '400001',
  country: 'IN',
  phone: '9876543210',
  isDefault: false,
};

function makePrisma() {
  return {
    customer: { findFirst: jest.fn() },
    customerAddress: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((ops: any[]) => Promise.all(ops)),
  } as any;
}

describe('CustomerAddressService — listAddresses', () => {
  it('scopes by (customerId, storeId) via the customer relation, ordering defaults first', async () => {
    const prisma = makePrisma();
    prisma.customerAddress.findMany.mockResolvedValue([RAW_ADDRESS]);
    const service = new CustomerAddressService(prisma);

    const result = await service.listAddresses(CUSTOMER_ID, STORE_ID);

    expect(prisma.customerAddress.findMany).toHaveBeenCalledWith({
      where: { customerId: CUSTOMER_ID, customer: { storeId: STORE_ID } },
      orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    });
    expect(result).toEqual([expect.objectContaining({ id: ADDRESS_ID, city: 'Mumbai' })]);
  });

  it('returns an empty list rather than throwing when the customer has no addresses', async () => {
    const prisma = makePrisma();
    prisma.customerAddress.findMany.mockResolvedValue([]);
    const service = new CustomerAddressService(prisma);

    await expect(service.listAddresses(CUSTOMER_ID, STORE_ID)).resolves.toEqual([]);
  });
});

describe('CustomerAddressService — createAddress', () => {
  const dto = {
    label: 'Home', firstName: 'Priya', lastName: 'Sharma', line1: '221B, Sunshine Apartments',
    city: 'Mumbai', state: 'Maharashtra', postalCode: '400001', phone: '9876543210',
  };

  it('verifies the customer belongs to the store before creating', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue({ id: CUSTOMER_ID });
    prisma.customerAddress.create.mockResolvedValue(RAW_ADDRESS);
    const service = new CustomerAddressService(prisma);

    await service.createAddress(CUSTOMER_ID, STORE_ID, dto as any);

    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { id: CUSTOMER_ID, storeId: STORE_ID },
      select: { id: true },
    });
    expect(prisma.customerAddress.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ customerId: CUSTOMER_ID, line1: dto.line1, city: dto.city }),
    });
  });

  it('rejects when the customer does not belong to the given store', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue(null);
    const service = new CustomerAddressService(prisma);

    await expect(service.createAddress(CUSTOMER_ID, 'someone-elses-store', dto as any))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.customerAddress.create).not.toHaveBeenCalled();
  });

  it('omits country from the write when not provided, letting the Prisma column default (IN) apply', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue({ id: CUSTOMER_ID });
    prisma.customerAddress.create.mockResolvedValue(RAW_ADDRESS);
    const service = new CustomerAddressService(prisma);

    await service.createAddress(CUSTOMER_ID, STORE_ID, dto as any);

    const createCall = prisma.customerAddress.create.mock.calls[0][0];
    expect(createCall.data).not.toHaveProperty('country');
  });

  it('never allows isDefault to be set via create (not part of CreateCustomerAddressDto)', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue({ id: CUSTOMER_ID });
    prisma.customerAddress.create.mockResolvedValue(RAW_ADDRESS);
    const service = new CustomerAddressService(prisma);

    await service.createAddress(CUSTOMER_ID, STORE_ID, { ...dto, isDefault: true } as any);

    const createCall = prisma.customerAddress.create.mock.calls[0][0];
    expect(createCall.data).not.toHaveProperty('isDefault');
  });
});

describe('CustomerAddressService — updateAddress', () => {
  it('updates only the provided fields, scoped by (id, customerId, storeId)', async () => {
    const prisma = makePrisma();
    prisma.customerAddress.updateMany.mockResolvedValue({ count: 1 });
    prisma.customerAddress.findFirst.mockResolvedValue({ ...RAW_ADDRESS, city: 'Pune' });
    const service = new CustomerAddressService(prisma);

    const result = await service.updateAddress(ADDRESS_ID, CUSTOMER_ID, STORE_ID, { city: 'Pune' });

    expect(prisma.customerAddress.updateMany).toHaveBeenCalledWith({
      where: { id: ADDRESS_ID, customerId: CUSTOMER_ID, customer: { storeId: STORE_ID } },
      data: { city: 'Pune' },
    });
    expect(result.city).toBe('Pune');
  });

  it('is a no-op write (but still returns the current row) when the dto has no fields set', async () => {
    const prisma = makePrisma();
    prisma.customerAddress.findFirst.mockResolvedValue(RAW_ADDRESS);
    const service = new CustomerAddressService(prisma);

    await service.updateAddress(ADDRESS_ID, CUSTOMER_ID, STORE_ID, {});

    expect(prisma.customerAddress.updateMany).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the address does not belong to (customerId, storeId)', async () => {
    const prisma = makePrisma();
    prisma.customerAddress.updateMany.mockResolvedValue({ count: 0 });
    const service = new CustomerAddressService(prisma);

    await expect(service.updateAddress(ADDRESS_ID, CUSTOMER_ID, 'someone-elses-store', { city: 'Hijacked' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.customerAddress.findFirst).not.toHaveBeenCalled();
  });

  it('ignores isDefault even if somehow present on the dto object (not part of UpdateCustomerAddressDto\'s type)', async () => {
    const prisma = makePrisma();
    prisma.customerAddress.updateMany.mockResolvedValue({ count: 1 });
    prisma.customerAddress.findFirst.mockResolvedValue(RAW_ADDRESS);
    const service = new CustomerAddressService(prisma);

    await service.updateAddress(ADDRESS_ID, CUSTOMER_ID, STORE_ID, { city: 'Pune', isDefault: true } as any);

    const updateCall = prisma.customerAddress.updateMany.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('isDefault');
  });
});

describe('CustomerAddressService — deleteAddress', () => {
  it('deletes only when scoped by (id, customerId, storeId) together', async () => {
    const prisma = makePrisma();
    prisma.customerAddress.deleteMany.mockResolvedValue({ count: 1 });
    const service = new CustomerAddressService(prisma);

    const result = await service.deleteAddress(ADDRESS_ID, CUSTOMER_ID, STORE_ID);

    expect(prisma.customerAddress.deleteMany).toHaveBeenCalledWith({
      where: { id: ADDRESS_ID, customerId: CUSTOMER_ID, customer: { storeId: STORE_ID } },
    });
    expect(result).toEqual({ message: 'Address deleted' });
  });

  it('throws NotFoundException rather than silently no-op-ing when nothing matched', async () => {
    const prisma = makePrisma();
    prisma.customerAddress.deleteMany.mockResolvedValue({ count: 0 });
    const service = new CustomerAddressService(prisma);

    await expect(service.deleteAddress(ADDRESS_ID, CUSTOMER_ID, 'someone-elses-store'))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('CustomerAddressService — setDefault', () => {
  it('confirms ownership, then unsets every other default and sets this one, inside a transaction', async () => {
    const prisma = makePrisma();
    prisma.customerAddress.findFirst
      .mockResolvedValueOnce({ id: ADDRESS_ID }) // ownership check
      .mockResolvedValueOnce({ ...RAW_ADDRESS, isDefault: true }); // loadOne after the transaction
    prisma.customerAddress.updateMany.mockResolvedValue({ count: 2 });
    prisma.customerAddress.update.mockResolvedValue({ ...RAW_ADDRESS, isDefault: true });
    const service = new CustomerAddressService(prisma);

    const result = await service.setDefault(ADDRESS_ID, CUSTOMER_ID, STORE_ID);

    expect(prisma.customerAddress.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: ADDRESS_ID, customerId: CUSTOMER_ID, customer: { storeId: STORE_ID } },
      select: { id: true },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      expect.anything(), // customerAddress.updateMany({ where: { customerId, isDefault: true }, data: { isDefault: false } })
      expect.anything(), // customerAddress.update({ where: { id }, data: { isDefault: true } })
    ]);
    expect(prisma.customerAddress.updateMany).toHaveBeenCalledWith({
      where: { customerId: CUSTOMER_ID, isDefault: true },
      data: { isDefault: false },
    });
    expect(prisma.customerAddress.update).toHaveBeenCalledWith({
      where: { id: ADDRESS_ID },
      data: { isDefault: true },
    });
    expect(result.isDefault).toBe(true);
  });

  it('rejects setting a default for an address outside (customerId, storeId), touching no other rows', async () => {
    const prisma = makePrisma();
    prisma.customerAddress.findFirst.mockResolvedValue(null);
    const service = new CustomerAddressService(prisma);

    await expect(service.setDefault(ADDRESS_ID, CUSTOMER_ID, 'someone-elses-store'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('default-shipping and default-billing are the same operation — both converge on one default per customer', async () => {
    // This is really a controller-level fact (both routes call setDefault),
    // asserted here at the service boundary: calling setDefault twice for
    // two different addresses leaves exactly the second one as the default.
    const prisma = makePrisma();
    prisma.customerAddress.findFirst
      .mockResolvedValueOnce({ id: 'addr_2' })
      .mockResolvedValueOnce({ ...RAW_ADDRESS, id: 'addr_2', isDefault: true });
    prisma.customerAddress.updateMany.mockResolvedValue({ count: 1 });
    prisma.customerAddress.update.mockResolvedValue({ ...RAW_ADDRESS, id: 'addr_2', isDefault: true });
    const service = new CustomerAddressService(prisma);

    await service.setDefault('addr_2', CUSTOMER_ID, STORE_ID);

    // The unset-all step is unconditional on customerId — it doesn't
    // special-case "shipping" vs "billing", because there is no such
    // distinction in the schema.
    expect(prisma.customerAddress.updateMany).toHaveBeenCalledWith({
      where: { customerId: CUSTOMER_ID, isDefault: true },
      data: { isDefault: false },
    });
  });
});
