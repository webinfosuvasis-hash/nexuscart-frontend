import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { CurrentUser }  from '@/common/decorators/current-user.decorator';
import { Permissions }  from '@/common/decorators/permissions.decorator';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { MarkDeliveredDto }  from './dto/mark-delivered.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { FulfillmentService } from './fulfillment.service';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class FulfillmentController {
  constructor(private readonly fulfillmentSvc: FulfillmentService) {}

  @Post(':id/shipments')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('orders:fulfill')
  @ApiOperation({ summary: 'Create a shipment for an order' })
  createShipment(
    @CurrentStore() storeId: string,
    @Param('id') orderId: string,
    @Body() dto: CreateShipmentDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.fulfillmentSvc.createShipment({
      orderId,
      storeId,
      actorId:        actorId ?? 'system',
      trackingNumber: dto.trackingNumber,
      carrier:        dto.carrier,
      carrierUrl:     dto.carrierUrl,
      note:           dto.note,
      items:          dto.items,
    });
  }

  @Patch(':id/shipments/:shipmentId')
  @Permissions('orders:fulfill')
  @ApiOperation({ summary: 'Update shipment tracking information' })
  updateShipment(
    @CurrentStore() storeId: string,
    @Param('id') orderId: string,
    @Param('shipmentId') shipmentId: string,
    @Body() dto: UpdateShipmentDto,
  ) {
    return this.fulfillmentSvc.updateShipment({
      shipmentId,
      orderId,
      storeId,
      trackingNumber: dto.trackingNumber,
      carrier:        dto.carrier,
      carrierUrl:     dto.carrierUrl,
      note:           dto.note,
    });
  }

  @Post(':id/shipments/:shipmentId/deliver')
  @HttpCode(HttpStatus.OK)
  @Permissions('orders:fulfill')
  @ApiOperation({ summary: 'Mark a shipment as delivered' })
  markDelivered(
    @CurrentStore() storeId: string,
    @Param('id') orderId: string,
    @Param('shipmentId') shipmentId: string,
    @Body() dto: MarkDeliveredDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.fulfillmentSvc.markDelivered({
      shipmentId,
      orderId,
      storeId,
      actorId:     actorId ?? 'system',
      deliveredAt: dto.deliveredAt,
    });
  }
}
