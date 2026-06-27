import {
  Controller, Get, Post, Delete, Patch, Body, Param, Query,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List all users (super admin)' })
  findAll(@Query() query: any) {
    return this.users.findAll(query);
  }

  @Get('staff')
  @Permissions('staff:read')
  @ApiOperation({ summary: 'List staff for current store' })
  listStaff(@CurrentStore() storeId: string) {
    return this.users.listStoreStaff(storeId);
  }

  @Post('staff/invite')
  @Permissions('staff:create')
  @ApiOperation({ summary: 'Invite a staff member to this store' })
  inviteStaff(
    @CurrentStore() storeId: string,
    @Body() dto: InviteStaffDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.users.inviteStaff(storeId, dto, userId);
  }

  @Delete('staff/:staffId')
  @Permissions('staff:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a staff member' })
  removeStaff(@CurrentStore() storeId: string, @Param('staffId') staffId: string) {
    return this.users.removeStaff(storeId, staffId);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Patch(':id/deactivate')
  @Roles('SUPER_ADMIN')
  deactivate(@Param('id') id: string) {
    return this.users.deactivate(id);
  }

  @Patch(':id/activate')
  @Roles('SUPER_ADMIN')
  activate(@Param('id') id: string) {
    return this.users.activate(id);
  }
}
