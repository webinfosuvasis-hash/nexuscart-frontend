import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CustomerAddressController } from '../customer-address.controller';
import { CustomerAddressService } from '../customer-address.service';
import { CustomerJwtAuthGuard } from '@/modules/customer-auth/guards/customer-jwt-auth.guard';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';

const STORE_ID = 'store_1';
const CUSTOMER_ID = 'cust_1';
const ADDRESS_ID = 'addr_1';
const AUTHENTICATED_CUSTOMER = {
  id: CUSTOMER_ID, storeId: STORE_ID, email: 'priya@example.com', name: 'Priya Sharma', isActive: true,
};
const ADDRESS = {
  id: ADDRESS_ID, label: 'Home', firstName: 'Priya', lastName: 'Sharma', line1: '221B',
  line2: null, city: 'Mumbai', state: 'Maharashtra', postalCode: '400001', country: 'IN',
  phone: '9876543210', isDefault: false,
};

describe('CustomerAddressController', () => {
  let controller: CustomerAddressController;
  let service: jest.Mocked<CustomerAddressService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerAddressController],
      providers: [
        {
          provide: CustomerAddressService,
          useValue: {
            listAddresses: jest.fn(),
            createAddress: jest.fn(),
            updateAddress: jest.fn(),
            deleteAddress: jest.fn(),
            setDefault: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(CustomerAddressController);
    service = module.get(CustomerAddressService);
  });

  afterEach(() => jest.clearAllMocks());

  it('list() delegates with the guard-resolved id/storeId only', async () => {
    service.listAddresses.mockResolvedValue([ADDRESS]);

    const result = await controller.list(AUTHENTICATED_CUSTOMER);

    expect(service.listAddresses).toHaveBeenCalledWith(CUSTOMER_ID, STORE_ID);
    expect(result).toEqual([ADDRESS]);
  });

  it('create() delegates with the guard-resolved id/storeId and the dto', async () => {
    service.createAddress.mockResolvedValue(ADDRESS);
    const dto = { line1: '221B', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001' };

    const result = await controller.create(AUTHENTICATED_CUSTOMER, dto as any);

    expect(service.createAddress).toHaveBeenCalledWith(CUSTOMER_ID, STORE_ID, dto);
    expect(result).toBe(ADDRESS);
  });

  it('update() delegates with the guard-resolved id/storeId, the address id param, and the dto', async () => {
    service.updateAddress.mockResolvedValue({ ...ADDRESS, city: 'Pune' });
    const dto = { city: 'Pune' };

    const result = await controller.update(AUTHENTICATED_CUSTOMER, ADDRESS_ID, dto);

    expect(service.updateAddress).toHaveBeenCalledWith(ADDRESS_ID, CUSTOMER_ID, STORE_ID, dto);
    expect(result.city).toBe('Pune');
  });

  it('remove() delegates with the guard-resolved id/storeId and the address id param', async () => {
    service.deleteAddress.mockResolvedValue({ message: 'Address deleted' });

    const result = await controller.remove(AUTHENTICATED_CUSTOMER, ADDRESS_ID);

    expect(service.deleteAddress).toHaveBeenCalledWith(ADDRESS_ID, CUSTOMER_ID, STORE_ID);
    expect(result).toEqual({ message: 'Address deleted' });
  });

  it('setDefaultShipping() and setDefaultBilling() both delegate to the same service.setDefault()', async () => {
    service.setDefault.mockResolvedValue({ ...ADDRESS, isDefault: true });

    await controller.setDefaultShipping(AUTHENTICATED_CUSTOMER, ADDRESS_ID);
    await controller.setDefaultBilling(AUTHENTICATED_CUSTOMER, ADDRESS_ID);

    expect(service.setDefault).toHaveBeenNthCalledWith(1, ADDRESS_ID, CUSTOMER_ID, STORE_ID);
    expect(service.setDefault).toHaveBeenNthCalledWith(2, ADDRESS_ID, CUSTOMER_ID, STORE_ID);
    expect(service.setDefault).toHaveBeenCalledTimes(2);
  });

  describe('security wiring', () => {
    it('is guarded by CustomerJwtAuthGuard at the class level', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, CustomerAddressController);
      expect(guards).toContain(CustomerJwtAuthGuard);
    });

    it('is marked @Public() at the class level to bypass the merchant JwtAuthGuard', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, CustomerAddressController)).toBe(true);
    });
  });
});
