import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, VendorStatus, VendorTokenPurpose, VendorUserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@/prisma/prisma.service';
import { maskEmail } from '@/shared/email/email.service';
import { VendorAuthMailer } from './vendor-auth-mailer.service';
import { VendorAuthAudit } from './vendor-auth-audit.service';
import {
  AuthenticatedVendor, BCRYPT_COST, LOCKOUT_MINUTES, MAX_FAILED_LOGIN_ATTEMPTS, PASSWORD_RESET_TTL_MINUTES,
  VENDOR_JWT_AUDIENCE, VENDOR_JWT_ISSUER, VendorJwtPayload, newOpaqueToken, sha256,
} from './vendor-auth.types';

export interface VendorSession {
  accessToken:      string;
  expiresIn:        string;
  refreshToken:     string;   // set as an httpOnly cookie by the controller — never put in a response body
  refreshExpiresAt: Date;
  vendor:           VendorProfile;
}

export interface VendorProfile {
  id: string; name: string; email: string;
  vendor: { id: string; name: string };
  store:  { id: string; name: string };
}

const INVALID_CREDENTIALS = 'Invalid email or password';
const LOCKED              = 'Too many attempts. Try again later.';
const INVALID_LINK        = 'This link is invalid or has expired';

// ---------------------------------------------------------------------------
// Vendor self-service authentication (accept invitation, login, refresh,
// logout, forgot / reset / change password, profile).
//
// Every security-relevant transition is a compare-and-swap UPDATE so two
// concurrent requests cannot both consume the same invitation, reset link or
// refresh token. A refresh token presented after it was rotated is treated as
// stolen: all of the account's sessions are revoked.
// ---------------------------------------------------------------------------
@Injectable()
export class VendorAuthService {
  private readonly logger = new Logger(VendorAuthService.name);
  /** Compared against when the email is unknown, so response time does not reveal accounts. */
  private readonly dummyHash = bcrypt.hashSync('timing-equaliser-not-a-password', BCRYPT_COST);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mailer: VendorAuthMailer,
    private readonly audit: VendorAuthAudit,
  ) {}

  // ── Invitation ──────────────────────────────────────────────────────────

  async acceptInvitation(rawToken: string, password: string): Promise<VendorSession> {
    const token = await this.findUsableToken(rawToken, VendorTokenPurpose.INVITATION);
    const user = token?.vendorUser;
    if (!token || !user || user.status !== VendorUserStatus.INVITED || user.vendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException(INVALID_LINK);
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.vendorAuthToken.updateMany({
        where: { id: token.id, consumedAt: null },
        data:  { consumedAt: new Date() },
      });
      const activated = await tx.vendorUser.updateMany({
        where: { id: user.id, status: VendorUserStatus.INVITED },
        data:  {
          status: VendorUserStatus.ACTIVE, passwordHash, failedLoginAttempts: 0, lockedUntil: null,
          tokenVersion: { increment: 1 },
        },
      });
      if (consumed.count !== 1 || activated.count !== 1) throw new BadRequestException(INVALID_LINK);
      // Any other outstanding invitation links for this account are now void.
      await tx.vendorAuthToken.updateMany({
        where: { vendorUserId: user.id, purpose: VendorTokenPurpose.INVITATION, consumedAt: null },
        data:  { consumedAt: new Date() },
      });
    });
    await this.audit.record(user.storeId, 'vendor_user.activated', user.id, { kind: 'vendor' });
    return this.issueSession(user.id);
  }

  // ── Login / refresh / logout ────────────────────────────────────────────

  async login(storeId: string | undefined, email: string, password: string): Promise<VendorSession> {
    if (!storeId) throw new BadRequestException('X-Store-Id header is required');
    const user = await this.prisma.vendorUser.findUnique({
      where:  { storeId_email: { storeId, email: email.trim().toLowerCase() } },
      select: {
        id: true, storeId: true, status: true, passwordHash: true, lockedUntil: true,
        vendor: { select: { status: true } },
      },
    });

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      await bcrypt.compare(password, this.dummyHash);
      throw new UnauthorizedException(LOCKED);
    }
    const valid = await bcrypt.compare(password, user?.passwordHash ?? this.dummyHash);
    if (!user || !user.passwordHash || !valid) {
      if (user) await this.recordFailedLogin(user.id, user.storeId);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    // Status is only revealed to someone who knows the password.
    if (user.status !== VendorUserStatus.ACTIVE || user.vendor.status !== VendorStatus.ACTIVE) {
      throw new UnauthorizedException('This vendor account is not active');
    }

    await this.prisma.vendorUser.update({
      where: { id: user.id },
      data:  { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await this.audit.record(user.storeId, 'vendor_user.login', user.id, { kind: 'vendor' });
    return this.issueSession(user.id);
  }

  async refresh(rawRefreshToken: string | undefined): Promise<VendorSession> {
    if (!rawRefreshToken) throw new UnauthorizedException('No session');
    const row = await this.prisma.vendorRefreshToken.findUnique({
      where:  { tokenHash: sha256(rawRefreshToken) },
      select: {
        id: true, revokedAt: true, expiresAt: true,
        vendorUser: { select: { id: true, storeId: true, status: true, vendor: { select: { status: true } } } },
      },
    });
    if (!row) throw new UnauthorizedException('No session');

    if (row.revokedAt) {
      // Reuse of an already-rotated token: assume theft, end every session.
      await this.revokeAllSessions(row.vendorUser.id);
      await this.audit.record(row.vendorUser.storeId, 'vendor_user.refresh_reuse_detected', row.vendorUser.id, { kind: 'anonymous' });
      this.logger.warn(`Vendor refresh token reuse detected (vendorUser=${row.vendorUser.id}) — all sessions revoked`);
      throw new UnauthorizedException('Session expired');
    }
    if (row.expiresAt <= new Date()) throw new UnauthorizedException('Session expired');

    const claimed = await this.prisma.vendorRefreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data:  { revokedAt: new Date() },
    });
    if (claimed.count !== 1) {
      // Lost a race with another use of the same token — same treatment as reuse.
      await this.revokeAllSessions(row.vendorUser.id);
      throw new UnauthorizedException('Session expired');
    }
    if (row.vendorUser.status !== VendorUserStatus.ACTIVE || row.vendorUser.vendor.status !== VendorStatus.ACTIVE) {
      throw new UnauthorizedException('This vendor account is not active');
    }
    return this.issueSession(row.vendorUser.id);
  }

  /** Idempotent: revokes only the presented session. */
  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    await this.prisma.vendorRefreshToken.updateMany({
      where: { tokenHash: sha256(rawRefreshToken), revokedAt: null },
      data:  { revokedAt: new Date() },
    });
  }

  // ── Passwords ───────────────────────────────────────────────────────────

  /**
   * Always resolves the same way whether or not the account exists. The email
   * is sent without awaiting it, so response time does not reveal accounts either.
   */
  async forgotPassword(storeId: string | undefined, email: string): Promise<void> {
    if (!storeId) throw new BadRequestException('X-Store-Id header is required');
    const user = await this.prisma.vendorUser.findUnique({
      where:  { storeId_email: { storeId, email: email.trim().toLowerCase() } },
      select: {
        id: true, storeId: true, email: true, name: true, status: true,
        vendor: { select: { status: true, store: { select: { name: true } } } },
      },
    });
    if (!user || user.status !== VendorUserStatus.ACTIVE || user.vendor.status !== VendorStatus.ACTIVE) return;

    const raw = await this.issueAuthToken(user.id, VendorTokenPurpose.PASSWORD_RESET, PASSWORD_RESET_TTL_MINUTES * 60_000);
    await this.audit.record(user.storeId, 'vendor_user.password_reset_requested', user.id, { kind: 'anonymous' });
    void this.mailer.sendPasswordReset(user, { storeName: user.vendor.store.name }, raw);
  }

  async resetPassword(rawToken: string, password: string): Promise<void> {
    const token = await this.findUsableToken(rawToken, VendorTokenPurpose.PASSWORD_RESET);
    const user = token?.vendorUser;
    if (!token || !user || user.status !== VendorUserStatus.ACTIVE) throw new BadRequestException(INVALID_LINK);
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.vendorAuthToken.updateMany({
        where: { id: token.id, consumedAt: null },
        data:  { consumedAt: new Date() },
      });
      if (consumed.count !== 1) throw new BadRequestException(INVALID_LINK);
      await tx.vendorAuthToken.updateMany({
        where: { vendorUserId: user.id, purpose: VendorTokenPurpose.PASSWORD_RESET, consumedAt: null },
        data:  { consumedAt: new Date() },
      });
      await tx.vendorUser.update({
        where: { id: user.id },
        data:  { passwordHash, failedLoginAttempts: 0, lockedUntil: null, tokenVersion: { increment: 1 } },
      });
      await tx.vendorRefreshToken.updateMany({
        where: { vendorUserId: user.id, revokedAt: null },
        data:  { revokedAt: new Date() },
      });
    });
    await this.audit.record(user.storeId, 'vendor_user.password_reset', user.id, { kind: 'vendor' });
  }

  /** Signs out every other session and returns a fresh one for this client. */
  async changePassword(principal: AuthenticatedVendor, currentPassword: string, newPassword: string): Promise<VendorSession> {
    const user = await this.prisma.vendorUser.findUnique({
      where: { id: principal.vendorUserId }, select: { passwordHash: true, storeId: true },
    });
    if (!user?.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await this.prisma.$transaction([
      this.prisma.vendorUser.update({
        where: { id: principal.vendorUserId },
        data:  { passwordHash, tokenVersion: { increment: 1 } },
      }),
      this.prisma.vendorRefreshToken.updateMany({
        where: { vendorUserId: principal.vendorUserId, revokedAt: null },
        data:  { revokedAt: new Date() },
      }),
    ]);
    await this.audit.record(user.storeId, 'vendor_user.password_changed', principal.vendorUserId, { kind: 'vendor' });
    return this.issueSession(principal.vendorUserId);
  }

  // ── Profile ─────────────────────────────────────────────────────────────

  async profile(vendorUserId: string): Promise<VendorProfile> {
    const u = await this.prisma.vendorUser.findUniqueOrThrow({
      where:  { id: vendorUserId },
      select: {
        id: true, name: true, email: true,
        vendor: { select: { id: true, name: true, store: { select: { id: true, name: true } } } },
      },
    });
    return {
      id: u.id, name: u.name, email: u.email,
      vendor: { id: u.vendor.id, name: u.vendor.name },
      store:  { id: u.vendor.store.id, name: u.vendor.store.name },
    };
  }

  /** Vendors may change only their display name. */
  async updateProfile(principal: AuthenticatedVendor, name: string): Promise<VendorProfile> {
    await this.prisma.vendorUser.update({ where: { id: principal.vendorUserId }, data: { name } });
    return this.profile(principal.vendorUserId);
  }

  // ── Internals ───────────────────────────────────────────────────────────

  /** Issues an access token + rotating refresh token for an ACTIVE vendor user. */
  async issueSession(vendorUserId: string): Promise<VendorSession> {
    const user = await this.prisma.vendorUser.findUniqueOrThrow({
      where:  { id: vendorUserId },
      select: { id: true, vendorId: true, storeId: true, tokenVersion: true },
    });
    const expiresIn = this.config.get<string>('VENDOR_JWT_EXPIRES_IN', '15m');
    const payload: VendorJwtPayload = { sub: user.id, vid: user.vendorId, sid: user.storeId, tv: user.tokenVersion, typ: 'vendor' };
    const accessToken = await this.jwt.signAsync(payload, {
      secret:    this.config.get<string>('VENDOR_JWT_SECRET'),
      expiresIn: expiresIn as never,
      issuer:    VENDOR_JWT_ISSUER,
      audience:  VENDOR_JWT_AUDIENCE,
      algorithm: 'HS256',
    });
    const refreshToken = newOpaqueToken();
    const days = Number(this.config.get<number>('VENDOR_REFRESH_EXPIRES_DAYS', 7));
    const refreshExpiresAt = new Date(Date.now() + days * 86_400_000);
    await this.prisma.vendorRefreshToken.create({
      data: { vendorUserId: user.id, tokenHash: sha256(refreshToken), expiresAt: refreshExpiresAt },
    });
    return { accessToken, expiresIn, refreshToken, refreshExpiresAt, vendor: await this.profile(user.id) };
  }

  /** Voids earlier unconsumed tokens of the same purpose and returns a new raw token. */
  async issueAuthToken(vendorUserId: string, purpose: VendorTokenPurpose, ttlMs: number): Promise<string> {
    const raw = newOpaqueToken();
    await this.prisma.$transaction([
      this.prisma.vendorAuthToken.updateMany({
        where: { vendorUserId, purpose, consumedAt: null },
        data:  { consumedAt: new Date() },
      }),
      this.prisma.vendorAuthToken.create({
        data: { vendorUserId, purpose, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + ttlMs) },
      }),
    ]);
    return raw;
  }

  async revokeAllSessions(vendorUserId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.vendorRefreshToken.updateMany({
        where: { vendorUserId, revokedAt: null },
        data:  { revokedAt: new Date() },
      }),
      this.prisma.vendorUser.update({ where: { id: vendorUserId }, data: { tokenVersion: { increment: 1 } } }),
    ]);
  }

  private async findUsableToken(rawToken: string, purpose: VendorTokenPurpose) {
    if (!rawToken) return null;
    const token = await this.prisma.vendorAuthToken.findUnique({
      where:  { tokenHash: sha256(rawToken) },
      select: {
        id: true, purpose: true, consumedAt: true, expiresAt: true,
        vendorUser: { select: { id: true, storeId: true, status: true, vendor: { select: { status: true } } } },
      },
    });
    if (!token || token.purpose !== purpose || token.consumedAt || token.expiresAt <= new Date()) return null;
    return token;
  }

  private async recordFailedLogin(vendorUserId: string, storeId: string): Promise<void> {
    const updated = await this.prisma.vendorUser.update({
      where:  { id: vendorUserId },
      data:   { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true, email: true },
    });
    if (updated.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      await this.prisma.vendorUser.update({
        where: { id: vendorUserId },
        data:  { lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000), failedLoginAttempts: 0 },
      });
      await this.audit.record(storeId, 'vendor_user.locked', vendorUserId, { kind: 'anonymous' });
      this.logger.warn(`Vendor account locked after ${MAX_FAILED_LOGIN_ATTEMPTS} failed logins (${maskEmail(updated.email)})`);
    }
  }
}

export const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
