import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Money } from '@/common/money/money';
import { ENGINE_METADATA, EngineMetadata } from '../engine-metadata';
import { IPricingEngine, PriceResolutionInput, PriceResolutionResult } from './pricing-engine.interface';

@Injectable()
export class DefaultPricingEngine implements IPricingEngine {
  readonly [ENGINE_METADATA]: EngineMetadata = {
    id:           'default-pricing-v1',
    name:         'Default Pricing Engine',
    version:      '1.0.0',
    capabilities: ['product-price', 'variant-price'],
  };

  constructor(private readonly prisma: PrismaService) {}

  async resolveOne(storeId: string, input: PriceResolutionInput, currency: string): Promise<PriceResolutionResult> {
    const [result] = await this.resolveBatch(storeId, [input], currency);
    return result!;
  }

  async resolveBatch(storeId: string, inputs: PriceResolutionInput[], currency: string): Promise<PriceResolutionResult[]> {
    return Promise.all(inputs.map(i => this.resolveInternal(storeId, i, currency)));
  }

  private async resolveInternal(storeId: string, input: PriceResolutionInput, currency: string): Promise<PriceResolutionResult> {
    if (input.variantId) {
      const variant = await this.prisma.productVariant.findFirst({
        where:  { id: input.variantId, productId: input.productId },
        select: { price: true, comparePrice: true },
      });
      return {
        productId:    input.productId,
        variantId:    input.variantId,
        unitPrice:    new Money(variant?.price.toString() ?? '0', currency),
        comparePrice: variant?.comparePrice ? new Money(variant.comparePrice.toString(), currency) : undefined,
        wasAdjusted:  false,
      };
    }

    const product = await this.prisma.product.findFirst({
      where:  { id: input.productId, storeId, deletedAt: null },
      select: { price: true, comparePrice: true },
    });
    return {
      productId:    input.productId,
      unitPrice:    new Money(product?.price.toString() ?? '0', currency),
      comparePrice: product?.comparePrice ? new Money(product.comparePrice.toString(), currency) : undefined,
      wasAdjusted:  false,
    };
  }
}
