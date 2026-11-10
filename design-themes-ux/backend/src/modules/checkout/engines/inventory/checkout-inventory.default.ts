import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { InventoryReservationService, stockLineKey } from '../../../../shared/inventory/inventory-reservation.service';
import {
  ICheckoutInventoryEngine,
  CheckoutInventoryInput,
  CheckoutInventoryResult,
} from './checkout-inventory.interface';

@Injectable()
export class DefaultCheckoutInventoryEngine implements ICheckoutInventoryEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: InventoryReservationService,
  ) {}

  async validateBatch(
    storeId:     string,
    inputs:      CheckoutInventoryInput[],
    checkoutId?: string,
  ): Promise<CheckoutInventoryResult[]> {
    const held = checkoutId ? await this.reservations.heldByCheckout(checkoutId) : new Map<string, number>();
    return Promise.all(inputs.map((input) =>
      this.validateOne(storeId, input, held.get(stockLineKey(input.productId, input.variantId)) ?? 0)));
  }

  private async validateOne(
    storeId: string,
    input:   CheckoutInventoryInput,
    heldByThisCheckout: number,
  ): Promise<CheckoutInventoryResult> {
    const product = await this.prisma.product.findFirst({
      where:   { id: input.productId, storeId, deletedAt: null },
      select:  { id: true, stock: true, price: true, status: true },
    });

    if (!product || product.status !== 'ACTIVE') {
      return {
        itemId:            input.itemId,
        productId:         input.productId,
        isAvailable:       false,
        availableQuantity: 0,
        isOutOfStock:      true,
        isLowStock:        false,
        priceChanged:      false,
        issue:             'PRODUCT_DISABLED',
        message:           'Product is no longer available',
      };
    }

    if (input.variantId) {
      const variant = await this.prisma.productVariant.findFirst({
        where:  { id: input.variantId, productId: input.productId },
        select: { id: true, stock: true, price: true },
      });

      if (!variant) {
        return {
          itemId:            input.itemId,
          productId:         input.productId,
          isAvailable:       false,
          availableQuantity: 0,
          isOutOfStock:      true,
          isLowStock:        false,
          priceChanged:      false,
          issue:             'VARIANT_DELETED',
          message:           'Product variant is no longer available',
        };
      }

      const available  = variant.stock + heldByThisCheckout;
      const isOos      = available <= 0;
      const isLow      = available > 0 && available < 5;
      const adjQty     = isOos ? 0 : Math.min(input.requestedQuantity, available);
      const currentPrice = Number(variant.price);
      const priceChanged = Math.abs(currentPrice - input.unitPrice) > 0.01;

      return {
        itemId:            input.itemId,
        productId:         input.productId,
        isAvailable:       !isOos && available >= input.requestedQuantity,
        availableQuantity: available,
        adjustedQuantity:  adjQty < input.requestedQuantity ? adjQty : undefined,
        isOutOfStock:      isOos,
        isLowStock:        isLow,
        priceChanged,
        currentUnitPrice:  priceChanged ? currentPrice : undefined,
        issue:             isOos ? 'OUT_OF_STOCK'
                         : adjQty < input.requestedQuantity ? 'INSUFFICIENT_STOCK'
                         : priceChanged ? 'PRICE_CHANGED'
                         : undefined,
      };
    }

    const available    = product.stock + heldByThisCheckout;
    const isOos        = available <= 0;
    const isLow        = available > 0 && available < 5;
    const adjQty       = isOos ? 0 : Math.min(input.requestedQuantity, available);
    const currentPrice = Number(product.price);
    const priceChanged = Math.abs(currentPrice - input.unitPrice) > 0.01;

    return {
      itemId:            input.itemId,
      productId:         input.productId,
      isAvailable:       !isOos && available >= input.requestedQuantity,
      availableQuantity: available,
      adjustedQuantity:  adjQty < input.requestedQuantity ? adjQty : undefined,
      isOutOfStock:      isOos,
      isLowStock:        isLow,
      priceChanged,
      currentUnitPrice:  priceChanged ? currentPrice : undefined,
      issue:             isOos ? 'OUT_OF_STOCK'
                       : adjQty < input.requestedQuantity ? 'INSUFFICIENT_STOCK'
                       : priceChanged ? 'PRICE_CHANGED'
                       : undefined,
    };
  }
}
