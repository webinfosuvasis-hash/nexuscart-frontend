import {
  Controller, Get, Param, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags, ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CustomerJwtAuthGuard } from '@/modules/customer-auth/guards/customer-jwt-auth.guard';
import { CurrentCustomer } from '@/modules/customer-auth/decorators/current-customer.decorator';
import { AuthenticatedCustomer } from '@/modules/customer-auth/types/customer-auth.types';
import { CustomerShipmentService } from './customer-shipment.service';
import { CustomerShipmentDetailResponseDto, CustomerTrackingResponseDto } from './dto/customer-shipment-response.dto';

// Customer Self-Service Phase 6 — thin REST surface over
// CustomerShipmentService, which itself only orchestrates OrdersService
// (unmodified) plus a supplementary ShipmentItem read. `@Public()` bypasses
// the global merchant JwtAuthGuard (same pattern as every other customer-*
// controller) — CustomerJwtAuthGuard is what actually authenticates these
// routes. Mounted at the same `customer/orders` path prefix as Phase 5's
// CustomerOrdersController (a separate controller/module, so that
// already-complete module is never touched) — `:orderId/shipment` and
// `:orderId/tracking` don't collide with any of its existing routes.
@ApiTags('Customer Shipment Tracking')
@ApiBearerAuth()
@Public()
@UseGuards(CustomerJwtAuthGuard)
@Controller('customer/orders')
export class CustomerShipmentController {
  constructor(private readonly customerShipment: CustomerShipmentService) {}

  @Get(':orderId/shipment')
  @ApiOperation({ summary: "Get shipment details (status, tracking, carrier, items shipped) for one of the current customer's own orders" })
  @ApiResponse({ status: 200, description: 'Shipment details', type: CustomerShipmentDetailResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  @ApiNotFoundResponse({ description: 'Order does not exist or does not belong to this customer' })
  getShipment(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('orderId') orderId: string,
  ): Promise<CustomerShipmentDetailResponseDto> {
    return this.customerShipment.getShipmentDetails(orderId, customer.id, customer.storeId);
  }

  @Get(':orderId/tracking')
  @ApiOperation({ summary: "Get the shipment tracking timeline for one of the current customer's own orders" })
  @ApiResponse({ status: 200, description: 'Tracking timeline + shipment summary', type: CustomerTrackingResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  @ApiNotFoundResponse({ description: 'Order does not exist or does not belong to this customer' })
  getTracking(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('orderId') orderId: string,
  ): Promise<CustomerTrackingResponseDto> {
    return this.customerShipment.getTracking(orderId, customer.id, customer.storeId);
  }
}
