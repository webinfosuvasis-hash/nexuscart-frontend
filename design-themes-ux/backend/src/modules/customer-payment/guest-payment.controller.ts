import {
  Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBadRequestResponse, ApiGoneResponse, ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CustomerPaymentService } from './customer-payment.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentInitiationResponseDto, PaymentStatusResponseDto } from './dto/payment-response.dto';

// Guest Payment API — the no-account counterpart of CustomerPaymentController.
// Deliberately a separate route family rather than an optional guard on the
// customer routes, so authenticated payment behaviour is untouched. There is
// no token here: CustomerPaymentModule applies CartSessionMiddleware to
// `guest-checkout/*`, and CustomerPaymentService only lets a request pay a
// checkout started by that same cart-session cookie and not yet claimed by
// an account.
@ApiTags('Guest Payment')
@Public()
@Controller('guest-checkout')
export class GuestPaymentController {
  constructor(private readonly customerPayment: CustomerPaymentService) {}

  @Post(':checkoutId/pay')
  @ApiOperation({ summary: 'Initiate payment for a validated guest checkout owned by this cart session' })
  @ApiResponse({ status: 201, description: 'Payment attempt created/started', type: PaymentInitiationResponseDto })
  @ApiBadRequestResponse({ description: 'Checkout is not valid for payment, has no contact email, or the gateway is unavailable' })
  @ApiGoneResponse({ description: 'Checkout session is cancelled, expired, or already completed' })
  @ApiNotFoundResponse({ description: 'Checkout session does not exist, belongs to another session, or is claimed by an account' })
  initiate(
    @Param('checkoutId') checkoutId: string,
    @Body() dto: InitiatePaymentDto,
    @Req() req: Request,
  ): Promise<PaymentInitiationResponseDto> {
    return this.customerPayment.initiateGuestPayment(checkoutId, dto, req);
  }

  @Get('payments/:paymentId/status')
  @ApiOperation({ summary: 'Get the current status of a guest payment owned by this cart session' })
  @ApiResponse({ status: 200, description: 'Current payment status', type: PaymentStatusResponseDto })
  @ApiNotFoundResponse({ description: 'Payment does not exist or does not belong to this cart session' })
  getStatus(@Param('paymentId') paymentId: string, @Req() req: Request): Promise<PaymentStatusResponseDto> {
    return this.customerPayment.getGuestPaymentStatus(paymentId, req);
  }

  @Post('payments/:paymentId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed guest payment — creates a new attempt superseding the failed one' })
  @ApiResponse({ status: 200, description: 'New payment attempt created/started', type: PaymentInitiationResponseDto })
  @ApiBadRequestResponse({ description: 'The payment is not in a terminal (retryable) state' })
  @ApiNotFoundResponse({ description: 'Payment does not exist or does not belong to this cart session' })
  retry(@Param('paymentId') paymentId: string, @Req() req: Request): Promise<PaymentInitiationResponseDto> {
    return this.customerPayment.retryGuestPayment(paymentId, req);
  }
}
