import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';

@ApiTags('Customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @Permissions('customers:read')
  @ApiOperation({ summary: 'List customers with segment filtering' })
  findAll(@CurrentStore() storeId: string, @Query() query: any) {
    return this.customers.findAll(storeId, query);
  }

  @Get('segment-stats')
  @Permissions('customers:read')
  @ApiOperation({ summary: 'Get customer counts and revenue by segment' })
  segmentStats(@CurrentStore() storeId: string) {
    return this.customers.getSegmentStats(storeId);
  }

  @Post('recompute-segments')
  @Permissions('customers:update')
  @ApiOperation({ summary: 'Recalculate customer segments based on purchase history' })
  recomputeSegments(@CurrentStore() storeId: string) {
    return this.customers.recomputeSegments(storeId);
  }

  @Get(':id')
  @Permissions('customers:read')
  @ApiOperation({ summary: 'Get customer profile with orders and loyalty' })
  findOne(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.customers.findOne(storeId, id);
  }

  @Post()
  @Permissions('customers:create')
  create(@CurrentStore() storeId: string, @Body() dto: any) {
    return this.customers.create(storeId, dto);
  }

  @Put(':id')
  @Permissions('customers:update')
  update(@CurrentStore() storeId: string, @Param('id') id: string, @Body() dto: any) {
    return this.customers.update(storeId, id, dto);
  }

  @Delete(':id')
  @Permissions('customers:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.customers.remove(storeId, id);
  }

  @Post(':id/award-points')
  @Permissions('customers:update')
  @ApiOperation({ summary: 'Award loyalty points to a customer' })
  awardPoints(
    @CurrentStore() storeId: string,
    @Param('id') id: string,
    @Body() body: { points: number; reason: string },
  ) {
    return this.customers.awardPoints(storeId, id, body.points, body.reason);
  }
}
