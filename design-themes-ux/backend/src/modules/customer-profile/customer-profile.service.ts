import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CustomerProfileResponse } from '@/modules/customer-auth/types/customer-auth.types';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';

@Injectable()
export class CustomerProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(customerId: string, storeId: string): Promise<CustomerProfileResponse> {
    return this.loadProfile(customerId, storeId);
  }

  /**
   * Scoped by (id, storeId) together via `updateMany` — the same
   * defense-in-depth pattern CustomerJwtStrategy and CustomerAuthService use
   * throughout FI-1 — so a customer can never patch a row outside their own
   * store even if the id were somehow guessed. `count === 0` means the
   * customer resolved by the guard no longer exists in this store (deleted
   * mid-session); surfaced as 404, never a silent no-op.
   */
  async updateProfile(
    customerId: string,
    storeId: string,
    dto: UpdateCustomerProfileDto,
  ): Promise<CustomerProfileResponse> {
    const data: { name?: string; phone?: string } = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone;

    if (Object.keys(data).length > 0) {
      const result = await this.prisma.customer.updateMany({
        where: { id: customerId, storeId },
        data,
      });

      if (result.count === 0) {
        throw new NotFoundException('Customer not found');
      }
    }

    return this.loadProfile(customerId, storeId);
  }

  private async loadProfile(customerId: string, storeId: string): Promise<CustomerProfileResponse> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, storeId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        credential: { select: { isEmailVerified: true } },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      isEmailVerified: customer.credential?.isEmailVerified ?? false,
    };
  }
}
