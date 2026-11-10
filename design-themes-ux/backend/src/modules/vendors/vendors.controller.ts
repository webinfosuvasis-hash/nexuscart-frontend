import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { VendorsService } from './vendors.service';
import { CreateVendorDto, QueryVendorDto, UpdateVendorDto } from './dto/vendor.dto';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';

@ApiTags('Vendors')
@ApiBearerAuth()
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendors: VendorsService) {}

  @Get()
  @Permissions('vendors:read')
  @ApiOperation({ summary: 'List marketplace vendors for the current store' })
  findAll(@CurrentStore() storeId: string, @Query() query: QueryVendorDto) {
    return this.vendors.findAll(storeId, query);
  }

  @Get(':id')
  @Permissions('vendors:read')
  findOne(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.vendors.findOne(storeId, id);
  }

  @Post()
  @Permissions('vendors:create')
  create(@CurrentStore() storeId: string, @Body() dto: CreateVendorDto) {
    return this.vendors.create(storeId, dto);
  }

  @Put(':id')
  @Permissions('vendors:update')
  update(@CurrentStore() storeId: string, @Param('id') id: string, @Body() dto: UpdateVendorDto) {
    return this.vendors.update(storeId, id, dto);
  }

  @Delete(':id')
  @Permissions('vendors:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.vendors.remove(storeId, id);
  }
}
