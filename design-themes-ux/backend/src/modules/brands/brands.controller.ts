import {
  Controller, Get, Post, Put, Delete, Body, Param, Patch,
  Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BrandsService } from './brands.service';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';

@ApiTags('Brands')
@ApiBearerAuth()
@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  @Permissions('brands:read')
  findAll(@CurrentStore() storeId: string, @Query() query: any) {
    return this.brands.findAll(storeId, query);
  }

  @Get(':id')
  @Permissions('brands:read')
  findOne(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.brands.findOne(storeId, id);
  }

  @Post()
  @Permissions('brands:create')
  create(@CurrentStore() storeId: string, @Body() dto: any) {
    return this.brands.create(storeId, dto);
  }

  @Put(':id')
  @Permissions('brands:update')
  update(@CurrentStore() storeId: string, @Param('id') id: string, @Body() dto: any) {
    return this.brands.update(storeId, id, dto);
  }

  @Delete(':id')
  @Permissions('brands:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.brands.remove(storeId, id);
  }

  @Patch('reorder')
  @Permissions('brands:update')
  reorder(
    @CurrentStore() storeId: string,
    @Body() body: { orders: { id: string; sortOrder: number }[] },
  ) {
    return this.brands.reorder(storeId, body.orders);
  }

  @Patch(':id/toggle-featured')
  @Permissions('brands:update')
  toggleFeatured(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.brands.toggleFeatured(storeId, id);
  }
}
