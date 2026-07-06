import {
  Controller, Get, Patch, Body, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBadRequestResponse, ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CustomerJwtAuthGuard } from '@/modules/customer-auth/guards/customer-jwt-auth.guard';
import { CurrentCustomer } from '@/modules/customer-auth/decorators/current-customer.decorator';
import { AuthenticatedCustomer, CustomerProfileResponse } from '@/modules/customer-auth/types/customer-auth.types';
import { CustomerProfileService } from './customer-profile.service';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { CustomerProfileResponseDto } from './dto/customer-profile-response.dto';

// Customer Self-Service Phase 2 — thin REST surface over
// CustomerProfileService. Reuses FI-1/FI-2's CustomerJwtAuthGuard and
// @CurrentCustomer() exactly as they exist; no authentication logic lives
// here. `@Public()` bypasses the global merchant JwtAuthGuard (same reason
// CustomerAuthController's logout/logout-all/me routes need it — see that
// controller's comment) — CustomerJwtAuthGuard is what actually authenticates
// this route.
@ApiTags('Customer Profile')
@ApiBearerAuth()
@Public()
@UseGuards(CustomerJwtAuthGuard)
@Controller('customer/profile')
export class CustomerProfileController {
  constructor(private readonly profileService: CustomerProfileService) {}

  @Get()
  @ApiOperation({ summary: "Get the current customer's own profile" })
  @ApiResponse({ status: 200, description: 'Current profile', type: CustomerProfileResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  getProfile(@CurrentCustomer() customer: AuthenticatedCustomer): Promise<CustomerProfileResponse> {
    return this.profileService.getProfile(customer.id, customer.storeId);
  }

  @Patch()
  @ApiOperation({ summary: "Update the current customer's own profile (name and/or phone)" })
  @ApiResponse({ status: 200, description: 'Updated profile', type: CustomerProfileResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  updateProfile(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body() dto: UpdateCustomerProfileDto,
  ): Promise<CustomerProfileResponse> {
    return this.profileService.updateProfile(customer.id, customer.storeId, dto);
  }
}
