import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('stats')
  @Permissions('inventory:read')
  getStats(@CurrentStore() storeId: string) {
    return this.inventory.getStats(storeId);
  }

  // Warehouses
  @Get('warehouses')
  @Permissions('inventory:read')
  listWarehouses(@CurrentStore() storeId: string) {
    return this.inventory.listWarehouses(storeId);
  }

  @Post('warehouses')
  @Permissions('inventory:create')
  createWarehouse(@CurrentStore() storeId: string, @Body() dto: any) {
    return this.inventory.createWarehouse(storeId, dto);
  }

  @Put('warehouses/:id')
  @Permissions('inventory:update')
  updateWarehouse(@CurrentStore() storeId: string, @Param('id') id: string, @Body() dto: any) {
    return this.inventory.updateWarehouse(storeId, id, dto);
  }

  @Delete('warehouses/:id')
  @Permissions('inventory:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeWarehouse(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.inventory.removeWarehouse(storeId, id);
  }

  // Suppliers
  @Get('suppliers')
  @Permissions('inventory:read')
  listSuppliers(@CurrentStore() storeId: string, @Query() query: any) {
    return this.inventory.listSuppliers(storeId, query);
  }

  @Post('suppliers')
  @Permissions('inventory:create')
  createSupplier(@CurrentStore() storeId: string, @Body() dto: any) {
    return this.inventory.createSupplier(storeId, dto);
  }

  @Put('suppliers/:id')
  @Permissions('inventory:update')
  updateSupplier(@CurrentStore() storeId: string, @Param('id') id: string, @Body() dto: any) {
    return this.inventory.updateSupplier(storeId, id, dto);
  }

  // Stock Movements
  @Get('movements')
  @Permissions('inventory:read')
  listMovements(@CurrentStore() storeId: string, @Query() query: any) {
    return this.inventory.listMovements(storeId, query);
  }

  @Post('movements')
  @Permissions('inventory:create')
  @ApiOperation({ summary: 'Record a stock movement (IN/OUT/TRANSFER/ADJUSTMENT)' })
  createMovement(
    @CurrentStore() storeId: string,
    @Body() dto: any,
    @CurrentUser('id') userId: string,
  ) {
    return this.inventory.createMovement(storeId, dto, userId);
  }

  // Purchase Orders
  @Get('purchase-orders')
  @Permissions('inventory:read')
  listPurchaseOrders(@CurrentStore() storeId: string, @Query() query: any) {
    return this.inventory.listPurchaseOrders(storeId, query);
  }

  @Post('purchase-orders')
  @Permissions('inventory:create')
  createPurchaseOrder(
    @CurrentStore() storeId: string,
    @Body() dto: any,
    @CurrentUser('id') userId: string,
  ) {
    return this.inventory.createPurchaseOrder(storeId, dto, userId);
  }

  @Post('purchase-orders/:id/receive')
  @Permissions('inventory:update')
  @ApiOperation({ summary: 'Receive a purchase order and update stock levels' })
  receivePurchaseOrder(
    @CurrentStore() storeId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.inventory.receivePurchaseOrder(storeId, id, userId);
  }
}
