import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { VendorUsersService } from './vendor-users.service';
import { InviteVendorUserDto, SetVendorUserStatusDto } from './dto/vendor-auth.dto';

// Merchant routes (global JwtAuthGuard → StoreContextGuard → PermissionsGuard).
// Managing portal accounts is owner-only: vendors:update is held by
// STORE_OWNER / SUPER_ADMIN; managers have vendors:read (list) only.
@ApiTags('Vendors')
@ApiBearerAuth()
@Controller('vendors/:vendorId/users')
export class VendorUsersController {
  constructor(private readonly users: VendorUsersService) {}

  @Get()
  @Permissions('vendors:read')
  list(@CurrentStore() storeId: string, @Param('vendorId') vendorId: string) {
    return this.users.list(storeId, vendorId);
  }

  @Post()
  @Permissions('vendors:update')
  @ApiOperation({ summary: 'Invite a person to this vendor\'s portal (emails a 72-hour link)' })
  invite(
    @CurrentStore() storeId: string, @Param('vendorId') vendorId: string,
    @Body() dto: InviteVendorUserDto, @CurrentUser('id') actorId: string,
  ) {
    return this.users.invite(storeId, vendorId, dto, actorId);
  }

  @Post(':userId/invitation')
  @Permissions('vendors:update')
  @HttpCode(HttpStatus.OK)
  resendInvitation(
    @CurrentStore() storeId: string, @Param('vendorId') vendorId: string,
    @Param('userId') userId: string, @CurrentUser('id') actorId: string,
  ) {
    return this.users.resendInvitation(storeId, vendorId, userId, actorId);
  }

  @Post(':userId/password-reset')
  @Permissions('vendors:update')
  @HttpCode(HttpStatus.OK)
  sendPasswordReset(
    @CurrentStore() storeId: string, @Param('vendorId') vendorId: string,
    @Param('userId') userId: string, @CurrentUser('id') actorId: string,
  ) {
    return this.users.sendPasswordReset(storeId, vendorId, userId, actorId);
  }

  @Patch(':userId/status')
  @Permissions('vendors:update')
  @ApiOperation({ summary: 'Activate, suspend or revoke a portal account (takes effect on the next request)' })
  setStatus(
    @CurrentStore() storeId: string, @Param('vendorId') vendorId: string, @Param('userId') userId: string,
    @Body() dto: SetVendorUserStatusDto, @CurrentUser('id') actorId: string,
  ) {
    return this.users.setStatus(storeId, vendorId, userId, dto.status, actorId);
  }
}
