import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { CustomerAuthService } from './customer-auth.service';
import { RegisterCustomerDto } from './dto/register-customer.dto';

// ---------------------------------------------------------------------------
// P1 regression — CustomerAuthService.issueTokenPair() previously signed the
// refresh token from a payload with no unique claim (sub/storeId/email/type),
// and JWT `iat` only has 1-second resolution. Two issuances for the same
// customer within the same second produced a byte-identical refresh JWT,
// colliding on CustomerRefreshToken.tokenHash's unique constraint.
//
// Fix: the refresh-only payload now carries a random `jti` (crypto.randomUUID()).
// These tests use a REAL JwtService (not a payload-blind mock) so the
// signature/uniqueness assertions are meaningful, and freeze Date.now() so
// both issuances land on the identical `iat` second — otherwise a passing
// test wouldn't prove the fix, since a differing `iat` alone would also make
// the tokens differ.
// ---------------------------------------------------------------------------

const STORE_ID = 'store_1';
const VALID_PASSWORD = 'StrongPass123!';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function makeConfig() {
  return {
    get: jest.fn((key: string) => {
      switch (key) {
        case 'CUSTOMER_JWT_SECRET': return 'access-secret';
        case 'CUSTOMER_JWT_EXPIRES_IN': return '15m';
        case 'CUSTOMER_JWT_REFRESH_SECRET': return 'refresh-secret';
        case 'CUSTOMER_JWT_REFRESH_EXPIRES_DAYS': return '30';
        default: return undefined;
      }
    }),
  } as any;
}

function makeTxClient(customerId: string) {
  return {
    customer: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: customerId, storeId: STORE_ID, email: 'priya@example.com' }),
    },
    customerCredential: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
    customerVerificationToken: { create: jest.fn().mockResolvedValue({}) },
  };
}

function makePrisma(customerId: string, tx = makeTxClient(customerId)) {
  return {
    $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    customerRefreshToken: {
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    customer: { findFirst: jest.fn(), findUnique: jest.fn() },
    customerCredential: { update: jest.fn() },
  } as any;
}

function makeOutboxHelper() {
  return { upsertOutboxEvent: jest.fn().mockResolvedValue(undefined) } as any;
}

const REGISTER_DTO: RegisterCustomerDto = {
  name: 'Priya Sharma', email: 'priya@example.com', password: VALID_PASSWORD,
} as any;

describe('CustomerAuthService — P1 refresh token uniqueness (jti)', () => {
  const jwt = new JwtService({});
  let nowSpy: jest.SpyInstance;

  beforeEach(() => {
    // Freeze time so two issuances land on the identical `iat` second —
    // isolates the assertion to the jti fix, not an incidental clock tick.
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('two consecutive issueTokenPair() calls (same customer, same second, same payload) produce different refresh tokens', async () => {
    const service1 = new CustomerAuthService(makePrisma('cust_1'), jwt, makeConfig(), makeOutboxHelper());
    const service2 = new CustomerAuthService(makePrisma('cust_1'), jwt, makeConfig(), makeOutboxHelper());

    const result1 = await service1.register(REGISTER_DTO, STORE_ID);
    const result2 = await service2.register(REGISTER_DTO, STORE_ID);

    expect(result1.refreshToken).not.toBe(result2.refreshToken);
  });

  it('their SHA-256 hashes differ, so both rows can be persisted without a unique-constraint collision', async () => {
    const service1 = new CustomerAuthService(makePrisma('cust_1'), jwt, makeConfig(), makeOutboxHelper());
    const service2 = new CustomerAuthService(makePrisma('cust_1'), jwt, makeConfig(), makeOutboxHelper());

    const result1 = await service1.register(REGISTER_DTO, STORE_ID);
    const result2 = await service2.register(REGISTER_DTO, STORE_ID);

    expect(sha256(result1.refreshToken)).not.toBe(sha256(result2.refreshToken));
  });

  it('each refresh token carries a distinct jti claim', async () => {
    const service1 = new CustomerAuthService(makePrisma('cust_1'), jwt, makeConfig(), makeOutboxHelper());
    const service2 = new CustomerAuthService(makePrisma('cust_1'), jwt, makeConfig(), makeOutboxHelper());

    const result1 = await service1.register(REGISTER_DTO, STORE_ID);
    const result2 = await service2.register(REGISTER_DTO, STORE_ID);

    const jti1 = (jwt.decode(result1.refreshToken) as any)?.jti;
    const jti2 = (jwt.decode(result2.refreshToken) as any)?.jti;

    expect(jti1).toEqual(expect.any(String));
    expect(jti2).toEqual(expect.any(String));
    expect(jti1).not.toBe(jti2);
  });

  it('does not add a jti to the access token, and access tokens for the same payload/second stay identical (unchanged behavior)', async () => {
    const service1 = new CustomerAuthService(makePrisma('cust_1'), jwt, makeConfig(), makeOutboxHelper());
    const service2 = new CustomerAuthService(makePrisma('cust_1'), jwt, makeConfig(), makeOutboxHelper());

    const result1 = await service1.register(REGISTER_DTO, STORE_ID);
    const result2 = await service2.register(REGISTER_DTO, STORE_ID);

    expect((jwt.decode(result1.accessToken) as any)?.jti).toBeUndefined();
    expect((jwt.decode(result2.accessToken) as any)?.jti).toBeUndefined();
    // Access tokens were never part of the bug and are untouched by the fix —
    // same payload + same frozen `iat` second still signs identically.
    expect(result1.accessToken).toBe(result2.accessToken);
  });

  it('refresh rotation still works end-to-end with a jti-bearing token', async () => {
    const registerPrisma = makePrisma('cust_1');
    const registerService = new CustomerAuthService(registerPrisma, jwt, makeConfig(), makeOutboxHelper());
    const { refreshToken } = await registerService.register(REGISTER_DTO, STORE_ID);

    const refreshPrisma = makePrisma('cust_1');
    refreshPrisma.customerRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    refreshPrisma.customerRefreshToken.findUnique.mockResolvedValue({
      customerId: 'cust_1', expiresAt: new Date(Date.now() + 60_000),
    });
    refreshPrisma.customer.findUnique.mockResolvedValue({
      id: 'cust_1', storeId: STORE_ID, email: 'priya@example.com', isActive: true,
    });
    const refreshService = new CustomerAuthService(refreshPrisma, jwt, makeConfig(), makeOutboxHelper());

    const rotated = await refreshService.refresh(refreshToken, STORE_ID);

    expect(rotated.accessToken).toEqual(expect.any(String));
    expect(rotated.refreshToken).toEqual(expect.any(String));
    expect(refreshPrisma.customerRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(refreshPrisma.customerRefreshToken.create).toHaveBeenCalledWith({
      data: { customerId: 'cust_1', tokenHash: sha256(rotated.refreshToken), expiresAt: expect.any(Date) },
    });
  });
});
