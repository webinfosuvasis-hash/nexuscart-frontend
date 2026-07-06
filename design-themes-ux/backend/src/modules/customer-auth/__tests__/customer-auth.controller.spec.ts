import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CustomerAuthController } from '../customer-auth.controller';
import { CustomerAuthService } from '../customer-auth.service';
import { CustomerJwtAuthGuard } from '../guards/customer-jwt-auth.guard';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { RegisterCustomerDto } from '../dto/register-customer.dto';
import { LoginCustomerDto } from '../dto/login-customer.dto';
import { RefreshCustomerTokenDto } from '../dto/refresh-customer-token.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';

// FI-2 — CustomerAuthController integration tests. The controller is built
// through Nest's real DI container (so route/param decorators are exercised
// as Nest would resolve them) with CustomerAuthService mocked — this suite
// verifies routing/wiring/response-shaping, not FI-1's business logic, which
// is already covered by customer-auth.service.spec.ts and friends.

const STORE_ID = 'store_1';
const CUSTOMER_ID = 'cust_1';
const AUTHENTICATED_CUSTOMER = {
  id: CUSTOMER_ID, storeId: STORE_ID, email: 'priya@example.com', name: 'Priya Sharma', isActive: true,
};
const TOKEN_PAIR = { accessToken: 'access.jwt', refreshToken: 'refresh.jwt' };

describe('CustomerAuthController', () => {
  let controller: CustomerAuthController;
  let service: jest.Mocked<CustomerAuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerAuthController],
      providers: [
        {
          provide: CustomerAuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            refresh: jest.fn(),
            logout: jest.fn(),
            logoutAll: jest.fn(),
            forgotPassword: jest.fn(),
            resetPassword: jest.fn(),
            verifyEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(CustomerAuthController);
    service = module.get(CustomerAuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('delegates to CustomerAuthService.register with the dto and resolved storeId, unchanged', async () => {
      service.register.mockResolvedValue(TOKEN_PAIR);
      const dto: RegisterCustomerDto = { name: 'Priya Sharma', email: 'priya@example.com', password: 'StrongPass123!' };

      const result = await controller.register(dto, STORE_ID);

      expect(service.register).toHaveBeenCalledWith(dto, STORE_ID);
      expect(service.register).toHaveBeenCalledTimes(1);
      expect(result).toBe(TOKEN_PAIR);
    });

    it('is marked @Public() — merchant JwtAuthGuard must not run on this route', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, CustomerAuthController.prototype.register)).toBe(true);
    });
  });

  describe('login', () => {
    it('delegates to CustomerAuthService.login with the dto and resolved storeId', async () => {
      service.login.mockResolvedValue(TOKEN_PAIR);
      const dto: LoginCustomerDto = { email: 'priya@example.com', password: 'StrongPass123!' };

      const result = await controller.login(dto, STORE_ID);

      expect(service.login).toHaveBeenCalledWith(dto, STORE_ID);
      expect(result).toBe(TOKEN_PAIR);
    });

    it('is marked @Public()', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, CustomerAuthController.prototype.login)).toBe(true);
    });
  });

  describe('refresh', () => {
    it('delegates to CustomerAuthService.refresh with the raw token and resolved storeId', async () => {
      service.refresh.mockResolvedValue(TOKEN_PAIR);
      const dto: RefreshCustomerTokenDto = { refreshToken: 'raw.refresh.token' };

      const result = await controller.refresh(dto, STORE_ID);

      expect(service.refresh).toHaveBeenCalledWith('raw.refresh.token', STORE_ID);
      expect(result).toBe(TOKEN_PAIR);
    });

    it('is marked @Public()', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, CustomerAuthController.prototype.refresh)).toBe(true);
    });
  });

  describe('logout', () => {
    it('delegates to CustomerAuthService.logout with the authenticated customer id and raw token, and wraps the void result in a message', async () => {
      service.logout.mockResolvedValue(undefined);
      const dto: RefreshCustomerTokenDto = { refreshToken: 'raw.refresh.token' };

      const result = await controller.logout(dto, CUSTOMER_ID);

      expect(service.logout).toHaveBeenCalledWith(CUSTOMER_ID, 'raw.refresh.token');
      expect(result).toEqual({ message: expect.any(String) });
    });

    it('is guarded by CustomerJwtAuthGuard and marked @Public() to bypass the merchant guard', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, CustomerAuthController.prototype.logout);
      expect(guards).toContain(CustomerJwtAuthGuard);
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, CustomerAuthController.prototype.logout)).toBe(true);
    });
  });

  describe('logoutAll', () => {
    it('delegates to CustomerAuthService.logoutAll with the authenticated customer id', async () => {
      service.logoutAll.mockResolvedValue(undefined);

      const result = await controller.logoutAll(CUSTOMER_ID);

      expect(service.logoutAll).toHaveBeenCalledWith(CUSTOMER_ID);
      expect(result).toEqual({ message: expect.any(String) });
    });

    it('is guarded by CustomerJwtAuthGuard and marked @Public() to bypass the merchant guard', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, CustomerAuthController.prototype.logoutAll);
      expect(guards).toContain(CustomerJwtAuthGuard);
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, CustomerAuthController.prototype.logoutAll)).toBe(true);
    });
  });

  describe('forgotPassword', () => {
    it('delegates to CustomerAuthService.forgotPassword and always returns the same generic message', async () => {
      service.forgotPassword.mockResolvedValue(undefined);
      const dto: ForgotPasswordDto = { email: 'priya@example.com' };

      const result = await controller.forgotPassword(dto, STORE_ID);

      expect(service.forgotPassword).toHaveBeenCalledWith('priya@example.com', STORE_ID);
      expect(result).toEqual({ message: expect.any(String) });
    });

    it('is marked @Public()', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, CustomerAuthController.prototype.forgotPassword)).toBe(true);
    });
  });

  describe('resetPassword', () => {
    it('delegates to CustomerAuthService.resetPassword with the raw token and new password', async () => {
      service.resetPassword.mockResolvedValue(undefined);
      const dto: ResetPasswordDto = { token: 'a'.repeat(64), newPassword: 'NewPass123!' };

      const result = await controller.resetPassword(dto);

      expect(service.resetPassword).toHaveBeenCalledWith('a'.repeat(64), 'NewPass123!');
      expect(result).toEqual({ message: expect.any(String) });
    });

    it('is marked @Public()', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, CustomerAuthController.prototype.resetPassword)).toBe(true);
    });
  });

  describe('verifyEmail', () => {
    it('delegates to CustomerAuthService.verifyEmail with the raw token', async () => {
      service.verifyEmail.mockResolvedValue(undefined);
      const dto: VerifyEmailDto = { token: 'b'.repeat(64) };

      const result = await controller.verifyEmail(dto);

      expect(service.verifyEmail).toHaveBeenCalledWith('b'.repeat(64));
      expect(result).toEqual({ message: expect.any(String) });
    });

    it('is marked @Public()', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, CustomerAuthController.prototype.verifyEmail)).toBe(true);
    });
  });

  describe('me', () => {
    it('returns exactly the principal resolved onto the request by CustomerJwtAuthGuard — no extra service call', () => {
      const result = controller.me(AUTHENTICATED_CUSTOMER);

      expect(result).toBe(AUTHENTICATED_CUSTOMER);
      expect(service.register).not.toHaveBeenCalled();
    });

    it('is guarded by CustomerJwtAuthGuard and marked @Public() to bypass the merchant guard', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, CustomerAuthController.prototype.me);
      expect(guards).toContain(CustomerJwtAuthGuard);
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, CustomerAuthController.prototype.me)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Validation failures — class-validator behavior for the one DTO FI-2 adds
// (RefreshCustomerTokenDto). The other DTOs' validation is already covered
// by dto/customer-auth.dto.spec.ts (FI-1); not duplicated here.
// ---------------------------------------------------------------------------
describe('RefreshCustomerTokenDto validation', () => {
  it('rejects a missing refreshToken', async () => {
    const dto = plainToInstance(RefreshCustomerTokenDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'refreshToken')).toBe(true);
  });

  it('rejects a non-string refreshToken', async () => {
    const dto = plainToInstance(RefreshCustomerTokenDto, { refreshToken: 12345 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'refreshToken')).toBe(true);
  });

  it('accepts a valid refreshToken', async () => {
    const dto = plainToInstance(RefreshCustomerTokenDto, { refreshToken: 'some.raw.token' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
