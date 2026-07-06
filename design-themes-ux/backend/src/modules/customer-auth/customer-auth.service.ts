import {
  Injectable, ConflictException, UnauthorizedException, BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  createHash, randomBytes, randomUUID,
} from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Prisma, CustomerTokenPurpose } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { OutboxHelperService } from '@/shared/outbox/outbox-helper.service';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginCustomerDto } from './dto/login-customer.dto';
import { CustomerJwtPayload, CustomerTokenPair } from './types/customer-auth.types';

const BCRYPT_COST = 12;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// Identical text on every credential-probing failure (unknown email, wrong
// password, inactive account) so none of them can be distinguished from one
// another by an attacker — matches the merchant AuthService's convention.
const GENERIC_LOGIN_ERROR = 'Invalid email or password';
// Distinct from GENERIC_LOGIN_ERROR only for the already-locked-out case —
// still doesn't confirm the email exists, since it's shown identically
// whether or not the account is real (the DB is never queried again once
// locked, so a bad email would already have hit GENERIC_LOGIN_ERROR above).
const LOCKOUT_ERROR = 'Too many attempts. Try again later.';
const INVALID_REFRESH_ERROR = 'Invalid or expired refresh token';
// Never distinguishes "wrong token" / "already used" / "expired" / "unknown" —
// any of those would give an attacker a probing signal.
const INVALID_TOKEN_ERROR = 'This link is invalid or has expired';

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly outbox: OutboxHelperService,
  ) {}

  /**
   * Registers a new customer for the given store. Reuses an existing
   * CRM-only Customer row (created via admin import, or as an order's
   * contact) when one exists for this email but has never registered;
   * rejects if a credential already exists (already registered).
   */
  async register(dto: RegisterCustomerDto, storeId: string): Promise<CustomerTokenPair> {
    const email = this.normalizeEmail(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const verificationRawToken = this.generateSecureToken();
    const verificationTokenHash = this.hashToken(verificationRawToken);
    const verificationExpiresAt = new Date(
      Date.now() + this.getEmailVerificationExpiresHours() * 60 * 60_000,
    );

    let customer: { id: string; email: string };
    try {
      customer = await this.prisma.$transaction(async (tx) => {
        let customerRow = await tx.customer.findFirst({ where: { storeId, email } });

        if (customerRow) {
          const existingCredential = await tx.customerCredential.findUnique({
            where: { customerId: customerRow.id },
          });
          if (existingCredential) {
            throw new ConflictException('An account with this email already exists');
          }
        } else {
          customerRow = await tx.customer.create({
            data: {
              storeId, email, name: dto.name, phone: dto.phone,
            },
          });
        }

        await tx.customerCredential.create({
          data: { customerId: customerRow.id, passwordHash },
        });

        // Bootstraps the token verifyEmail() will later consume.
        await tx.customerVerificationToken.create({
          data: {
            customerId: customerRow.id,
            purpose: CustomerTokenPurpose.EMAIL_VERIFICATION,
            tokenHash: verificationTokenHash,
            expiresAt: verificationExpiresAt,
          },
        });

        // Written inside the same transaction as the state it describes —
        // per OutboxHelperService's documented contract — so the event can
        // never exist without the customer it refers to, or vice versa.
        // CustomerAuthNotificationService (IM-7) picks these up once
        // OutboxProcessorService dispatches them.
        await this.outbox.upsertOutboxEvent(tx, storeId, {
          eventType: 'CUSTOMER_REGISTERED',
          aggregateId: customerRow.id,
          aggregateType: 'Customer',
          payload: {
            storeId, customerId: customerRow.id, email, name: dto.name,
          },
        });

        await this.outbox.upsertOutboxEvent(tx, storeId, {
          eventType: 'CUSTOMER_EMAIL_VERIFICATION_REQUESTED',
          aggregateId: customerRow.id,
          aggregateType: 'Customer',
          payload: {
            storeId, customerId: customerRow.id, email, verificationToken: verificationRawToken,
          },
          // Repeatable: a future resend-verification call re-fires this same
          // event type for the same customer and must not be deduped away.
        }, { skipDedup: true });

        return customerRow;
      });
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Concurrent registration race lost at the DB unique-constraint level
        // (Customer(storeId,email) or CustomerCredential(customerId)).
        throw new ConflictException('An account with this email already exists');
      }
      throw err;
    }

    return this.issueTokenPair(customer.id, storeId, customer.email);
  }

  async login(dto: LoginCustomerDto, storeId: string): Promise<CustomerTokenPair> {
    const email = this.normalizeEmail(dto.email);

    const customer = await this.prisma.customer.findFirst({
      where: { storeId, email },
      include: { credential: true },
    });

    if (!customer || !customer.credential) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const { credential } = customer;

    if (credential.lockedUntil && credential.lockedUntil > new Date()) {
      throw new UnauthorizedException(LOCKOUT_ERROR);
    }

    if (!customer.isActive) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    // bcrypt.compare is constant-time with respect to the candidate password
    // (it always hashes the candidate and diffs the full digest), so this
    // does not leak information via timing the way a naive string compare would.
    const passwordValid = await bcrypt.compare(dto.password, credential.passwordHash);

    if (!passwordValid) {
      await this.recordFailedLogin(credential.id);
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    await this.prisma.customerCredential.update({
      where: { id: credential.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    return this.issueTokenPair(customer.id, storeId, customer.email);
  }

  /**
   * Rotates a refresh token: the presented raw token is atomically consumed
   * (revoked) via a conditional UPDATE — `WHERE tokenHash = ? AND revokedAt
   * IS NULL` — so under concurrent calls with the *same* token, only the one
   * that actually flips revokedAt wins (`count === 1`); every other
   * concurrent or later call sees `count === 0` and is treated as reuse.
   */
  async refresh(rawRefreshToken: string, storeId: string): Promise<CustomerTokenPair> {
    let payload: CustomerJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<CustomerJwtPayload>(rawRefreshToken, {
        secret: this.config.get<string>('CUSTOMER_JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(INVALID_REFRESH_ERROR);
    }

    if (payload.type !== 'customer' || payload.storeId !== storeId) {
      throw new UnauthorizedException(INVALID_REFRESH_ERROR);
    }

    const tokenHash = this.hashToken(rawRefreshToken);

    const claim = await this.prisma.customerRefreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (claim.count === 0) {
      // Never existed, already rotated/revoked, or lost the race to another
      // concurrent refresh with the same token — in every case, treat as
      // potential token-reuse and kill every session for this customer.
      await this.revokeAllForCustomer(payload.sub);
      throw new UnauthorizedException(INVALID_REFRESH_ERROR);
    }

    const claimedRow = await this.prisma.customerRefreshToken.findUnique({ where: { tokenHash } });

    if (!claimedRow || claimedRow.customerId !== payload.sub) {
      await this.revokeAllForCustomer(payload.sub);
      throw new UnauthorizedException(INVALID_REFRESH_ERROR);
    }

    if (claimedRow.expiresAt < new Date()) {
      throw new UnauthorizedException(INVALID_REFRESH_ERROR);
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, storeId: true, email: true, isActive: true,
      },
    });

    if (!customer || !customer.isActive || customer.storeId !== payload.storeId) {
      throw new UnauthorizedException(INVALID_REFRESH_ERROR);
    }

    return this.issueTokenPair(customer.id, customer.storeId, customer.email);
  }

  /**
   * Revokes exactly one session — the one the caller is currently holding.
   * Scoped by `customerId` (from the caller's own access token) as well as
   * `tokenHash`, so a customer can never revoke another customer's session
   * even if they somehow obtained the raw token string. Idempotent: revoking
   * an already-revoked (or nonexistent) token matches zero rows and simply
   * no-ops rather than throwing.
   */
  async logout(customerId: string, rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.prisma.customerRefreshToken.updateMany({
      where: { tokenHash, customerId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revokes every active session for the customer. The Customer/CustomerCredential rows are untouched — this only ends sessions, never the account. */
  async logoutAll(customerId: string): Promise<void> {
    await this.revokeAllForCustomer(customerId);
  }

  /**
   * Always resolves — never reveals whether the email exists. When it does,
   * invalidates any previously issued, still-active reset link (at most one
   * valid reset token per customer at a time) and issues a fresh one, all in
   * one transaction.
   */
  async forgotPassword(email: string, storeId: string): Promise<void> {
    const normalizedEmail = this.normalizeEmail(email);

    const customer = await this.prisma.customer.findFirst({
      where: { storeId, email: normalizedEmail },
      include: { credential: true },
    });

    if (!customer || !customer.credential) {
      return;
    }

    const rawToken = this.generateSecureToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.getPasswordResetExpiresMinutes() * 60_000);

    await this.prisma.$transaction(async (tx) => {
      await tx.customerVerificationToken.updateMany({
        where: {
          customerId: customer.id,
          purpose: CustomerTokenPurpose.PASSWORD_RESET,
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });

      await tx.customerVerificationToken.create({
        data: {
          customerId: customer.id,
          purpose: CustomerTokenPurpose.PASSWORD_RESET,
          tokenHash,
          expiresAt,
        },
      });

      // Written inside the same transaction as the token it describes.
      // CustomerAuthNotificationService (IM-7) picks this up once
      // OutboxProcessorService dispatches it.
      await this.outbox.upsertOutboxEvent(tx, storeId, {
        eventType: 'CUSTOMER_PASSWORD_RESET_REQUESTED',
        aggregateId: customer.id,
        aggregateType: 'Customer',
        payload: {
          storeId, customerId: customer.id, email: normalizedEmail, resetToken: rawToken,
        },
        // Repeatable: a customer may legitimately request this more than once.
      }, { skipDedup: true });
    });

    // rawToken deliberately never leaves this stack frame otherwise — it is
    // never logged, returned, or persisted in the clear; only its hash is
    // stored, and the raw value only travels onward inside the outbox
    // event's payload for the (deferred) email dispatch to use.
  }

  /**
   * Consumes a password-reset token, then hashes the new password and
   * revokes every active session for the customer.
   *
   * The token itself is claimed via the same atomic-compare-and-swap pattern
   * as refresh() — `updateMany({ where: { tokenHash, purpose, consumedAt:
   * null, expiresAt: { gt: now } }, data: { consumedAt: now } })` — so under
   * two concurrent calls with the *same* token, only the one that actually
   * flips `consumedAt` wins (`count === 1`); the other sees `count === 0`
   * and is rejected before ever touching the password. This closes the
   * read-then-consume TOCTOU window the previous implementation had.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);

    const claim = await this.prisma.customerVerificationToken.updateMany({
      where: {
        tokenHash,
        purpose: CustomerTokenPurpose.PASSWORD_RESET,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });

    if (claim.count === 0) {
      throw new BadRequestException(INVALID_TOKEN_ERROR);
    }

    const claimedToken = await this.prisma.customerVerificationToken.findUnique({ where: { tokenHash } });

    if (!claimedToken) {
      // Unreachable in practice (we just claimed this row), kept defensive.
      throw new BadRequestException(INVALID_TOKEN_ERROR);
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.customerCredential.update({
          where: { customerId: claimedToken.customerId },
          data: { passwordHash },
        });

        await this.revokeAllForCustomer(claimedToken.customerId, tx);
      });
    } catch (err) {
      // A dangling token whose Customer/CustomerCredential no longer exists
      // (e.g. account deleted after the reset link was issued) is treated
      // identically to any other invalid token — never a raw 500.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new BadRequestException(INVALID_TOKEN_ERROR);
      }
      throw err;
    }
  }

  /**
   * Consumes an email-verification token. Idempotent: if the customer is
   * already verified, this resolves silently regardless of the token's own
   * state — the desired end state is already true, so a stale or re-clicked
   * link is not an error.
   */
  async verifyEmail(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);

    const verificationToken = await this.prisma.customerVerificationToken.findUnique({
      where: { tokenHash },
      include: { customer: { include: { credential: true } } },
    });

    if (!verificationToken || verificationToken.purpose !== CustomerTokenPurpose.EMAIL_VERIFICATION) {
      throw new BadRequestException(INVALID_TOKEN_ERROR);
    }

    if (verificationToken.customer.credential?.isEmailVerified) {
      return;
    }

    if (verificationToken.consumedAt || verificationToken.expiresAt < new Date()) {
      throw new BadRequestException(INVALID_TOKEN_ERROR);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.customerCredential.update({
        where: { customerId: verificationToken.customerId },
        data: { isEmailVerified: true, emailVerifiedAt: new Date() },
      });

      await tx.customerVerificationToken.update({
        where: { id: verificationToken.id },
        data: { consumedAt: new Date() },
      });
    });
  }

  private async revokeAllForCustomer(
    customerId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    await client.customerRefreshToken.updateMany({
      where: { customerId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async recordFailedLogin(credentialId: string): Promise<void> {
    const updated = await this.prisma.customerCredential.update({
      where: { id: credentialId },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });

    if (updated.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      await this.prisma.customerCredential.update({
        where: { id: credentialId },
        data: { lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000) },
      });
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** 32 random bytes, hex-encoded (64 chars) — the raw token emailed to the customer; only its hash is ever persisted. */
  private generateSecureToken(): string {
    return randomBytes(32).toString('hex');
  }

  private getPasswordResetExpiresMinutes(): number {
    return parseInt(this.config.get<string>('CUSTOMER_PASSWORD_RESET_EXPIRES_MINUTES') ?? '30', 10);
  }

  private getEmailVerificationExpiresHours(): number {
    return parseInt(this.config.get<string>('CUSTOMER_EMAIL_VERIFICATION_EXPIRES_HOURS') ?? '48', 10);
  }

  /** Signs a fresh access+refresh pair and persists the refresh token's hash (never the raw value). */
  private async issueTokenPair(customerId: string, storeId: string, email: string): Promise<CustomerTokenPair> {
    const payload: CustomerJwtPayload = {
      sub: customerId, storeId, email, type: 'customer',
    };
    // P1 fix — refresh-only payload adds a random `jti` so the signed JWT
    // (and therefore its SHA-256 hash) is unique even when issued for the
    // same customer within the same `iat` second. The access token payload
    // is untouched — access tokens are never persisted/hashed, so they were
    // never part of this bug.
    const refreshPayload: CustomerJwtPayload = { ...payload, jti: randomUUID() };
    const refreshDays = parseInt(this.config.get<string>('CUSTOMER_JWT_REFRESH_EXPIRES_DAYS') ?? '30', 10);

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('CUSTOMER_JWT_SECRET'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expiresIn: (this.config.get<string>('CUSTOMER_JWT_EXPIRES_IN') ?? '15m') as any,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.get<string>('CUSTOMER_JWT_REFRESH_SECRET'),
        expiresIn: `${refreshDays}d`,
      }),
    ]);

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);

    await this.prisma.customerRefreshToken.create({ data: { customerId, tokenHash, expiresAt } });

    return { accessToken, refreshToken };
  }
}
