import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { VendorStatus, VendorTokenPurpose, VendorUserStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { VendorAuthService } from './vendor-auth.service';
import { VendorAuthMailer, AuthEmailOutcome } from './vendor-auth-mailer.service';
import { VendorAuthAudit } from './vendor-auth-audit.service';
import { INVITATION_TTL_HOURS, PASSWORD_RESET_TTL_MINUTES } from './vendor-auth.types';

const USER_SELECT = {
  id: true, vendorId: true, email: true, name: true, status: true,
  lastLoginAt: true, lockedUntil: true, createdAt: true, updatedAt: true,
} as const;

/** Owner-driven status changes and the states each may start from. */
const TRANSITIONS: Record<'ACTIVE' | 'SUSPENDED' | 'REVOKED', VendorUserStatus[]> = {
  ACTIVE:    [VendorUserStatus.SUSPENDED],
  SUSPENDED: [VendorUserStatus.ACTIVE],
  REVOKED:   [VendorUserStatus.INVITED, VendorUserStatus.ACTIVE, VendorUserStatus.SUSPENDED],
};

// ---------------------------------------------------------------------------
// Store-owner management of vendor portal accounts. Every query is scoped by
// BOTH storeId (from the merchant request, already isolated by
// StoreContextGuard) and vendorId (from the URL, verified to belong to that
// store). Raw invitation / reset tokens are emailed only — never returned.
// ---------------------------------------------------------------------------
@Injectable()
export class VendorUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: VendorAuthService,
    private readonly mailer: VendorAuthMailer,
    private readonly audit: VendorAuthAudit,
  ) {}

  async list(storeId: string, vendorId: string) {
    await this.vendorInStore(storeId, vendorId);
    return this.prisma.vendorUser.findMany({
      where: { storeId, vendorId }, select: USER_SELECT, orderBy: { createdAt: 'asc' },
    });
  }

  async invite(storeId: string, vendorId: string, input: { email: string; name: string }, actorUserId: string) {
    const vendor = await this.vendorInStore(storeId, vendorId);
    if (vendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException('Activate the vendor before inviting portal users');
    }
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.vendorUser.findUnique({
      where: { storeId_email: { storeId, email } }, select: { id: true, vendorId: true, status: true },
    });

    let userId: string;
    if (existing) {
      if (existing.vendorId !== vendorId) {
        throw new ConflictException('This email already has portal access for another vendor in this store');
      }
      if (existing.status !== VendorUserStatus.REVOKED) {
        throw new ConflictException(
          existing.status === VendorUserStatus.INVITED
            ? 'This person is already invited — resend the invitation instead'
            : 'This person already has a portal account',
        );
      }
      // Re-inviting a revoked account starts it over: no password, fresh token version.
      await this.prisma.vendorUser.update({
        where: { id: existing.id },
        data:  {
          name: input.name, status: VendorUserStatus.INVITED, passwordHash: null,
          failedLoginAttempts: 0, lockedUntil: null, invitedById: actorUserId, tokenVersion: { increment: 1 },
        },
      });
      userId = existing.id;
    } else {
      userId = (await this.prisma.vendorUser.create({
        data:   { storeId, vendorId, email, name: input.name, invitedById: actorUserId },
        select: { id: true },
      })).id;
    }

    await this.audit.record(storeId, 'vendor_user.invited', userId, { kind: 'merchant', userId: actorUserId });
    const invitation = await this.sendInvitation(userId, vendor.name, vendor.store.name);
    return { user: await this.getUser(storeId, vendorId, userId), invitation };
  }

  async resendInvitation(storeId: string, vendorId: string, userId: string, actorUserId: string) {
    const vendor = await this.vendorInStore(storeId, vendorId);
    const user = await this.getUser(storeId, vendorId, userId);
    if (user.status !== VendorUserStatus.INVITED) throw new BadRequestException('Only pending invitations can be resent');
    if (vendor.status !== VendorStatus.ACTIVE) throw new BadRequestException('The vendor is inactive');
    await this.audit.record(storeId, 'vendor_user.invitation_resent', userId, { kind: 'merchant', userId: actorUserId });
    return { user, invitation: await this.sendInvitation(userId, vendor.name, vendor.store.name) };
  }

  async sendPasswordReset(storeId: string, vendorId: string, userId: string, actorUserId: string) {
    const vendor = await this.vendorInStore(storeId, vendorId);
    const user = await this.getUser(storeId, vendorId, userId);
    if (user.status !== VendorUserStatus.ACTIVE) throw new BadRequestException('Password resets can only be sent to active accounts');
    const raw = await this.auth.issueAuthToken(userId, VendorTokenPurpose.PASSWORD_RESET, PASSWORD_RESET_TTL_MINUTES * 60_000);
    await this.audit.record(storeId, 'vendor_user.password_reset_sent', userId, { kind: 'merchant', userId: actorUserId });
    const email: AuthEmailOutcome = await this.mailer.sendPasswordReset(user, { storeName: vendor.store.name }, raw);
    return { user, email };
  }

  async setStatus(
    storeId: string, vendorId: string, userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED', actorUserId: string,
  ) {
    const user = await this.getUser(storeId, vendorId, userId);
    const from = TRANSITIONS[status];
    if (!from.includes(user.status)) {
      throw new BadRequestException(`Cannot change a ${user.status.toLowerCase()} account to ${status.toLowerCase()}`);
    }

    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.vendorUser.updateMany({
        where: { id: userId, storeId, vendorId, status: { in: from } },
        data:  {
          status,
          tokenVersion: { increment: 1 },                    // live access tokens die on their next request
          ...(status === 'REVOKED' ? { passwordHash: null } : {}),
        },
      });
      if (changed.count !== 1) throw new ConflictException('The account changed meanwhile — refresh and try again');
      if (status !== 'ACTIVE') {
        await tx.vendorRefreshToken.updateMany({ where: { vendorUserId: userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      if (status === 'REVOKED') {
        await tx.vendorAuthToken.updateMany({ where: { vendorUserId: userId, consumedAt: null }, data: { consumedAt: new Date() } });
      }
    });
    await this.audit.record(storeId, `vendor_user.${status.toLowerCase()}`, userId, { kind: 'merchant', userId: actorUserId });
    return this.getUser(storeId, vendorId, userId);
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private async sendInvitation(userId: string, vendorName: string, storeName: string): Promise<AuthEmailOutcome> {
    const raw = await this.auth.issueAuthToken(userId, VendorTokenPurpose.INVITATION, INVITATION_TTL_HOURS * 3_600_000);
    const user = await this.prisma.vendorUser.findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true } });
    return this.mailer.sendInvitation(user, { vendorName, storeName }, raw);
  }

  private async vendorInStore(storeId: string, vendorId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where:  { id: vendorId, storeId },
      select: { id: true, name: true, status: true, store: { select: { name: true } } },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  private async getUser(storeId: string, vendorId: string, userId: string) {
    const user = await this.prisma.vendorUser.findFirst({ where: { id: userId, storeId, vendorId }, select: USER_SELECT });
    if (!user) throw new NotFoundException('Vendor user not found');
    return user;
  }
}
