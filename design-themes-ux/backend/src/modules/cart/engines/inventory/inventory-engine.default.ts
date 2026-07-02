import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ENGINE_METADATA, EngineMetadata } from '../engine-metadata';
import { IInventoryEngine, InventoryCheckInput, InventoryCheckResult } from './inventory-engine.interface';

const LOW_STOCK_THRESHOLD = 5;

@Injectable()
export class DefaultInventoryEngine implements IInventoryEngine {
  readonly [ENGINE_METADATA]: EngineMetadata = {
    id:           'default-inventory-v1',
    name:         'Default Inventory Engine',
    version:      '1.0.0',
    capabilities: ['product-stock', 'variant-stock', 'warehouse-stock'],
  };

  constructor(private readonly prisma: PrismaService) {}

  async checkOne(storeId: string, input: InventoryCheckInput): Promise<InventoryCheckResult> {
    const [result] = await this.checkBatch(storeId, [input]);
    return result!;
  }

  async checkBatch(storeId: string, inputs: InventoryCheckInput[]): Promise<InventoryCheckResult[]> {
    return Promise.all(inputs.map(i => this.checkSingle(storeId, i)));
  }

  private async checkSingle(storeId: string, input: InventoryCheckInput): Promise<InventoryCheckResult> {
    let available = 0;
    let reserved  = 0;

    if (input.inventorySource === 'WAREHOUSE' && input.warehouseId) {
      const ws = await this.prisma.warehouseStock.findUnique({
        where: { warehouseId_productId: { warehouseId: input.warehouseId, productId: input.productId } },
        select: { stock: true, reserved: true },
      });
      available = ws?.stock   ?? 0;
      reserved  = ws?.reserved ?? 0;

    } else if ((input.inventorySource === 'VARIANT') && input.variantId) {
      const variant = await this.prisma.productVariant.findFirst({
        where:  { id: input.variantId, productId: input.productId },
        select: { stock: true },
      });
      available = variant?.stock ?? 0;

    } else {
      const product = await this.prisma.product.findFirst({
        where:  { id: input.productId, storeId, deletedAt: null },
        select: { stock: true, trackInventory: true },
      });
      if (!product?.trackInventory) {
        return this.virtualResult(input);
      }
      available = product?.stock ?? 0;
    }

    const effective   = Math.max(0, available - reserved);
    const isAvailable = effective >= input.requestedQuantity;

    return {
      productId:         input.productId,
      variantId:         input.variantId,
      available:         effective,
      reserved,
      requestedQuantity: input.requestedQuantity,
      isAvailable,
      adjustedQuantity:  isAvailable ? undefined : effective,
      outOfStock:        effective === 0,
      lowStock:          effective > 0 && effective <= LOW_STOCK_THRESHOLD,
      warehouseId:       input.warehouseId,
    };
  }

  private virtualResult(input: InventoryCheckInput): InventoryCheckResult {
    return {
      productId:         input.productId,
      variantId:         input.variantId,
      available:         9999,
      reserved:          0,
      requestedQuantity: input.requestedQuantity,
      isAvailable:       true,
      outOfStock:        false,
      lowStock:          false,
      warehouseId:       input.warehouseId,
    };
  }
}
