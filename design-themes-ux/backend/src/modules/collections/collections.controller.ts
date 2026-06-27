import {
  Controller, Get, Post, Put, Delete, Body, Param, Patch,
  Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CollectionsService } from './collections.service';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';

@ApiTags('Collections')
@ApiBearerAuth()
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  @Permissions('collections:read')
  findAll(@CurrentStore() storeId: string, @Query() query: any) {
    return this.collections.findAll(storeId, query);
  }

  @Get(':id')
  @Permissions('collections:read')
  findOne(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.collections.findOne(storeId, id);
  }

  @Post()
  @Permissions('collections:create')
  create(@CurrentStore() storeId: string, @Body() dto: any) {
    return this.collections.create(storeId, dto);
  }

  @Put(':id')
  @Permissions('collections:update')
  update(@CurrentStore() storeId: string, @Param('id') id: string, @Body() dto: any) {
    return this.collections.update(storeId, id, dto);
  }

  @Delete(':id')
  @Permissions('collections:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.collections.remove(storeId, id);
  }

  @Post(':id/products')
  @Permissions('collections:update')
  addProduct(
    @CurrentStore() storeId: string,
    @Param('id') id: string,
    @Body() body: { productId: string; isPinned?: boolean },
  ) {
    return this.collections.addProduct(storeId, id, body.productId, body.isPinned);
  }

  @Delete(':id/products/:productId')
  @Permissions('collections:update')
  removeProduct(
    @CurrentStore() storeId: string,
    @Param('id') id: string,
    @Param('productId') productId: string,
  ) {
    return this.collections.removeProduct(storeId, id, productId);
  }

  @Patch(':id/reorder-products')
  @Permissions('collections:update')
  reorderProducts(
    @CurrentStore() storeId: string,
    @Param('id') id: string,
    @Body() body: { orders: { productId: string; sortOrder: number }[] },
  ) {
    return this.collections.reorderProducts(storeId, id, body.orders);
  }

  @Post(':id/sync')
  @Permissions('collections:update')
  sync(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.collections.syncSmartCollection(storeId, id);
  }
}
