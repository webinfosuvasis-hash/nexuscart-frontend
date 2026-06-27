import {
  Controller, Get, Post, Put, Delete, Body, Param, Patch, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';

@ApiTags('Categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @Permissions('categories:read')
  @ApiOperation({ summary: 'Get N-th level category tree' })
  findAll(@CurrentStore() storeId: string) {
    return this.categories.findAll(storeId);
  }

  @Get('flat')
  @Permissions('categories:read')
  @ApiOperation({ summary: 'Get flat list (for selects)' })
  findFlat(@CurrentStore() storeId: string) {
    return this.categories.findFlat(storeId);
  }

  @Get(':id')
  @Permissions('categories:read')
  findOne(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.categories.findOne(storeId, id);
  }

  @Post()
  @Permissions('categories:create')
  create(@CurrentStore() storeId: string, @Body() dto: any) {
    return this.categories.create(storeId, dto);
  }

  @Put(':id')
  @Permissions('categories:update')
  update(@CurrentStore() storeId: string, @Param('id') id: string, @Body() dto: any) {
    return this.categories.update(storeId, id, dto);
  }

  @Delete(':id')
  @Permissions('categories:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.categories.remove(storeId, id);
  }

  @Patch('reorder')
  @Permissions('categories:update')
  @ApiOperation({ summary: 'Drag & drop reorder' })
  reorder(
    @CurrentStore() storeId: string,
    @Body() body: { orders: { id: string; sortOrder: number }[] },
  ) {
    return this.categories.reorder(storeId, body.orders);
  }

  @Patch('bulk-move')
  @Permissions('categories:update')
  @ApiOperation({ summary: 'Bulk move categories under a new parent' })
  bulkMove(
    @CurrentStore() storeId: string,
    @Body() body: { ids: string[]; newParentId: string | null },
  ) {
    return this.categories.bulkMove(storeId, body.ids, body.newParentId);
  }

  @Post('merge')
  @Permissions('categories:update')
  @ApiOperation({ summary: 'Merge multiple categories into one' })
  merge(
    @CurrentStore() storeId: string,
    @Body() body: { sourceIds: string[]; targetId: string },
  ) {
    return this.categories.merge(storeId, body.sourceIds, body.targetId);
  }

  @Patch(':id/visibility')
  @Permissions('categories:update')
  @ApiOperation({ summary: 'Update featured / homepage / menu visibility' })
  updateVisibility(
    @CurrentStore() storeId: string,
    @Param('id') id: string,
    @Body() body: { isFeatured?: boolean; showOnHomepage?: boolean; menuVisibility?: string },
  ) {
    return this.categories.updateVisibility(storeId, id, body);
  }

  @Post(':id/apply-rules')
  @Permissions('categories:update')
  @ApiOperation({ summary: 'Auto-assign products by category rules' })
  applyRules(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.categories.applyRules(storeId, id);
  }
}
