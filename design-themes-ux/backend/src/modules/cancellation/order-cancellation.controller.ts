import {
  Body, Controller, HttpCode, HttpStatus, Param, Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrderCancellationService } from './order-cancellation.service';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { CurrentUser }  from '@/common/decorators/current-user.decorator';
import { Permissions }  from '@/common/decorators/permissions.decorator';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrderCancellationController {
  constructor(private readonly cancellationSvc: OrderCancellationService) {}

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Permissions('orders:cancel')
  @ApiOperation({
    summary: 'Cancel an order with gateway-integrated payment cancellation / refund',
    description:
      'Atomically cancels the order, issues a payment cancellation or refund via the gateway, ' +
      'releases inventory, and emits outbox events. Idempotent when called with the same orderId. ' +
      'storeId is always extracted from the authenticated JWT — never from the request body.',
  })
  cancelOrder(
    @CurrentStore() storeId: string,
    @Param('id') orderId: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.cancellationSvc.cancelOrder({
      orderId,
      storeId,        // CTL-4: from authenticated session only
      reason:         dto.reason,
      actorId:        actorId ?? 'system',
      idempotencyKey: dto.idempotencyKey,
    });
  }
}
