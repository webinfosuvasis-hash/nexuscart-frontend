import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Prisma, CustomerTokenPurpose } from '@prisma/client';
import { CustomerAuthService } from './customer-auth.service';

const STORE_ID = 'store_1';
const RAW_TOKEN = 'raw.verification.or.reset.token';
const TOKEN_HASH = createHash('sha256').update(RAW_TOKEN).digest('hex');

function makeJwt() {
  return { signAsync: jest.fn(), verifyAsync: jest.fn() } as any;
}

function makeConfig(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    CUSTOMER_PASSWORD_RESET_EXPIRES_MINUTES: '30',
    CUSTOMER_EMAIL_VERIFICATION_EXPIRES_HOURS: '48',
    ...overrides,
  };
  return { get: jest.fn((key: string) => defaults[key]) } as any;
}

function makeTxClient(overrides: Record<string, any> = {}) {
  return {
    customerVerificationToken: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    customerCredential: {
      update: jest.fn().mockResolvedValue({}),
    },
    customerRefreshToken: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    ...overrides,
  };
}

function makePrisma(txClient = makeTxClient()) {
  return {
    $transaction: jest.fn().mockImplementation(async (cb: any) => cb(txClient)),
    customer: { findFirst: jest.fn() },
    customerVerificationToken: {
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  } as any;
}

function makeOutboxHelper() {
  return { upsertOutboxEvent: jest.fn().mockResolvedValue(undefined) } as any;
}

describe('CustomerAuthService — forgotPassword', () => {
  it('always resolves for an unknown email, without creating any token', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue(null);
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.forgotPassword('nobody@example.com', STORE_ID)).resolves.toBeUndefined();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('always resolves for a Customer with no credential (never registered)', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue({ id: 'cust_1', credential: null });
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.forgotPassword('priya@example.com', STORE_ID)).resolves.toBeUndefined();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('normalizes email before lookup', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue(null);
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await service.forgotPassword('Priya@Example.COM ', STORE_ID);

    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { storeId: STORE_ID, email: 'priya@example.com' },
      include: { credential: true },
    });
  });

  it('invalidates previous active reset tokens and creates a new one, atomically', async () => {
    const tx = makeTxClient();
    const prisma = makePrisma(tx);
    prisma.customer.findFirst.mockResolvedValue({ id: 'cust_1', credential: { id: 'cred_1' } });
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await service.forgotPassword('priya@example.com', STORE_ID);

    expect(tx.customerVerificationToken.updateMany).toHaveBeenCalledWith({
      where: { customerId: 'cust_1', purpose: CustomerTokenPurpose.PASSWORD_RESET, consumedAt: null },
      data: { consumedAt: expect.any(Date) },
    });
    expect(tx.customerVerificationToken.create).toHaveBeenCalledWith({
      data: {
        customerId: 'cust_1',
        purpose: CustomerTokenPurpose.PASSWORD_RESET,
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('emits CUSTOMER_PASSWORD_RESET_REQUESTED inside the same transaction, via OutboxHelperService', async () => {
    const tx = makeTxClient();
    const prisma = makePrisma(tx);
    prisma.customer.findFirst.mockResolvedValue({ id: 'cust_1', credential: { id: 'cred_1' } });
    const outbox = makeOutboxHelper();
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), outbox);

    await service.forgotPassword('priya@example.com', STORE_ID);

    expect(outbox.upsertOutboxEvent).toHaveBeenCalledTimes(1);
    expect(outbox.upsertOutboxEvent).toHaveBeenCalledWith(
      tx, STORE_ID,
      expect.objectContaining({
        eventType: 'CUSTOMER_PASSWORD_RESET_REQUESTED',
        aggregateId: 'cust_1',
        aggregateType: 'Customer',
        payload: expect.objectContaining({
          storeId: STORE_ID, customerId: 'cust_1', email: 'priya@example.com', resetToken: expect.any(String),
        }),
      }),
      { skipDedup: true },
    );
  });

  it('does not emit any event when the email is unknown (no customer/credential match)', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue(null);
    const outbox = makeOutboxHelper();
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), outbox);

    await service.forgotPassword('nobody@example.com', STORE_ID);

    expect(outbox.upsertOutboxEvent).not.toHaveBeenCalled();
  });

  it('stores only the SHA-256 hash of the generated token, never the raw value', async () => {
    const tx = makeTxClient();
    const prisma = makePrisma(tx);
    prisma.customer.findFirst.mockResolvedValue({ id: 'cust_1', credential: { id: 'cred_1' } });
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await service.forgotPassword('priya@example.com', STORE_ID);

    const { tokenHash } = tx.customerVerificationToken.create.mock.calls[0][0].data;
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('sets expiry from CUSTOMER_PASSWORD_RESET_EXPIRES_MINUTES', async () => {
    const tx = makeTxClient();
    const prisma = makePrisma(tx);
    prisma.customer.findFirst.mockResolvedValue({ id: 'cust_1', credential: { id: 'cred_1' } });
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig({ CUSTOMER_PASSWORD_RESET_EXPIRES_MINUTES: '45' }), makeOutboxHelper());

    const before = Date.now();
    await service.forgotPassword('priya@example.com', STORE_ID);

    const { expiresAt } = tx.customerVerificationToken.create.mock.calls[0][0].data;
    expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(45 * 60_000 - 2000);
    expect(expiresAt.getTime() - before).toBeLessThanOrEqual(45 * 60_000 + 2000);
  });
});

describe('CustomerAuthService — resetPassword', () => {
  function makeClaimedToken(overrides: Record<string, any> = {}) {
    return {
      id: 'vtok_1',
      customerId: 'cust_1',
      purpose: CustomerTokenPurpose.PASSWORD_RESET,
      tokenHash: TOKEN_HASH,
      consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      ...overrides,
    };
  }

  it('atomically claims the token (tokenHash + purpose + consumedAt IS NULL + expiresAt > now), then hashes the new password and revokes every session', async () => {
    const tx = makeTxClient();
    const prisma = makePrisma(tx);
    prisma.customerVerificationToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.customerVerificationToken.findUnique.mockResolvedValue(makeClaimedToken());
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await service.resetPassword(RAW_TOKEN, 'NewPass123!');

    expect(prisma.customerVerificationToken.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: TOKEN_HASH,
        purpose: CustomerTokenPurpose.PASSWORD_RESET,
        consumedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { consumedAt: expect.any(Date) },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const credentialUpdate = tx.customerCredential.update.mock.calls[0][0];
    expect(credentialUpdate.where).toEqual({ customerId: 'cust_1' });
    expect(await bcrypt.compare('NewPass123!', credentialUpdate.data.passwordHash)).toBe(true);
    // consumedAt is no longer set a second time inside the transaction — the
    // atomic claim already set it before the transaction ever opens.
    expect(tx.customerVerificationToken.update).not.toHaveBeenCalled();
    expect(tx.customerRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { customerId: 'cust_1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects an unknown token generically, without opening a transaction', async () => {
    const prisma = makePrisma();
    prisma.customerVerificationToken.updateMany.mockResolvedValue({ count: 0 });
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.resetPassword(RAW_TOKEN, 'NewPass123!'))
      .rejects.toThrow('This link is invalid or has expired');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a token of the wrong purpose (e.g. an email-verification token) — the claim query itself excludes it', async () => {
    // The WHERE clause filters by purpose, so a mismatched-purpose token
    // simply never matches — count stays 0.
    const prisma = makePrisma();
    prisma.customerVerificationToken.updateMany.mockResolvedValue({ count: 0 });
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.resetPassword(RAW_TOKEN, 'NewPass123!'))
      .rejects.toThrow('This link is invalid or has expired');
  });

  it('rejects an already-used token — the claim query excludes consumedAt rows', async () => {
    const prisma = makePrisma();
    prisma.customerVerificationToken.updateMany.mockResolvedValue({ count: 0 });
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.resetPassword(RAW_TOKEN, 'NewPass123!'))
      .rejects.toThrow('This link is invalid or has expired');
  });

  it('rejects an expired token — the claim query excludes expiresAt <= now', async () => {
    const prisma = makePrisma();
    prisma.customerVerificationToken.updateMany.mockResolvedValue({ count: 0 });
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.resetPassword(RAW_TOKEN, 'NewPass123!'))
      .rejects.toThrow('This link is invalid or has expired');
  });

  it('translates a dangling token (customer/credential no longer exists) into the same generic message', async () => {
    const tx = makeTxClient();
    tx.customerCredential.update.mockImplementation(() => {
      throw new Prisma.PrismaClientKnownRequestError('Record to update not found', {
        code: 'P2025', clientVersion: '5.22.0',
      });
    });
    const prisma = makePrisma(tx);
    prisma.customerVerificationToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.customerVerificationToken.findUnique.mockResolvedValue(makeClaimedToken());
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.resetPassword(RAW_TOKEN, 'NewPass123!'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  // ── P1 regression: concurrent resetPassword() with the same token ────────
  it('under concurrent resetPassword calls with the same token, exactly one succeeds and the other fails, with only one password/consumption applying', async () => {
    const tx = makeTxClient();
    const prisma = makePrisma(tx);
    // First caller wins the atomic claim; second caller's identical call
    // sees 0 rows matched, mirroring refresh()'s concurrency test.
    prisma.customerVerificationToken.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prisma.customerVerificationToken.findUnique.mockResolvedValue(makeClaimedToken());
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    const [first, second] = await Promise.allSettled([
      service.resetPassword(RAW_TOKEN, 'FirstPass123!'),
      service.resetPassword(RAW_TOKEN, 'SecondPass123!'),
    ]);

    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('rejected');

    // Exactly one password-hash update was ever attempted.
    expect(tx.customerCredential.update).toHaveBeenCalledTimes(1);
    const appliedPasswordHash = tx.customerCredential.update.mock.calls[0][0].data.passwordHash;
    expect(await bcrypt.compare('FirstPass123!', appliedPasswordHash)).toBe(true);
    expect(await bcrypt.compare('SecondPass123!', appliedPasswordHash)).toBe(false);

    // Only one claim (consumedAt-setting) query ever matched a row.
    expect(prisma.customerVerificationToken.updateMany).toHaveBeenCalledTimes(2);
  });
});

describe('CustomerAuthService — verifyEmail', () => {
  function makeStoredToken(overrides: Record<string, any> = {}) {
    return {
      id: 'vtok_1',
      customerId: 'cust_1',
      purpose: CustomerTokenPurpose.EMAIL_VERIFICATION,
      tokenHash: TOKEN_HASH,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      customer: { credential: { isEmailVerified: false } },
      ...overrides,
    };
  }

  it('marks the customer verified and the token used — atomically', async () => {
    const tx = makeTxClient();
    const prisma = makePrisma(tx);
    prisma.customerVerificationToken.findUnique.mockResolvedValue(makeStoredToken());
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await service.verifyEmail(RAW_TOKEN);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.customerCredential.update).toHaveBeenCalledWith({
      where: { customerId: 'cust_1' },
      data: { isEmailVerified: true, emailVerifiedAt: expect.any(Date) },
    });
    expect(tx.customerVerificationToken.update).toHaveBeenCalledWith({
      where: { id: 'vtok_1' },
      data: { consumedAt: expect.any(Date) },
    });
  });

  it('rejects an unknown token generically', async () => {
    const prisma = makePrisma();
    prisma.customerVerificationToken.findUnique.mockResolvedValue(null);
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.verifyEmail(RAW_TOKEN)).rejects.toThrow('This link is invalid or has expired');
  });

  it('rejects a token of the wrong purpose (e.g. a password-reset token)', async () => {
    const prisma = makePrisma();
    prisma.customerVerificationToken.findUnique.mockResolvedValue(
      makeStoredToken({ purpose: CustomerTokenPurpose.PASSWORD_RESET }),
    );
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.verifyEmail(RAW_TOKEN)).rejects.toThrow('This link is invalid or has expired');
  });

  it('rejects an expired, not-yet-verified token', async () => {
    const prisma = makePrisma();
    prisma.customerVerificationToken.findUnique.mockResolvedValue(
      makeStoredToken({ expiresAt: new Date(Date.now() - 1000) }),
    );
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.verifyEmail(RAW_TOKEN)).rejects.toThrow('This link is invalid or has expired');
  });

  it('rejects a used, not-yet-verified token', async () => {
    const prisma = makePrisma();
    prisma.customerVerificationToken.findUnique.mockResolvedValue(
      makeStoredToken({ consumedAt: new Date() }),
    );
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.verifyEmail(RAW_TOKEN)).rejects.toThrow('This link is invalid or has expired');
  });

  it('is idempotent: an already-verified customer short-circuits to success even with a used/expired token', async () => {
    const tx = makeTxClient();
    const prisma = makePrisma(tx);
    prisma.customerVerificationToken.findUnique.mockResolvedValue(
      makeStoredToken({
        consumedAt: new Date(),
        expiresAt: new Date(Date.now() - 1000),
        customer: { credential: { isEmailVerified: true } },
      }),
    );
    const service = new CustomerAuthService(prisma, makeJwt(), makeConfig(), makeOutboxHelper());

    await expect(service.verifyEmail(RAW_TOKEN)).resolves.toBeUndefined();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
