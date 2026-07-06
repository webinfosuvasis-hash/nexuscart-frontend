import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerJwtPayload } from './types/customer-auth.types';

const STORE_ID = 'store_1';
const RAW_REFRESH_TOKEN = 'raw.refresh.token.value';
const TOKEN_HASH = createHash('sha256').update(RAW_REFRESH_TOKEN).digest('hex');

function makePayload(overrides: Partial<CustomerJwtPayload> = {}): CustomerJwtPayload {
  return {
    sub: 'cust_1', storeId: STORE_ID, email: 'priya@example.com', type: 'customer', ...overrides,
  };
}

function makeJwt(verifyResult: any = makePayload()) {
  return {
    verifyAsync: jest.fn().mockImplementation(() => {
      if (verifyResult instanceof Error) return Promise.reject(verifyResult);
      return Promise.resolve(verifyResult);
    }),
    signAsync: jest.fn((_payload: any, options: any) => {
      if (options.secret === 'refresh-secret') return Promise.resolve('new.refresh.token');
      return Promise.resolve('new.access.token');
    }),
  } as any;
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

function makePrisma() {
  return {
    customer: { findUnique: jest.fn() },
    customerRefreshToken: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
    },
  } as any;
}

const ACTIVE_CUSTOMER = {
  id: 'cust_1', storeId: STORE_ID, email: 'priya@example.com', isActive: true,
};

function makeOutboxHelper() {
  return { upsertOutboxEvent: jest.fn().mockResolvedValue(undefined) } as any;
}

describe('CustomerAuthService — refresh', () => {
  it('rotates successfully: claims the old token, issues a new pair, persists the new hash', async () => {
    const prisma = makePrisma();
    prisma.customerRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.customerRefreshToken.findUnique.mockResolvedValue({
      customerId: 'cust_1', expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.customer.findUnique.mockResolvedValue(ACTIVE_CUSTOMER);
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    const result = await service.refresh(RAW_REFRESH_TOKEN, STORE_ID);

    expect(result).toEqual({ accessToken: 'new.access.token', refreshToken: 'new.refresh.token' });
    expect(prisma.customerRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: TOKEN_HASH, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.customerRefreshToken.create).toHaveBeenCalledWith({
      data: { customerId: 'cust_1', tokenHash: createHash('sha256').update('new.refresh.token').digest('hex'), expiresAt: expect.any(Date) },
    });
  });

  it('rejects a token that fails JWT verification (bad signature or expired), touching no DB state', async () => {
    const prisma = makePrisma();
    const service = new CustomerAuthService(prisma, makeJwt(new Error('jwt malformed')), makeConfig(), makeOutboxHelper());

    await expect(service.refresh(RAW_REFRESH_TOKEN, STORE_ID)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.customerRefreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a payload missing type: customer, without touching the DB', async () => {
    const prisma = makePrisma();
    const jwt = makeJwt(makePayload({ type: undefined as unknown as 'customer' }));
    const service = new CustomerAuthService(prisma, jwt, makeConfig(), makeOutboxHelper());

    await expect(service.refresh(RAW_REFRESH_TOKEN, STORE_ID)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.customerRefreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a token whose payload.storeId does not match the requesting store, without touching the DB', async () => {
    const prisma = makePrisma();
    const jwt = makeJwt(makePayload({ storeId: 'store_2' }));
    const service = new CustomerAuthService(prisma, jwt, makeConfig(), makeOutboxHelper());

    await expect(service.refresh(RAW_REFRESH_TOKEN, STORE_ID)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.customerRefreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('treats an already-claimed token (count === 0) as reuse and revokes every session for the customer', async () => {
    const prisma = makePrisma();
    prisma.customerRefreshToken.updateMany.mockResolvedValue({ count: 0 });
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.refresh(RAW_REFRESH_TOKEN, STORE_ID)).rejects.toBeInstanceOf(UnauthorizedException);

    // Once for the failed claim attempt, once for revokeAllForCustomer.
    expect(prisma.customerRefreshToken.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.customerRefreshToken.updateMany).toHaveBeenLastCalledWith({
      where: { customerId: 'cust_1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('under concurrent refresh with the same token, exactly one call succeeds and the other is treated as reuse', async () => {
    const prisma = makePrisma();
    // First caller wins the atomic claim; second caller's identical call sees 0 rows matched.
    prisma.customerRefreshToken.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 }); // the second call's own revokeAllForCustomer
    prisma.customerRefreshToken.findUnique.mockResolvedValue({
      customerId: 'cust_1', expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.customer.findUnique.mockResolvedValue(ACTIVE_CUSTOMER);
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    const [winner, loser] = await Promise.allSettled([
      service.refresh(RAW_REFRESH_TOKEN, STORE_ID),
      service.refresh(RAW_REFRESH_TOKEN, STORE_ID),
    ]);

    expect(winner.status).toBe('fulfilled');
    expect(loser.status).toBe('rejected');
  });

  it('rejects when the claimed row belongs to a different customer than the token claims', async () => {
    const prisma = makePrisma();
    prisma.customerRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.customerRefreshToken.findUnique.mockResolvedValue({
      customerId: 'someone_else', expiresAt: new Date(Date.now() + 60_000),
    });
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.refresh(RAW_REFRESH_TOKEN, STORE_ID)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an expired stored row without treating it as reuse (no revoke-all)', async () => {
    const prisma = makePrisma();
    prisma.customerRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.customerRefreshToken.findUnique.mockResolvedValue({
      customerId: 'cust_1', expiresAt: new Date(Date.now() - 60_000),
    });
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.refresh(RAW_REFRESH_TOKEN, STORE_ID)).rejects.toBeInstanceOf(UnauthorizedException);
    // Only the one claim call — no second revoke-all call.
    expect(prisma.customerRefreshToken.updateMany).toHaveBeenCalledTimes(1);
  });

  it('rejects when the customer no longer exists, is inactive, or has moved stores', async () => {
    const prisma = makePrisma();
    prisma.customerRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.customerRefreshToken.findUnique.mockResolvedValue({
      customerId: 'cust_1', expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.customer.findUnique.mockResolvedValue({ ...ACTIVE_CUSTOMER, isActive: false });
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.refresh(RAW_REFRESH_TOKEN, STORE_ID)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('CustomerAuthService — logout', () => {
  it('revokes only the caller\'s own matching, still-active session', async () => {
    const prisma = makePrisma();
    prisma.customerRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await service.logout('cust_1', RAW_REFRESH_TOKEN);

    expect(prisma.customerRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: TOKEN_HASH, customerId: 'cust_1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('is idempotent — revoking an already-revoked token resolves without throwing', async () => {
    const prisma = makePrisma();
    prisma.customerRefreshToken.updateMany.mockResolvedValue({ count: 0 });
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.logout('cust_1', RAW_REFRESH_TOKEN)).resolves.toBeUndefined();
  });

  it('scopes the revoke by customerId, so it can never revoke another customer\'s session', async () => {
    const prisma = makePrisma();
    prisma.customerRefreshToken.updateMany.mockResolvedValue({ count: 0 });
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await service.logout('cust_attacker', RAW_REFRESH_TOKEN);

    expect(prisma.customerRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: TOKEN_HASH, customerId: 'cust_attacker', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe('CustomerAuthService — logoutAll', () => {
  it('revokes every active session for the customer', async () => {
    const prisma = makePrisma();
    prisma.customerRefreshToken.updateMany.mockResolvedValue({ count: 3 });
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await service.logoutAll('cust_1');

    expect(prisma.customerRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { customerId: 'cust_1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('never touches Customer or CustomerCredential — the account itself stays intact', async () => {
    const prisma = makePrisma();
    prisma.customerRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    const customerUpdate = jest.fn();
    prisma.customer.update = customerUpdate;
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await service.logoutAll('cust_1');

    expect(customerUpdate).not.toHaveBeenCalled();
  });
});
