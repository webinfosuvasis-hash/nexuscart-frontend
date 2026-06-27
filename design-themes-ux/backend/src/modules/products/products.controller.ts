import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @Permissions('products:read')
  @ApiOperation({ summary: 'List products with filtering and pagination' })
  findAll(@CurrentStore() storeId: string, @Query() query: QueryProductDto) {
    return this.products.findAll(storeId, query);
  }

  @Get('stats')
  @Permissions('products:read')
  @ApiOperation({ summary: 'Get product stats (totals by status)' })
  getStats(@CurrentStore() storeId: string) {
    return this.products.getStats(storeId);
  }

  @Get(':id')
  @Permissions('products:read')
  @ApiOperation({ summary: 'Get a single product with variants' })
  findOne(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.products.findOne(storeId, id);
  }

  @Post()
  @Permissions('products:create')
  @ApiOperation({ summary: 'Create a new product' })
  create(@CurrentStore() storeId: string, @Body() dto: CreateProductDto) {
    return this.products.create(storeId, dto);
  }

  @Put(':id')
  @Permissions('products:update')
  @ApiOperation({ summary: 'Update a product' })
  update(
    @CurrentStore() storeId: string,
    @Param('id') id: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.products.update(storeId, id, dto);
  }

  @Delete(':id')
  @Permissions('products:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a product' })
  remove(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.products.remove(storeId, id);
  }

  @Post('bulk-delete')
  @Permissions('products:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk delete products' })
  bulkDelete(@CurrentStore() storeId: string, @Body() body: { ids: string[] }) {
    return this.products.bulkDelete(storeId, body.ids);
  }

  @Patch('bulk-status')
  @Permissions('products:update')
  @ApiOperation({ summary: 'Bulk update product status' })
  bulkStatus(
    @CurrentStore() storeId: string,
    @Body() body: { ids: string[]; status: string },
  ) {
    return this.products.bulkUpdateStatus(storeId, body.ids, body.status);
  }

  @Post(':id/duplicate')
  @Permissions('products:create')
  @ApiOperation({ summary: 'Duplicate a product' })
  duplicate(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.products.duplicate(storeId, id);
  }

  @Get(':id/versions')
  @Permissions('products:read')
  @ApiOperation({ summary: 'Get product version history' })
  getVersions(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.products.getVersions(storeId, id);
  }

  @Post(':id/versions/:versionId/rollback')
  @Permissions('products:update')
  @ApiOperation({ summary: 'Rollback product to a specific version' })
  rollback(
    @CurrentStore() storeId: string,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.products.rollback(storeId, id, versionId);
  }

  @Patch(':id/approval')
  @Permissions('products:update')
  @ApiOperation({ summary: 'Update product approval status' })
  updateApproval(
    @CurrentStore() storeId: string,
    @Param('id') id: string,
    @Body() body: { approvalStatus: string; note?: string },
  ) {
    return this.products.updateApproval(storeId, id, body.approvalStatus, body.note);
  }

  @Patch('bulk-edit')
  @Permissions('products:update')
  @ApiOperation({ summary: 'Bulk edit product fields' })
  bulkEdit(
    @CurrentStore() storeId: string,
    @Body() body: { ids: string[]; data: Record<string, any> },
  ) {
    return this.products.bulkEdit(storeId, body.ids, body.data);
  }
}
