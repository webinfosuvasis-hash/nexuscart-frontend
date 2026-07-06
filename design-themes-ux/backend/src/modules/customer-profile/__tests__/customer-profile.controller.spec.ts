import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CustomerProfileController } from '../customer-profile.controller';
import { CustomerProfileService } from '../customer-profile.service';
import { CustomerJwtAuthGuard } from '@/modules/customer-auth/guards/customer-jwt-auth.guard';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';

const STORE_ID = 'store_1';
const CUSTOMER_ID = 'cust_1';
const AUTHENTICATED_CUSTOMER = {
  id: CUSTOMER_ID, storeId: STORE_ID, email: 'priya@example.com', name: 'Priya Sharma', isActive: true,
};
const PROFILE = {
  id: CUSTOMER_ID, name: 'Priya Sharma', email: 'priya@example.com', phone: '9876543210', isEmailVerified: true,
};

describe('CustomerProfileController', () => {
  let controller: CustomerProfileController;
  let service: jest.Mocked<CustomerProfileService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerProfileController],
      providers: [
        {
          provide: CustomerProfileService,
          useValue: { getProfile: jest.fn(), updateProfile: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(CustomerProfileController);
    service = module.get(CustomerProfileService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getProfile', () => {
    it('delegates to CustomerProfileService.getProfile using the guard-resolved id and storeId', async () => {
      service.getProfile.mockResolvedValue(PROFILE);

      const result = await controller.getProfile(AUTHENTICATED_CUSTOMER);

      expect(service.getProfile).toHaveBeenCalledWith(CUSTOMER_ID, STORE_ID);
      expect(result).toBe(PROFILE);
    });

    it('never accepts a customer/store id from the request body or params — only from the resolved principal', () => {
      // getProfile's signature only takes @CurrentCustomer() — there is no
      // @Param/@Query/@Body path that could pass an attacker-controlled id.
      expect(controller.getProfile.length).toBe(1);
    });
  });

  describe('updateProfile', () => {
    it('delegates to CustomerProfileService.updateProfile with the guard-resolved id/storeId and the dto', async () => {
      service.updateProfile.mockResolvedValue({ ...PROFILE, name: 'Priya Updated' });
      const dto = { name: 'Priya Updated' };

      const result = await controller.updateProfile(AUTHENTICATED_CUSTOMER, dto);

      expect(service.updateProfile).toHaveBeenCalledWith(CUSTOMER_ID, STORE_ID, dto);
      expect(result.name).toBe('Priya Updated');
    });
  });

  describe('security wiring', () => {
    it('is guarded by CustomerJwtAuthGuard at the class level', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, CustomerProfileController);
      expect(guards).toContain(CustomerJwtAuthGuard);
    });

    it('is marked @Public() at the class level to bypass the merchant JwtAuthGuard', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, CustomerProfileController)).toBe(true);
    });
  });
});
