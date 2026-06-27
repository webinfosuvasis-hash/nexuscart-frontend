import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: any) {
    const { page = 1, limit = 20, search, role } = query;
    const where: any = {};
    if (search) where.OR = [{ name: { contains: search } }, { email: { contains: search } }];
    if (role) where.role = role;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, role: true, isActive: true,
          createdAt: true, lastLoginAt: true,
          ownedStore: { select: { id: true, name: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, role: true, isActive: true,
        createdAt: true, lastLoginAt: true,
        ownedStore: { select: { id: true, name: true, status: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async listStoreStaff(storeId: string) {
    return this.prisma.storeStaff.findMany({
      where: { storeId },
      include: { user: { select: { id: true, name: true, email: true, lastLoginAt: true } } },
      orderBy: { joinedAt: 'desc' },
    });
  }

  async inviteStaff(storeId: string, dto: any, invitedById: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    let userId: string;

    if (existing) {
      userId = existing.id;
    } else {
      const tempPassword = await bcrypt.hash(Math.random().toString(36), 12);
      const newUser = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: tempPassword,
          role: 'STORE_STAFF',
        },
      });
      userId = newUser.id;
    }

    const alreadyStaff = await this.prisma.storeStaff.findFirst({ where: { storeId, userId } });
    if (alreadyStaff) throw new ConflictException('User is already a staff member');

    const sub = await this.prisma.subscription.findUnique({
      where: { storeId },
      include: { plan: true },
    });
    const staffCount = await this.prisma.storeStaff.count({ where: { storeId } });
    if (sub?.plan?.maxStaff && staffCount >= sub.plan.maxStaff) {
      throw new ConflictException('Staff limit reached for your current plan');
    }

    return this.prisma.storeStaff.create({
      data: { storeId, userId, role: dto.role ?? 'STAFF', invitedById },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async removeStaff(storeId: string, staffId: string) {
    const staff = await this.prisma.storeStaff.findFirst({ where: { id: staffId, storeId } });
    if (!staff) throw new NotFoundException('Staff member not found');
    if (staff.role === 'OWNER') throw new ConflictException('Cannot remove the store owner');
    await this.prisma.storeStaff.delete({ where: { id: staffId } });
    return { message: 'Staff member removed' };
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.user.update({ where: { id }, data: { isActive: false } });
  }

  async activate(id: string) {
    await this.findOne(id);
    return this.prisma.user.update({ where: { id }, data: { isActive: true } });
  }
}
