import { InventorySource } from '@prisma/client';
import { ENGINE_METADATA, EngineMetadata } from '../engine-metadata';

export interface InventoryCheckInput {
  productId: string;
  variantId?: string;
  warehouseId?: string;
  requestedQuantity: number;
  inventorySource: InventorySource;
}

export interface InventoryCheckResult {
  productId: string;
  variantId?: string;
  available: number;
  reserved: number;
  requestedQuantity: number;
  isAvailable: boolean;
  adjustedQuantity?: number;
  outOfStock: boolean;
  lowStock: boolean;
  warehouseId?: string;
}

export interface IInventoryEngine {
  readonly [ENGINE_METADATA]: EngineMetadata;
  checkOne(storeId: string, input: InventoryCheckInput): Promise<InventoryCheckResult>;
  checkBatch(storeId: string, inputs: InventoryCheckInput[]): Promise<InventoryCheckResult[]>;
}
