import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class MarketingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Coupons ─────────────────────────────────────────────────────────────────

  async listCoupons(storeId: string, query: any) {
    const { page = 1, limit = 20, search, status } = query;
    const where: any = { storeId };
    if (search) where.code = { contains: search };
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (status === 'expired') where.expiresAt = { lt: new Date() };

    const [items, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.coupon.count({ where }),
    ]);

    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createCoupon(storeId: string, dto: any) {
    const existing = await this.prisma.coupon.findFirst({
      where: { storeId, code: dto.code },
    });
    if (existing) throw new BadRequestException('Coupon code already exists');

    return this.prisma.coupon.create({ data: { ...dto, storeId } });
  }

  async updateCoupon(storeId: string, id: string, dto: any) {
    const coupon = await this.prisma.coupon.findFirst({ where: { id, storeId } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return this.prisma.coupon.update({ where: { id }, data: dto });
  }

  async removeCoupon(storeId: string, id: string) {
    const coupon = await this.prisma.coupon.findFirst({ where: { id, storeId } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    await this.prisma.coupon.delete({ where: { id } });
    return { message: 'Coupon deleted' };
  }

  async validateCoupon(storeId: string, code: string, amount: number) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { storeId, code, isActive: true },
    });
    if (!coupon) throw new NotFoundException('Coupon not found or inactive');
    if (coupon.expiresAt && coupon.expiresAt < new Date())
      throw new BadRequestException('Coupon has expired');
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
      throw new BadRequestException('Coupon usage limit reached');
    if (coupon.minOrderAmount && amount < Number(coupon.minOrderAmount))
      throw new BadRequestException(`Minimum order amount is ₹${coupon.minOrderAmount}`);

    const couponValue = Number(coupon.value);
    const discount =
      coupon.type === 'PERCENTAGE'
        ? (amount * couponValue) / 100
        : Math.min(couponValue, amount);

    return { valid: true, coupon, discount: Math.round(discount) };
  }

  // ─── Campaigns ───────────────────────────────────────────────────────────────

  async listCampaigns(storeId: string, query: any) {
    const { page = 1, limit = 20, type } = query;
    const where: any = { storeId };
    if (type) where.type = type;

    const [items, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createCampaign(storeId: string, dto: any) {
    return this.prisma.campaign.create({ data: { ...dto, storeId } });
  }

  async updateCampaign(storeId: string, id: string, dto: any) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, storeId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return this.prisma.campaign.update({ where: { id }, data: dto });
  }

  async launchCampaign(storeId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, storeId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status === 'SENT') throw new BadRequestException('Campaign already sent');

    return this.prisma.campaign.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() },
    });
  }

  async pauseCampaign(storeId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, storeId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return this.prisma.campaign.update({ where: { id }, data: { status: 'PAUSED' } });
  }

  // ─── Email Templates ─────────────────────────────────────────────────────────

  async listEmailTemplates(storeId: string) {
    return this.prisma.emailTemplate.findMany({
      where: { storeId },
      orderBy: { name: 'asc' },
    });
  }

  async createEmailTemplate(storeId: string, dto: any) {
    return this.prisma.emailTemplate.create({ data: { ...dto, storeId } });
  }

  async updateEmailTemplate(storeId: string, id: string, dto: any) {
    const template = await this.prisma.emailTemplate.findFirst({ where: { id, storeId } });
    if (!template) throw new NotFoundException('Email template not found');
    return this.prisma.emailTemplate.update({ where: { id }, data: dto });
  }

  async removeEmailTemplate(storeId: string, id: string) {
    const template = await this.prisma.emailTemplate.findFirst({ where: { id, storeId } });
    if (!template) throw new NotFoundException('Email template not found');
    await this.prisma.emailTemplate.delete({ where: { id } });
    return { message: 'Email template deleted' };
  }
}
