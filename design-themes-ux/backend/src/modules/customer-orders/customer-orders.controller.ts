import {
  Controller, Get, Param, Query, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags, ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CustomerJwtAuthGuard } from '@/modules/customer-auth/guards/customer-jwt-auth.guard';
import { CurrentCustomer } from '@/modules/customer-auth/decorators/current-customer.decorator';
import { AuthenticatedCustomer } from '@/modules/customer-auth/types/customer-auth.types';
import { CustomerOrdersService } from './customer-orders.service';
import { ListCustomerOrdersDto } from './dto/list-customer-orders.dto';
import { CustomerOrderDetailResponseDto, CustomerOrderListResponseDto } from './dto/customer-order-response.dto';

// Customer Self-Service Phase 5 — thin REST surface over
// CustomerOrdersService, which itself only orchestrates OrdersService/
// PaymentService (both unmodified). `@Public()` bypasses the global merchant
// JwtAuthGuard (same pattern as every other customer-* controller) —
// CustomerJwtAuthGuard is what actually authenticates these routes.
@ApiTags('Customer Orders')
@ApiBearerAuth()
@Public()
@UseGuards(CustomerJwtAuthGuard)
@Controller('customer/orders')
export class CustomerOrdersController {
  constructor(private readonly customerOrders: CustomerOrdersService) {}

  @Get()
  @ApiOperation({ summary: "List the current customer's own orders — paginated, sortable, filterable, searchable by order number" })
  @ApiResponse({ status: 200, description: 'Paginated order list', type: CustomerOrderListResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  list(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Query() query: ListCustomerOrdersDto,
  ): Promise<CustomerOrderListResponseDto> {
    return this.customerOrders.listOrders(customer.id, customer.storeId, query);
  }

  @Get(':orderId')
  @ApiOperation({ summary: "Get full details of one of the current customer's own orders" })
  @ApiResponse({ status: 200, description: 'Order details', type: CustomerOrderDetailResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  @ApiNotFoundResponse({ description: 'Order does not exist or does not belong to this customer' })
  getOne(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('orderId') orderId: string,
  ): Promise<CustomerOrderDetailResponseDto> {
    return this.customerOrders.getOrderDetails(orderId, customer.id, customer.storeId);
  }
}
