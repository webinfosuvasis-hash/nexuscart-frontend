import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { CustomerAuthService } from './customer-auth.service';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginCustomerDto } from './dto/login-customer.dto';

const STORE_ID = 'store_1';
const VALID_PASSWORD = 'StrongPass123!';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// Returns a distinct fake token per secret, so tests can tell the access and
// refresh signing calls apart without depending on call order.
function makeJwt(overrides: Partial<Record<'verifyAsync', jest.Mock>> = {}) {
  return {
    signAsync: jest.fn((_payload: any, options: any) => {
      if (options.secret === 'test-customer-refresh-secret') return Promise.resolve('signed.refresh.token');
      return Promise.resolve('signed.access.token');
    }),
    verifyAsync: jest.fn(),
    ...overrides,
  } as any;
}

function makeConfig() {
  return {
    get: jest.fn((key: string) => {
      switch (key) {
        case 'CUSTOMER_JWT_SECRET': return 'test-customer-secret';
        case 'CUSTOMER_JWT_EXPIRES_IN': return '15m';
        case 'CUSTOMER_JWT_REFRESH_SECRET': return 'test-customer-refresh-secret';
        case 'CUSTOMER_JWT_REFRESH_EXPIRES_DAYS': return '30';
        default: return undefined;
      }
    }),
  } as any;
}

function makeTxClient(overrides: Record<string, any> = {}) {
  return {
    customer: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
    customerCredential: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
    customerVerificationToken: {
      create: jest.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

function makePrisma(txClient = makeTxClient()) {
  return {
    $transaction: jest.fn().mockImplementation(async (cb: any) => cb(txClient)),
    customer: { findFirst: jest.fn(), findUnique: jest.fn() },
    customerCredential: { update: jest.fn() },
    customerRefreshToken: {
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
  } as any;
}

function makeOutboxHelper() {
  return { upsertOutboxEvent: jest.fn().mockResolvedValue(undefined) } as any;
}

describe('CustomerAuthService — register', () => {
  const dto: RegisterCustomerDto = {
    name: 'Priya Sharma', email: 'Priya@Example.com ', password: VALID_PASSWORD,
  } as any;

  it('creates a new Customer + CustomerCredential when no row exists yet, and returns an access+refresh token pair', async () => {
    const tx = makeTxClient();
    tx.customer.create.mockResolvedValue({ id: 'cust_1', storeId: STORE_ID, email: 'priya@example.com' });
    const prisma = makePrisma(tx);
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    const result = await service.register(dto, STORE_ID);

    expect(result).toEqual({ accessToken: 'signed.access.token', refreshToken: 'signed.refresh.token' });
    expect(tx.customer.create).toHaveBeenCalledWith({
      data: {
        storeId: STORE_ID, email: 'priya@example.com', name: 'Priya Sharma', phone: undefined,
      },
    });
    expect(tx.customerCredential.create).toHaveBeenCalled();
  });

  it('emits CUSTOMER_REGISTERED and CUSTOMER_EMAIL_VERIFICATION_REQUESTED inside the same transaction, via OutboxHelperService', async () => {
    const tx = makeTxClient();
    tx.customer.create.mockResolvedValue({ id: 'cust_1', storeId: STORE_ID, email: 'priya@example.com' });
    const prisma = makePrisma(tx);
    const outbox = makeOutboxHelper();
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), outbox);

    await service.register(dto, STORE_ID);

    expect(outbox.upsertOutboxEvent).toHaveBeenCalledTimes(2);
    expect(outbox.upsertOutboxEvent).toHaveBeenCalledWith(
      tx, STORE_ID,
      expect.objectContaining({
        eventType: 'CUSTOMER_REGISTERED',
        aggregateId: 'cust_1',
        aggregateType: 'Customer',
        payload: expect.objectContaining({ storeId: STORE_ID, customerId: 'cust_1', email: 'priya@example.com', name: 'Priya Sharma' }),
      }),
    );
    expect(outbox.upsertOutboxEvent).toHaveBeenCalledWith(
      tx, STORE_ID,
      expect.objectContaining({
        eventType: 'CUSTOMER_EMAIL_VERIFICATION_REQUESTED',
        aggregateId: 'cust_1',
        aggregateType: 'Customer',
        payload: expect.objectContaining({ storeId: STORE_ID, customerId: 'cust_1', verificationToken: expect.any(String) }),
      }),
      { skipDedup: true },
    );
  });

  it('persists only the SHA-256 hash of the refresh token, never the raw value', async () => {
    const tx = makeTxClient();
    tx.customer.create.mockResolvedValue({ id: 'cust_1', storeId: STORE_ID, email: 'priya@example.com' });
    const prisma = makePrisma(tx);
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await service.register(dto, STORE_ID);

    expect(prisma.customerRefreshToken.create).toHaveBeenCalledWith({
      data: {
        customerId: 'cust_1',
        tokenHash: sha256('signed.refresh.token'),
        expiresAt: expect.any(Date),
      },
    });
  });

  it('sets the refresh token expiry from CUSTOMER_JWT_REFRESH_EXPIRES_DAYS', async () => {
    const tx = makeTxClient();
    tx.customer.create.mockResolvedValue({ id: 'cust_1', storeId: STORE_ID, email: 'priya@example.com' });
    const prisma = makePrisma(tx);
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    const before = Date.now();
    await service.register(dto, STORE_ID);

    const { expiresAt } = prisma.customerRefreshToken.create.mock.calls[0][0].data;
    const expectedMs = 30 * 24 * 60 * 60 * 1000;
    expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(expectedMs - 5000);
    expect(expiresAt.getTime() - before).toBeLessThanOrEqual(expectedMs + 5000);
  });

  it('normalizes email (trim + lowercase) before every lookup/create', async () => {
    const tx = makeTxClient();
    tx.customer.create.mockResolvedValue({ id: 'cust_1', storeId: STORE_ID, email: 'priya@example.com' });
    const prisma = makePrisma(tx);
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await service.register(dto, STORE_ID);

    expect(tx.customer.findFirst).toHaveBeenCalledWith({
      where: { storeId: STORE_ID, email: 'priya@example.com' },
    });
  });

  it('hashes the password with bcrypt before persisting, never storing it raw', async () => {
    const tx = makeTxClient();
    tx.customer.create.mockResolvedValue({ id: 'cust_1', storeId: STORE_ID, email: 'priya@example.com' });
    const prisma = makePrisma(tx);
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await service.register(dto, STORE_ID);

    const createCall = tx.customerCredential.create.mock.calls[0][0];
    expect(createCall.data.passwordHash).not.toBe(VALID_PASSWORD);
    expect(await bcrypt.compare(VALID_PASSWORD, createCall.data.passwordHash)).toBe(true);
  });

  it('reuses an existing CRM-only Customer row that has no credential yet', async () => {
    const existingCustomer = { id: 'cust_existing', storeId: STORE_ID, email: 'priya@example.com' };
    const tx = makeTxClient();
    tx.customer.findFirst.mockResolvedValue(existingCustomer);
    tx.customerCredential.findUnique.mockResolvedValue(null);
    const prisma = makePrisma(tx);
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    const result = await service.register(dto, STORE_ID);

    expect(tx.customer.create).not.toHaveBeenCalled();
    expect(tx.customerCredential.create).toHaveBeenCalledWith({
      data: { customerId: 'cust_existing', passwordHash: expect.any(String) },
    });
    expect(result).toEqual({ accessToken: 'signed.access.token', refreshToken: 'signed.refresh.token' });
  });

  it('rejects registration when a credential already exists for the matched Customer', async () => {
    const existingCustomer = { id: 'cust_existing', storeId: STORE_ID, email: 'priya@example.com' };
    const tx = makeTxClient();
    tx.customer.findFirst.mockResolvedValue(existingCustomer);
    tx.customerCredential.findUnique.mockResolvedValue({ id: 'cred_1' });
    const prisma = makePrisma(tx);
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.register(dto, STORE_ID)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.customerCredential.create).not.toHaveBeenCalled();
  });

  it('translates a concurrent-registration P2002 unique-constraint race into the same ConflictException', async () => {
    const tx = makeTxClient();
    tx.customer.create.mockImplementation(() => {
      throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002', clientVersion: '5.22.0',
      });
    });
    const prisma = makePrisma(tx);
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.register(dto, STORE_ID)).rejects.toBeInstanceOf(ConflictException);
  });

  it('does the Customer + CustomerCredential writes inside a single $transaction', async () => {
    const tx = makeTxClient();
    tx.customer.create.mockResolvedValue({ id: 'cust_1', storeId: STORE_ID, email: 'priya@example.com' });
    const prisma = makePrisma(tx);
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await service.register(dto, STORE_ID);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('CustomerAuthService — login', () => {
  const dto: LoginCustomerDto = { email: 'Priya@Example.com', password: VALID_PASSWORD };

  async function makeCredential(overrides: Record<string, any> = {}) {
    return {
      id: 'cred_1',
      passwordHash: await bcrypt.hash(VALID_PASSWORD, 12),
      failedLoginAttempts: 0,
      lockedUntil: null,
      ...overrides,
    };
  }

  it('returns an access+refresh token pair on success, and resets the failure counter', async () => {
    const credential = await makeCredential();
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue({
      id: 'cust_1', storeId: STORE_ID, email: 'priya@example.com', isActive: true, credential,
    });
    prisma.customerCredential.update.mockResolvedValue({});
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    const result = await service.login(dto, STORE_ID);

    expect(result).toEqual({ accessToken: 'signed.access.token', refreshToken: 'signed.refresh.token' });
    expect(prisma.customerCredential.update).toHaveBeenCalledWith({
      where: { id: 'cred_1' },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: expect.any(Date) },
    });
    expect(prisma.customerRefreshToken.create).toHaveBeenCalledWith({
      data: { customerId: 'cust_1', tokenHash: sha256('signed.refresh.token'), expiresAt: expect.any(Date) },
    });
  });

  it('normalizes email before lookup', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue(null);
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.login(dto, STORE_ID)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { storeId: STORE_ID, email: 'priya@example.com' },
      include: { credential: true },
    });
  });

  it('rejects an unknown email with the generic message', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue(null);
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.login(dto, STORE_ID)).rejects.toThrow('Invalid email or password');
  });

  it('rejects a Customer with no credential row (never registered) with the identical generic message', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue({ id: 'cust_1', isActive: true, credential: null });
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.login(dto, STORE_ID)).rejects.toThrow('Invalid email or password');
  });

  it('rejects the correct password with the generic message when the account is inactive', async () => {
    const credential = await makeCredential();
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue({
      id: 'cust_1', storeId: STORE_ID, email: 'priya@example.com', isActive: false, credential,
    });
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.login(dto, STORE_ID)).rejects.toThrow('Invalid email or password');
    expect(prisma.customerCredential.update).not.toHaveBeenCalled();
  });

  it('rejects a wrong password, increments failedLoginAttempts, and does not lock before the threshold', async () => {
    const credential = await makeCredential({ failedLoginAttempts: 1 });
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue({
      id: 'cust_1', storeId: STORE_ID, email: 'priya@example.com', isActive: true, credential,
    });
    prisma.customerCredential.update.mockResolvedValueOnce({ failedLoginAttempts: 2 });
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(
      service.login({ ...dto, password: 'WrongPass123!' }, STORE_ID),
    ).rejects.toThrow('Invalid email or password');

    expect(prisma.customerCredential.update).toHaveBeenCalledWith({
      where: { id: 'cred_1' },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    // Only the increment call — no lockedUntil call since threshold (5) not yet reached.
    expect(prisma.customerCredential.update).toHaveBeenCalledTimes(1);
    expect(prisma.customerRefreshToken.create).not.toHaveBeenCalled();
  });

  it('locks the account once failedLoginAttempts reaches the threshold', async () => {
    const credential = await makeCredential({ failedLoginAttempts: 4 });
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue({
      id: 'cust_1', storeId: STORE_ID, email: 'priya@example.com', isActive: true, credential,
    });
    prisma.customerCredential.update.mockResolvedValueOnce({ failedLoginAttempts: 5 });
    prisma.customerCredential.update.mockResolvedValueOnce({});
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(
      service.login({ ...dto, password: 'WrongPass123!' }, STORE_ID),
    ).rejects.toThrow('Invalid email or password');

    expect(prisma.customerCredential.update).toHaveBeenCalledTimes(2);
    expect(prisma.customerCredential.update).toHaveBeenLastCalledWith({
      where: { id: 'cred_1' },
      data: { lockedUntil: expect.any(Date) },
    });
  });

  it('rejects a login attempt while locked, with a distinct throttle message, and never touches the counters again', async () => {
    const credential = await makeCredential({
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() + 10 * 60_000),
    });
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue({
      id: 'cust_1', storeId: STORE_ID, email: 'priya@example.com', isActive: true, credential,
    });
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.login(dto, STORE_ID)).rejects.toThrow('Too many attempts. Try again later.');
    expect(prisma.customerCredential.update).not.toHaveBeenCalled();
  });

  it('allows login again once lockedUntil is in the past', async () => {
    const credential = await makeCredential({
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() - 60_000),
    });
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue({
      id: 'cust_1', storeId: STORE_ID, email: 'priya@example.com', isActive: true, credential,
    });
    prisma.customerCredential.update.mockResolvedValue({});
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.login(dto, STORE_ID)).resolves.toEqual({
      accessToken: 'signed.access.token', refreshToken: 'signed.refresh.token',
    });
  });

  it('never returns passwordHash or any credential internals — only the token pair', async () => {
    const credential = await makeCredential();
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue({
      id: 'cust_1', storeId: STORE_ID, email: 'priya@example.com', isActive: true, credential,
    });
    prisma.customerCredential.update.mockResolvedValue({});
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    const result: any = await service.login(dto, STORE_ID);

    expect(Object.keys(result).sort()).toEqual(['accessToken', 'refreshToken']);
    expect(JSON.stringify(result)).not.toContain(credential.passwordHash);
  });
});
