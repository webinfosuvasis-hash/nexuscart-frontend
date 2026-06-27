import {
  Controller, Get, Post, Patch, Body, Param, Query,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @Permissions('orders:read')
  @ApiOperation({ summary: 'List orders with filters' })
  findAll(@CurrentStore() storeId: string, @Query() query: any) {
    return this.orders.findAll(storeId, query);
  }

  @Get('stats')
  @Permissions('orders:read')
  @ApiOperation({ summary: 'Get order stats by status' })
  getStats(@CurrentStore() storeId: string) {
    return this.orders.getStats(storeId);
  }

  @Get(':id')
  @Permissions('orders:read')
  @ApiOperation({ summary: 'Get order details with timeline and items' })
  findOne(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.orders.findOne(storeId, id);
  }

  @Patch(':id/status')
  @Permissions('orders:update')
  @ApiOperation({ summary: 'Update order status (enforces state machine)' })
  updateStatus(
    @CurrentStore() storeId: string,
    @Param('id') id: string,
    @Body() body: { status: string; note?: string },
  ) {
    return this.orders.updateStatus(storeId, id, body.status, body.note);
  }

  @Post(':id/notes')
  @Permissions('orders:update')
  @ApiOperation({ summary: 'Add internal note to order' })
  addNote(
    @CurrentStore() storeId: string,
    @Param('id') id: string,
    @Body() body: { content: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.orders.addNote(storeId, id, body.content, userId);
  }

  @Post(':id/shipment')
  @Permissions('orders:update')
  @ApiOperation({ summary: 'Add shipment tracking and mark as shipped' })
  addShipment(
    @CurrentStore() storeId: string,
    @Param('id') id: string,
    @Body() shipmentData: any,
  ) {
    return this.orders.addShipment(storeId, id, shipmentData);
  }

  @Post(':id/refund')
  @Permissions('orders:update')
  @ApiOperation({ summary: 'Create a refund for an order' })
  createRefund(
    @CurrentStore() storeId: string,
    @Param('id') id: string,
    @Body() body: { amount: number; reason: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.orders.createRefund(storeId, id, body.amount, body.reason, userId);
  }
}
