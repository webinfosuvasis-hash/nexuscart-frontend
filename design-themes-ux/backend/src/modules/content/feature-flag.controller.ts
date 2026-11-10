import {
  Controller, Get, Post, Param, Body,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { FeatureFlagService, FeatureFlag, KNOWN_FLAGS } from './feature-flag.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';

// Authenticated by the global JwtAuthGuard. Not re-applied here: a controller-level
// JwtAuthGuard re-runs passport and replaces the store-scoped principal set by StoreContextGuard.
@Controller('content/flags')
export class FeatureFlagController {
  constructor(private readonly flags: FeatureFlagService) {}

  private assertStoreAccess(user: any, storeId: string) {
    if (user.role !== 'SUPER_ADMIN' && user.storeId !== storeId) {
      throw new ForbiddenException('Access denied to this store');
    }
  }

  // GET /content/flags/known — list valid flag names. Declared before
  // ':storeId' so the static path is not captured by the parameter route.
  @Get('known')
  @Permissions('theme:read')
  getKnown() {
    return { flags: KNOWN_FLAGS };
  }

  // GET /content/flags/:storeId — all flags for a store
  @Get(':storeId')
  @Permissions('theme:read')
  async getAll(@Param('storeId') storeId: string, @CurrentUser() user: any) {
    this.assertStoreAccess(user, storeId);
    return this.flags.getAll(storeId);
  }

  // GET /content/flags/:storeId/audit — audit log for a store
  @Get(':storeId/audit')
  @Permissions('theme:read')
  async getAudit(@Param('storeId') storeId: string, @CurrentUser() user: any) {
    this.assertStoreAccess(user, storeId);
    return this.flags.getAuditLog(storeId);
  }

  // POST /content/flags/:storeId/enable  { flag }
  // The audit actor is the authenticated user — never a client-supplied id.
  @Post(':storeId/enable')
  @Permissions('theme:publish')
  async enable(
    @Param('storeId') storeId: string,
    @Body('flag')     flag:    string,
    @CurrentUser()    user:    any,
  ) {
    this.assertStoreAccess(user, storeId);
    if (!flag) throw new BadRequestException('flag is required');
    this.flags.validateFlag(flag);
    await this.flags.enable(storeId, flag as FeatureFlag, user.id);
    return { storeId, flag, enabled: true, actorId: user.id };
  }

  // POST /content/flags/:storeId/disable  { flag }
  @Post(':storeId/disable')
  @Permissions('theme:publish')
  async disable(
    @Param('storeId') storeId: string,
    @Body('flag')     flag:    string,
    @CurrentUser()    user:    any,
  ) {
    this.assertStoreAccess(user, storeId);
    if (!flag) throw new BadRequestException('flag is required');
    this.flags.validateFlag(flag);
    await this.flags.disable(storeId, flag as FeatureFlag, user.id);
    return { storeId, flag, enabled: false, actorId: user.id };
  }
}
