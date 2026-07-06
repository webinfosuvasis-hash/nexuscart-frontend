import {
  Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiConflictResponse, ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags, ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CustomerJwtAuthGuard } from '@/modules/customer-auth/guards/customer-jwt-auth.guard';
import { CurrentCustomer } from '@/modules/customer-auth/decorators/current-customer.decorator';
import { AuthenticatedCustomer } from '@/modules/customer-auth/types/customer-auth.types';
import { CustomerCancellationService } from './customer-cancellation.service';
import { CancelMyOrderDto } from './dto/cancel-my-order.dto';
import { CustomerCancellationStatusDto, CustomerRefundStatusDto } from './dto/customer-cancellation-response.dto';

// Customer Self-Service Phase 7 — thin REST surface over
// CustomerCancellationService, which itself only orchestrates
// OrderCancellationService and OrdersService (both unmodified). `@Public()`
// bypasses the global merchant JwtAuthGuard (same pattern as every other
// customer-* controller) — CustomerJwtAuthGuard is what actually authenticates
// these routes. Mounted at the same `customer/orders` path prefix as Phases 5
// and 6's controllers (separate controllers/modules, so those already-complete
// modules are never touched) — `:orderId/cancel`, `:orderId/cancellation`, and
// `:orderId/refund` don't collide with any of their existing routes.
@ApiTags('Customer Cancellation & Refunds')
@ApiBearerAuth()
@Public()
@UseGuards(CustomerJwtAuthGuard)
@Controller('customer/orders')
export class CustomerCancellationController {
  constructor(private readonly customerCancellation: CustomerCancellationService) {}

  @Post(':orderId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request cancellation of one of the current customer\'s own orders',
    description:
      'Reuses OrderCancellationService.cancelOrder() verbatim — the same eligibility rules, ' +
      'payment cancel/refund branching, inventory release, and outbox events used by the ' +
      'staff-facing endpoint. Only PENDING or PROCESSING orders can be cancelled; already-shipped ' +
      'or delivered orders are rejected with 409, matching existing backend rules exactly. ' +
      'Idempotent when called again for an already-cancelled order.',
  })
  @ApiResponse({ status: 200, description: 'Cancellation status after processing', type: CustomerCancellationStatusDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  @ApiNotFoundResponse({ description: 'Order does not exist or does not belong to this customer' })
  @ApiConflictResponse({ description: 'Order is no longer in a cancellable status (e.g. already shipped or delivered)' })
  cancelMyOrder(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('orderId') orderId: string,
    @Body() dto: CancelMyOrderDto,
  ): Promise<CustomerCancellationStatusDto> {
    return this.customerCancellation.requestCancellation(orderId, customer.id, customer.storeId, dto.reason);
  }

  @Get(':orderId/cancellation')
  @ApiOperation({ summary: "Get the cancellation status/eligibility for one of the current customer's own orders" })
  @ApiResponse({ status: 200, description: 'Cancellation status', type: CustomerCancellationStatusDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  @ApiNotFoundResponse({ description: 'Order does not exist or does not belong to this customer' })
  getCancellationStatus(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('orderId') orderId: string,
  ): Promise<CustomerCancellationStatusDto> {
    return this.customerCancellation.getCancellationStatus(orderId, customer.id, customer.storeId);
  }

  @Get(':orderId/refund')
  @ApiOperation({ summary: "Get the refund status for one of the current customer's own orders" })
  @ApiResponse({ status: 200, description: 'Refund status', type: CustomerRefundStatusDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  @ApiNotFoundResponse({ description: 'Order does not exist or does not belong to this customer' })
  getRefundStatus(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('orderId') orderId: string,
  ): Promise<CustomerRefundStatusDto> {
    return this.customerCancellation.getRefundStatus(orderId, customer.id, customer.storeId);
  }
}
