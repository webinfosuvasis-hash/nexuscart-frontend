import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma, VendorStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateVendorDto, QueryVendorDto, UpdateVendorDto } from './dto/vendor.dto';

// ---------------------------------------------------------------------------
// Marketplace vendors — the sellers a store's products can be assigned to.
// Every query is scoped to the caller's storeId; a vendor id from another
// store is indistinguishable from one that does not exist (404, never 403).
// ---------------------------------------------------------------------------

const VENDOR_SELECT = {
  id: true, name: true, email: true, status: true, notifyOnOrder: true, createdAt: true, updatedAt: true,
  _count: { select: { products: { where: { deletedAt: null } }, users: true } },
} satisfies Prisma.VendorSelect;

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(storeId: string, query: QueryVendorDto) {
    const { page = 1, limit = 50, search, status } = query;
    const where: Prisma.VendorWhereInput = { storeId };
    if (status) where.status = status;
    if (search) where.OR = [{ name: { contains: search } }, { email: { contains: search } }];

    const [items, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where, select: VENDOR_SELECT, orderBy: { name: 'asc' }, skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.vendor.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(storeId: string, id: string) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, storeId }, select: VENDOR_SELECT });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async create(storeId: string, dto: CreateVendorDto) {
    try {
      return await this.prisma.vendor.create({
        data:   { ...dto, storeId },
        select: VENDOR_SELECT,
      });
    } catch (err) {
      throw this.mapUniqueViolation(err);
    }
  }

  async update(storeId: string, id: string, dto: UpdateVendorDto) {
    await this.findOne(storeId, id);
    try {
      return await this.prisma.vendor.update({ where: { id }, data: dto, select: VENDOR_SELECT });
    } catch (err) {
      throw this.mapUniqueViolation(err);
    }
  }

  /**
   * Hard delete is only allowed while no live product is assigned — otherwise
   * products would silently lose their seller. Deactivate the vendor instead.
   * Past order lines keep their vendorId snapshot either way.
   */
  async remove(storeId: string, id: string) {
    const vendor = await this.findOne(storeId, id);
    if (vendor._count.products > 0) {
      throw new ConflictException(
        `Vendor has ${vendor._count.products} assigned product(s) — reassign them or set the vendor INACTIVE instead`,
      );
    }
    if (vendor._count.users > 0) {
      throw new ConflictException(
        `Vendor has ${vendor._count.users} portal account(s) — revoke them or set the vendor INACTIVE instead`,
      );
    }
    await this.prisma.vendor.delete({ where: { id } });
  }

  /**
   * Guards a product's vendorId before it is written. `currentVendorId` is the
   * product's existing vendor: keeping an already-assigned vendor that has
   * since been deactivated is allowed, newly assigning an inactive one is not.
   */
  async assertAssignable(storeId: string, vendorId: string, currentVendorId: string | null = null): Promise<void> {
    const vendor = await this.prisma.vendor.findFirst({
      where:  { id: vendorId, storeId },
      select: { status: true },
    });
    if (!vendor) throw new BadRequestException('vendorId does not refer to a vendor in this store');
    if (vendor.status !== VendorStatus.ACTIVE && vendorId !== currentVendorId) {
      throw new BadRequestException('Inactive vendors cannot be assigned to products');
    }
  }

  private mapUniqueViolation(err: unknown): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return new ConflictException('A vendor with this name already exists in this store');
    }
    return err;
  }
}
