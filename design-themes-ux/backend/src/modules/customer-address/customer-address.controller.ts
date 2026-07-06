import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBadRequestResponse, ApiUnauthorizedResponse, ApiNotFoundResponse,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CustomerJwtAuthGuard } from '@/modules/customer-auth/guards/customer-jwt-auth.guard';
import { CurrentCustomer } from '@/modules/customer-auth/decorators/current-customer.decorator';
import { AuthenticatedCustomer } from '@/modules/customer-auth/types/customer-auth.types';
import { CustomerAddressService, CustomerAddressResponse } from './customer-address.service';
import { CreateCustomerAddressDto } from './dto/create-customer-address.dto';
import { UpdateCustomerAddressDto } from './dto/update-customer-address.dto';
import { CustomerAddressResponseDto } from './dto/customer-address-response.dto';

// Customer Self-Service Phase 3 — thin REST surface over
// CustomerAddressService. Reuses FI-1/FI-2/Phase-2's CustomerJwtAuthGuard and
// @CurrentCustomer() exactly as they exist; no authentication logic lives
// here. `@Public()` bypasses the global merchant JwtAuthGuard (see
// CustomerAuthController/CustomerProfileController for the same pattern) —
// CustomerJwtAuthGuard is what actually authenticates this route.
@ApiTags('Customer Address Book')
@ApiBearerAuth()
@Public()
@UseGuards(CustomerJwtAuthGuard)
@Controller('customer/addresses')
export class CustomerAddressController {
  constructor(private readonly addressService: CustomerAddressService) {}

  @Get()
  @ApiOperation({ summary: "List the current customer's own addresses" })
  @ApiResponse({ status: 200, description: 'Addresses, default first', type: [CustomerAddressResponseDto] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  list(@CurrentCustomer() customer: AuthenticatedCustomer): Promise<CustomerAddressResponse[]> {
    return this.addressService.listAddresses(customer.id, customer.storeId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a new address for the current customer' })
  @ApiResponse({ status: 201, description: 'Address created', type: CustomerAddressResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  create(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body() dto: CreateCustomerAddressDto,
  ): Promise<CustomerAddressResponse> {
    return this.addressService.createAddress(customer.id, customer.storeId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Update one of the current customer's own addresses" })
  @ApiResponse({ status: 200, description: 'Address updated', type: CustomerAddressResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  @ApiNotFoundResponse({ description: 'Address does not exist or does not belong to this customer' })
  update(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerAddressDto,
  ): Promise<CustomerAddressResponse> {
    return this.addressService.updateAddress(id, customer.id, customer.storeId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Delete one of the current customer's own addresses" })
  @ApiResponse({ status: 200, description: 'Address deleted' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  @ApiNotFoundResponse({ description: 'Address does not exist or does not belong to this customer' })
  remove(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return this.addressService.deleteAddress(id, customer.id, customer.storeId);
  }

  @Post(':id/default-shipping')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set an address as the default (CustomerAddress has one shared isDefault flag — see default-billing)' })
  @ApiResponse({ status: 200, description: 'Address set as default', type: CustomerAddressResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  @ApiNotFoundResponse({ description: 'Address does not exist or does not belong to this customer' })
  setDefaultShipping(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('id') id: string,
  ): Promise<CustomerAddressResponse> {
    return this.addressService.setDefault(id, customer.id, customer.storeId);
  }

  @Post(':id/default-billing')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set an address as the default (same shared isDefault flag as default-shipping — see that endpoint)' })
  @ApiResponse({ status: 200, description: 'Address set as default', type: CustomerAddressResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  @ApiNotFoundResponse({ description: 'Address does not exist or does not belong to this customer' })
  setDefaultBilling(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('id') id: string,
  ): Promise<CustomerAddressResponse> {
    return this.addressService.setDefault(id, customer.id, customer.storeId);
  }
}
