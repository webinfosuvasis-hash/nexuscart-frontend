import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StoresService } from './stores.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Roles } from '@/common/decorators/roles.decorator';

@ApiTags('Stores')
@ApiBearerAuth()
@Controller('stores')
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List all stores (super admin only)' })
  findAll(@Query() query: any) {
    return this.stores.findAll(query);
  }

  @Get('platform-stats')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Platform-wide statistics' })
  platformStats() {
    return this.stores.getPlatformStats();
  }

  @Get('settings')
  @Permissions('settings:read')
  @ApiOperation({ summary: 'Get current store settings' })
  getSettings(@CurrentStore() storeId: string) {
    return this.stores.getStoreSettings(storeId);
  }

  @Put('settings')
  @Permissions('settings:update')
  @ApiOperation({ summary: 'Update current store settings' })
  updateSettings(@CurrentStore() storeId: string, @Body() dto: any) {
    return this.stores.updateStoreSettings(storeId, dto);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get store details' })
  findOne(@Param('id') id: string) {
    return this.stores.findOne(id);
  }

  @Post()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new store' })
  create(@Body() dto: any, @CurrentUser('id') userId: string) {
    return this.stores.create(dto, userId);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update store details' })
  update(@Param('id') id: string, @Body() dto: any) {
    return this.stores.update(id, dto);
  }

  @Patch(':id/suspend')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Suspend a store' })
  suspend(@Param('id') id: string) {
    return this.stores.suspend(id);
  }

  @Patch(':id/activate')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Activate a suspended store' })
  activate(@Param('id') id: string) {
    return this.stores.activate(id);
  }
}
