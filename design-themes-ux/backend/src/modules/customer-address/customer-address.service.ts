import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomerAddress } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateCustomerAddressDto } from './dto/create-customer-address.dto';
import { UpdateCustomerAddressDto } from './dto/update-customer-address.dto';

export interface CustomerAddressResponse {
  id: string;
  label: string | null;
  firstName: string | null;
  lastName: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefault: boolean;
}

function toResponse(address: CustomerAddress): CustomerAddressResponse {
  return {
    id: address.id,
    label: address.label,
    firstName: address.firstName,
    lastName: address.lastName,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    phone: address.phone,
    isDefault: address.isDefault,
  };
}

@Injectable()
export class CustomerAddressService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every query in this service is scoped by (id, customerId, storeId)
   * together — CustomerAddress has no storeId column of its own, so storeId
   * is enforced via a relational filter through its `customer` association.
   * This mirrors the same defense-in-depth posture CustomerProfileService
   * uses: even though the guard already resolved a (customerId, storeId)
   * pair that's known-consistent, every write re-verifies it rather than
   * trusting the caller-supplied id alone.
   */
  async listAddresses(customerId: string, storeId: string): Promise<CustomerAddressResponse[]> {
    const addresses = await this.prisma.customerAddress.findMany({
      where: { customerId, customer: { storeId } },
      orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    });
    return addresses.map(toResponse);
  }

  async createAddress(
    customerId: string,
    storeId: string,
    dto: CreateCustomerAddressDto,
  ): Promise<CustomerAddressResponse> {
    // Unlike update/delete, there is no existing address row to scope a
    // conditional write against yet — so ownership is checked explicitly
    // before the very first row for this customer can be created.
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, storeId },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const created = await this.prisma.customerAddress.create({
      data: {
        customerId,
        label: dto.label,
        firstName: dto.firstName,
        lastName: dto.lastName,
        line1: dto.line1,
        line2: dto.line2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        ...(dto.country !== undefined ? { country: dto.country } : {}),
        phone: dto.phone,
      },
    });

    return toResponse(created);
  }

  async updateAddress(
    id: string,
    customerId: string,
    storeId: string,
    dto: UpdateCustomerAddressDto,
  ): Promise<CustomerAddressResponse> {
    const data: Record<string, string | undefined> = {};
    for (const key of ['label', 'firstName', 'lastName', 'line1', 'line2', 'city', 'state', 'postalCode', 'country', 'phone'] as const) {
      if (dto[key] !== undefined) data[key] = dto[key];
    }

    if (Object.keys(data).length > 0) {
      const result = await this.prisma.customerAddress.updateMany({
        where: { id, customerId, customer: { storeId } },
        data,
      });
      if (result.count === 0) {
        throw new NotFoundException('Address not found');
      }
    }

    return this.loadOne(id, customerId, storeId);
  }

  async deleteAddress(id: string, customerId: string, storeId: string): Promise<{ message: string }> {
    const result = await this.prisma.customerAddress.deleteMany({
      where: { id, customerId, customer: { storeId } },
    });
    if (result.count === 0) {
      throw new NotFoundException('Address not found');
    }
    return { message: 'Address deleted' };
  }

  /**
   * Backs both POST :id/default-shipping and POST :id/default-billing —
   * CustomerAddress has a single `isDefault` column, not separate
   * shipping/billing default flags, so both actions converge on the same
   * "exactly one default address per customer" semantics. Unset-then-set
   * runs in a transaction so a request never observes zero or two defaults.
   */
  async setDefault(id: string, customerId: string, storeId: string): Promise<CustomerAddressResponse> {
    const target = await this.prisma.customerAddress.findFirst({
      where: { id, customerId, customer: { storeId } },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException('Address not found');
    }

    await this.prisma.$transaction([
      this.prisma.customerAddress.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.customerAddress.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    return this.loadOne(id, customerId, storeId);
  }

  private async loadOne(id: string, customerId: string, storeId: string): Promise<CustomerAddressResponse> {
    const address = await this.prisma.customerAddress.findFirst({
      where: { id, customerId, customer: { storeId } },
    });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    return toResponse(address);
  }
}
