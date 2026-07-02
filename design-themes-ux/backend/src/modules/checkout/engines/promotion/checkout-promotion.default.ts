import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  ICheckoutPromotionEngine,
  CheckoutPromoInput,
  CheckoutPromoResult,
} from './checkout-promotion.interface';

@Injectable()
export class DefaultCheckoutPromotionEngine implements ICheckoutPromotionEngine {
  constructor(private readonly prisma: PrismaService) {}

  async validate(input: CheckoutPromoInput): Promise<CheckoutPromoResult> {
    const now    = new Date();
    const coupon = await this.prisma.coupon.findFirst({
      where: { storeId: input.storeId, code: input.couponCode, isActive: true },
    });

    if (!coupon) {
      return { isValid: false, discountAmount: 0, discountType: 'FIXED', label: '', failureReason: 'NOT_FOUND', message: 'Coupon code not found' };
    }

    if (coupon.expiresAt && coupon.expiresAt < now) {
      return { isValid: false, discountAmount: 0, discountType: 'FIXED', label: '', failureReason: 'EXPIRED', message: 'Coupon has expired' };
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return { isValid: false, discountAmount: 0, discountType: 'FIXED', label: '', failureReason: 'USAGE_EXCEEDED', message: 'Coupon usage limit reached' };
    }

    if (coupon.minOrderAmount !== null && input.cartSubtotal < Number(coupon.minOrderAmount)) {
      return {
        isValid:        false,
        discountAmount: 0,
        discountType:   'FIXED',
        label:          '',
        failureReason:  'MINIMUM_NOT_MET',
        message:        `Minimum order amount of ${input.currency} ${Number(coupon.minOrderAmount).toFixed(2)} required`,
      };
    }

    let discountAmount = 0;
    let discountType: CheckoutPromoResult['discountType'] = 'FIXED';
    let label = `Coupon: ${coupon.code}`;

    if (coupon.type === 'PERCENTAGE') {
      discountType   = 'PERCENTAGE';
      discountAmount = (input.cartSubtotal * Number(coupon.value)) / 100;
      if (coupon.maxDiscount !== null) {
        discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
      }
      label = `${Number(coupon.value)}% off`;
    } else if (coupon.type === 'FIXED') {
      discountType   = 'FIXED';
      discountAmount = Math.min(Number(coupon.value), input.cartSubtotal);
      label          = `${input.currency} ${Number(coupon.value).toFixed(2)} off`;
    } else if (coupon.type === 'FREE_SHIPPING') {
      discountType   = 'FREE_SHIPPING';
      discountAmount = 0;
      label          = 'Free Shipping';
    }

    return { isValid: true, discountAmount, discountType, label };
  }
}
