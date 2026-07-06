import {
  Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBadRequestResponse, ApiBearerAuth, ApiGoneResponse, ApiNotFoundResponse,
  ApiOperation, ApiResponse, ApiTags, ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CustomerJwtAuthGuard } from '@/modules/customer-auth/guards/customer-jwt-auth.guard';
import { CurrentCustomer } from '@/modules/customer-auth/decorators/current-customer.decorator';
import { AuthenticatedCustomer } from '@/modules/customer-auth/types/customer-auth.types';
import { CustomerPaymentService } from './customer-payment.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import {
  PaymentDetailResponseDto, PaymentInitiationResponseDto, PaymentStatusResponseDto,
} from './dto/payment-response.dto';

// Customer Payment API — thin REST surface over CustomerPaymentService,
// which itself only orchestrates CheckoutService/PaymentService/
// PaymentOrchestratorService/the gateway registry. No payment or checkout
// business logic lives in this file. `@Public()` bypasses the global
// merchant JwtAuthGuard (same pattern as every other customer-* controller)
// — CustomerJwtAuthGuard is what actually authenticates these routes.
//
// No class-level @Controller() prefix: routes span two resource families
// (`checkout/:checkoutId/pay` and `payments/:paymentId*`), so each method
// declares its own full path instead.
@ApiTags('Customer Payment')
@ApiBearerAuth()
@Public()
@UseGuards(CustomerJwtAuthGuard)
@Controller()
export class CustomerPaymentController {
  constructor(private readonly customerPayment: CustomerPaymentService) {}

  @Post('checkout/:checkoutId/pay')
  @ApiOperation({ summary: 'Initiate payment for a validated checkout owned by the current customer' })
  @ApiResponse({ status: 201, description: 'Payment attempt created/started', type: PaymentInitiationResponseDto })
  @ApiBadRequestResponse({ description: 'Checkout is not valid for payment, or the requested gateway is unavailable' })
  @ApiGoneResponse({ description: 'Checkout session is cancelled, expired, or already completed' })
  @ApiNotFoundResponse({ description: 'Checkout session does not exist or does not belong to this customer' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  initiate(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('checkoutId') checkoutId: string,
    @Body() dto: InitiatePaymentDto,
    @Req() req: Request,
  ): Promise<PaymentInitiationResponseDto> {
    return this.customerPayment.initiatePayment(checkoutId, customer, dto, req);
  }

  @Get('payments/:paymentId/status')
  @ApiOperation({ summary: 'Get the current status of a payment owned by the current customer (lightweight polling shape)' })
  @ApiResponse({ status: 200, description: 'Current payment status', type: PaymentStatusResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  @ApiNotFoundResponse({ description: 'Payment does not exist or does not belong to this customer' })
  getStatus(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('paymentId') paymentId: string,
  ): Promise<PaymentStatusResponseDto> {
    return this.customerPayment.getPaymentStatus(paymentId, customer);
  }

  @Post('payments/:paymentId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed payment — creates a new attempt superseding the failed one' })
  @ApiResponse({ status: 200, description: 'New payment attempt created/started', type: PaymentInitiationResponseDto })
  @ApiBadRequestResponse({ description: 'The payment is not in a terminal (retryable) state' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  @ApiNotFoundResponse({ description: 'Payment does not exist or does not belong to this customer' })
  retry(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('paymentId') paymentId: string,
  ): Promise<PaymentInitiationResponseDto> {
    return this.customerPayment.retryPayment(paymentId, customer);
  }

  @Get('payments/:paymentId')
  @ApiOperation({ summary: 'Get full payment details owned by the current customer' })
  @ApiResponse({ status: 200, description: 'Payment details', type: PaymentDetailResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  @ApiNotFoundResponse({ description: 'Payment does not exist or does not belong to this customer' })
  getDetails(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('paymentId') paymentId: string,
  ): Promise<PaymentDetailResponseDto> {
    return this.customerPayment.getPaymentDetails(paymentId, customer);
  }
}
