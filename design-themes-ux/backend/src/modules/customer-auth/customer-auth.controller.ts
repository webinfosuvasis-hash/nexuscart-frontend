import {
  Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiResponse,
  ApiBadRequestResponse, ApiUnauthorizedResponse, ApiConflictResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerJwtAuthGuard } from './guards/customer-jwt-auth.guard';
import { CurrentCustomer } from './decorators/current-customer.decorator';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginCustomerDto } from './dto/login-customer.dto';
import { RefreshCustomerTokenDto } from './dto/refresh-customer-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import {
  CustomerTokenPairResponseDto, CustomerMeResponseDto, CustomerAuthMessageResponseDto,
} from './dto/customer-auth-response.dto';
import { AuthenticatedCustomer } from './types/customer-auth.types';

// FI-2 — thin REST surface over the FI-1 CustomerAuthService. Every handler
// only validates the request (DTO + guard), delegates to
// CustomerAuthService exactly as-is, and shapes the response — no business
// logic lives here.
//
// Isolated from the merchant AuthController: separate 'customer/auth' path,
// CustomerJwtAuthGuard/@CurrentCustomer() instead of the merchant
// JwtAuthGuard/@CurrentUser(), so a merchant token can never reach these
// protected routes and vice versa.
@ApiTags('Customer Auth')
@Controller('customer/auth')
export class CustomerAuthController {
  constructor(private readonly customerAuth: CustomerAuthService) {}

  @Public()
  @Post('register')
  @Throttle({ short: { ttl: 60000, limit: 5 }, medium: { ttl: 3600000, limit: 20 } })
  @ApiOperation({ summary: 'Register a new customer for the current store' })
  @ApiResponse({ status: 201, description: 'Customer registered and logged in', type: CustomerTokenPairResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed, or X-Store-Id header missing' })
  @ApiConflictResponse({ description: 'An account with this email already exists' })
  register(
    @Body() dto: RegisterCustomerDto,
    @CurrentStore() storeId: string,
  ): Promise<CustomerTokenPairResponseDto> {
    return this.customerAuth.register(dto, storeId);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 10 }, medium: { ttl: 3600000, limit: 50 } })
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login succeeded', type: CustomerTokenPairResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials, inactive account, or account locked out' })
  @ApiBadRequestResponse({ description: 'Validation failed, or X-Store-Id header missing' })
  login(
    @Body() dto: LoginCustomerDto,
    @CurrentStore() storeId: string,
  ): Promise<CustomerTokenPairResponseDto> {
    return this.customerAuth.login(dto, storeId);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for a new access + refresh token pair' })
  @ApiResponse({ status: 200, description: 'Rotation succeeded', type: CustomerTokenPairResponseDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token invalid, expired, reused, or revoked' })
  @ApiBadRequestResponse({ description: 'Validation failed, or X-Store-Id header missing' })
  refresh(
    @Body() dto: RefreshCustomerTokenDto,
    @CurrentStore() storeId: string,
  ): Promise<CustomerTokenPairResponseDto> {
    return this.customerAuth.refresh(dto.refreshToken, storeId);
  }

  // @Public() bypasses the global merchant JwtAuthGuard (which would otherwise
  // try to verify this token against the merchant 'jwt' strategy and reject
  // it before CustomerJwtAuthGuard ever runs) — CustomerJwtAuthGuard below is
  // the guard that actually authenticates this route.
  @Public()
  @UseGuards(CustomerJwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current session (the refresh token supplied in the body)' })
  @ApiResponse({ status: 200, description: 'Session revoked (idempotent)', type: CustomerAuthMessageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  async logout(
    @Body() dto: RefreshCustomerTokenDto,
    @CurrentCustomer('id') customerId: string,
  ): Promise<CustomerAuthMessageResponseDto> {
    await this.customerAuth.logout(customerId, dto.refreshToken);
    return { message: 'Logged out' };
  }

  @Public()
  @UseGuards(CustomerJwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke every active session for the current customer' })
  @ApiResponse({ status: 200, description: 'All sessions revoked', type: CustomerAuthMessageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  async logoutAll(
    @CurrentCustomer('id') customerId: string,
  ): Promise<CustomerAuthMessageResponseDto> {
    await this.customerAuth.logoutAll(customerId);
    return { message: 'Logged out of all sessions' };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 5 }, medium: { ttl: 3600000, limit: 20 } })
  @ApiOperation({ summary: 'Request a password-reset email (responds identically whether or not the email exists)' })
  @ApiResponse({ status: 200, description: 'Request accepted', type: CustomerAuthMessageResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed, or X-Store-Id header missing' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @CurrentStore() storeId: string,
  ): Promise<CustomerAuthMessageResponseDto> {
    await this.customerAuth.forgotPassword(dto.email, storeId);
    return { message: 'If an account with that email exists, a password reset link has been sent.' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Consume a password-reset token and set a new password' })
  @ApiResponse({ status: 200, description: 'Password reset; all sessions revoked', type: CustomerAuthMessageResponseDto })
  @ApiBadRequestResponse({ description: 'Token invalid, expired, or already used' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<CustomerAuthMessageResponseDto> {
    await this.customerAuth.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password has been reset' };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Consume an email-verification token' })
  @ApiResponse({ status: 200, description: 'Email verified (idempotent if already verified)', type: CustomerAuthMessageResponseDto })
  @ApiBadRequestResponse({ description: 'Token invalid or expired' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<CustomerAuthMessageResponseDto> {
    await this.customerAuth.verifyEmail(dto.token);
    return { message: 'Email verified' };
  }

  @Public()
  @UseGuards(CustomerJwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current customer profile' })
  @ApiResponse({ status: 200, description: 'Current customer', type: CustomerMeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  me(@CurrentCustomer() customer: AuthenticatedCustomer): AuthenticatedCustomer {
    return customer;
  }
}
