import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * Vendor account events in the existing audit_logs table. `userId` is only set
 * for merchant actors (it references users); vendor actors are recorded in
 * `details`. No emails, passwords or tokens are ever written here.
 */
@Injectable()
export class VendorAuthAudit {
  private readonly logger = new Logger(VendorAuthAudit.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    storeId: string,
    action: string,
    vendorUserId: string,
    actor: { kind: 'merchant'; userId: string } | { kind: 'vendor' } | { kind: 'anonymous' },
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          storeId,
          userId:   actor.kind === 'merchant' ? actor.userId : null,
          action,
          resource: `vendor_user:${vendorUserId}`,
          details:  JSON.stringify({ actor: actor.kind, ...extra }),
        },
      });
    } catch (err) {
      // Auditing must never block authentication; the failure itself is logged.
      this.logger.error(`Audit write failed for ${action}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
