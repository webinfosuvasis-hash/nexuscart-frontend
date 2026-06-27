import {
  Controller, Get, Post, Param, Body,
  UseGuards, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { FeatureFlagService, FeatureFlag, KNOWN_FLAGS } from './feature-flag.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('content/flags')
export class FeatureFlagController {
  constructor(private readonly flags: FeatureFlagService) {}

  private assertStoreAccess(user: any, storeId: string) {
    if (user.role !== 'SUPER_ADMIN' && user.storeId !== storeId) {
      throw new ForbiddenException('Access denied to this store');
    }
  }

  // GET /content/flags/:storeId — all flags for a store
  @Get(':storeId')
  async getAll(@Param('storeId') storeId: string, @CurrentUser() user: any) {
    this.assertStoreAccess(user, storeId);
    return this.flags.getAll(storeId);
  }

  // GET /content/flags/:storeId/audit — audit log for a store
  @Get(':storeId/audit')
  async getAudit(@Param('storeId') storeId: string, @CurrentUser() user: any) {
    this.assertStoreAccess(user, storeId);
    return this.flags.getAuditLog(storeId);
  }

  // GET /content/flags/known — list valid flag names
  @Get('known')
  getKnown() {
    return { flags: KNOWN_FLAGS };
  }

  // POST /content/flags/:storeId/enable  { flag, actorId? }
  @Post(':storeId/enable')
  async enable(
    @Param('storeId') storeId: string,
    @Body('flag')     flag:    string,
    @Body('actorId')  actorId: string | undefined,
    @CurrentUser()    user:    any,
  ) {
    this.assertStoreAccess(user, storeId);
    if (!flag) throw new BadRequestException('flag is required');
    this.flags.validateFlag(flag);
    await this.flags.enable(storeId, flag as FeatureFlag, actorId);
    return { storeId, flag, enabled: true, actorId: actorId ?? 'system' };
  }

  // POST /content/flags/:storeId/disable  { flag, actorId? }
  @Post(':storeId/disable')
  async disable(
    @Param('storeId') storeId: string,
    @Body('flag')     flag:    string,
    @Body('actorId')  actorId: string | undefined,
    @CurrentUser()    user:    any,
  ) {
    this.assertStoreAccess(user, storeId);
    if (!flag) throw new BadRequestException('flag is required');
    this.flags.validateFlag(flag);
    await this.flags.disable(storeId, flag as FeatureFlag, actorId);
    return { storeId, flag, enabled: false, actorId: actorId ?? 'system' };
  }
}
