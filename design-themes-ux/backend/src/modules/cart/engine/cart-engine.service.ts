import { Inject, Injectable } from '@nestjs/common';
import { Cart, CartItem } from '@prisma/client';

import { Money } from '../../../common/money/money';
import { ENGINE_RESOLVER, IEngineResolver } from '../resolver/engine-resolver.interface';
import { ValidationResult, ValidationIssue } from '../validation/cart-validation.types';
import { ENGINE_METADATA, EngineMetadata } from '../engines/engine-metadata';
import {
  CartItemResponseDto,
  CartTotalsDto,
  CartShippingEstimateDto,
  CartDebugDto,
} from '../dto/cart-response.dto';
import { InventoryCheckResult } from '../engines/inventory/inventory-engine.interface';
import { PriceResolutionResult } from '../engines/pricing/pricing-engine.interface';
import { EvalCart, EvalCartItem, PromotionResult } from '../engines/promotion/promotion-engine.interface';
import { ShippingEstimate } from '../engines/shipping/shipping-engine.interface';
import { TaxResult } from '../engines/tax/tax-engine.interface';

export interface CartEngineOutput {
  items:       CartItemResponseDto[];
  totals:      CartTotalsDto;
  shipping:    CartShippingEstimateDto;
  validation:  ValidationResult;
  _debug?:     CartDebugDto;
  pipelineDurationMs: number;
}

type CartWithItems = Cart & { items: CartItem[] };

@Injectable()
export class CartEngineService {
  constructor(
    @Inject(ENGINE_RESOLVER)
    private readonly engineResolver: IEngineResolver,
  ) {}

  async run(cart: CartWithItems, debugMode: boolean): Promise<CartEngineOutput> {
    const start       = Date.now();
    const engines     = await this.engineResolver.resolve(cart.storeId);
    const { storeId, currencyCode } = cart;

    // Stage 1 — Hydrate working item set
    const workingItems = cart.items.map((i) => ({ ...i }));

    // Stage 2 — Inventory Validation
    const invInputs = workingItems.map((i) => ({
      productId:         i.productId,
      variantId:         i.variantId ?? undefined,
      warehouseId:       i.warehouseId ?? undefined,
      requestedQuantity: i.quantity,
      inventorySource:   i.inventorySource,
    }));
    const invResults: InventoryCheckResult[] = await engines.inventory.checkBatch(storeId, invInputs);

    const issues: ValidationIssue[] = [];
    const adjustedItems = workingItems.filter((item, idx) => {
      const result = invResults[idx];
      if (!result) return true;
      if (result.outOfStock) {
        issues.push({ code: 'OUT_OF_STOCK', severity: 'BLOCKER', message: `${item.name} is out of stock`, itemId: item.id });
        return false;
      }
      if (!result.isAvailable && result.adjustedQuantity !== undefined) {
        issues.push({ code: 'INSUFFICIENT_STOCK', severity: 'WARNING', message: `${item.name}: only ${result.available} available`, itemId: item.id });
        item.quantity = result.adjustedQuantity;
      }
      if (result.lowStock) {
        issues.push({ code: 'LOW_STOCK', severity: 'INFO', message: `${item.name}: low stock`, itemId: item.id });
      }
      return true;
    });

    // Stage 3 — Price Resolution
    const priInputs = adjustedItems.map((i) => ({
      productId: i.productId,
      variantId: i.variantId ?? undefined,
      quantity:  i.quantity,
    }));
    const priResults: PriceResolutionResult[] = await engines.pricing.resolveBatch(storeId, priInputs, currencyCode);

    const itemToPrice = (item: CartItem, idx: number): Money => {
      const pr = priResults[idx];
      return pr?.unitPrice ?? new Money(item.unitPrice.toString(), currencyCode);
    };

    // Stage 4 — Build EvalCart + run Promotion Engine
    let subtotalBeforePromo = Money.ZERO(currencyCode);
    adjustedItems.forEach((item, idx) => {
      subtotalBeforePromo = subtotalBeforePromo.add(itemToPrice(item, idx).multiplyBy(item.quantity));
    });

    const evalCartItems: EvalCartItem[] = adjustedItems.map((item, idx) => {
      const unitPrice  = itemToPrice(item, idx);
      const lineTotal  = unitPrice.multiplyBy(item.quantity);
      const pr         = priResults[idx];
      let variantOptions: Record<string, string> | undefined;
      if (item.variantOptions) {
        try { variantOptions = JSON.parse(item.variantOptions) as Record<string, string>; } catch { /* ignored */ }
      }
      return {
        id:              item.id,
        productId:       item.productId,
        variantId:       item.variantId ?? undefined,
        sku:             item.sku,
        name:            item.name,
        brand:           item.brand ?? undefined,
        slug:            item.slug,
        image:           item.image,
        quantity:        item.quantity,
        unitPrice,
        comparePrice:    pr?.comparePrice,
        lineTotal,
        taxCategory:     item.taxCategory ?? undefined,
        hsn:             item.hsn ?? undefined,
        warehouseId:     item.warehouseId ?? undefined,
        inventorySource: item.inventorySource,
        variantOptions,
      };
    });

    const evalCart: EvalCart = {
      items:      evalCartItems,
      subtotal:   subtotalBeforePromo,
      currency:   currencyCode,
      couponCode: cart.couponCode ?? undefined,
    };
    const promotionResult: PromotionResult = await engines.promotion.evaluate(storeId, evalCart);

    // Stage 5 — Shipping Estimation
    const shippingResult: ShippingEstimate = await engines.shipping.estimate(storeId, {
      items:    adjustedItems.map((i) => ({
        productId: i.productId,
        variantId: i.variantId ?? undefined,
        quantity:  i.quantity,
        weight:    i.weight ? Number(i.weight) : undefined,
      })),
      subtotal: subtotalBeforePromo,
    });

    // Stage 6 — Tax Computation
    const taxResult: TaxResult = await engines.tax.compute(storeId, {
      items: evalCartItems.map((ei) => ({
        id:          ei.id,
        lineTotal:   ei.lineTotal,
        taxCategory: ei.taxCategory,
        hsn:         ei.hsn,
      })),
      subtotalAfterDiscount: subtotalBeforePromo,
      shippingCost:          shippingResult.cheapestCost,
      currency:              currencyCode,
    });

    // Stage 7 — Totals Assembly
    const { items: responseItems, totals } = this.assembleTotals(
      adjustedItems,
      evalCartItems,
      promotionResult,
      taxResult,
      shippingResult,
      currencyCode,
    );

    const validation: ValidationResult = {
      issues,
      hasBlockers: issues.some((i) => i.severity === 'BLOCKER'),
      isValid:     !issues.some((i) => i.severity === 'BLOCKER' || i.severity === 'ERROR'),
    };

    const pipelineDurationMs = Date.now() - start;
    const output: CartEngineOutput = {
      items: responseItems,
      totals,
      shipping: {
        available: shippingResult.available,
        methods:   shippingResult.methods.map((m) => ({
          id:            m.id,
          name:          m.name,
          cost:          m.cost.toApiNumber(),
          estimatedDays: m.estimatedDays ?? null,
        })),
      },
      validation,
      pipelineDurationMs,
    };

    if (debugMode) {
      output._debug = this.buildDebug(engines, pipelineDurationMs, issues);
    }

    return output;
  }

  private assembleTotals(
    items:       CartItem[],
    evalItems:   EvalCartItem[],
    promotions:  PromotionResult,
    tax:         TaxResult,
    shipping:    ShippingEstimate,
    currencyCode: string,
  ): { items: CartItemResponseDto[]; totals: CartTotalsDto } {
    let subtotal      = Money.ZERO(currencyCode);
    let totalDiscount = Money.ZERO(currencyCode);

    const responseItems: CartItemResponseDto[] = items.map((item, idx) => {
      const ei          = evalItems[idx];
      const unitPrice   = ei.unitPrice;
      const lineSubtotal = unitPrice.multiplyBy(item.quantity);
      const promoAmt    = promotions.lineDiscounts[item.id] ?? 0;
      const lineDiscount = new Money(promoAmt, currencyCode);
      const lineTotal    = lineSubtotal.subtract(lineDiscount);

      subtotal       = subtotal.add(lineSubtotal);
      totalDiscount  = totalDiscount.add(lineDiscount);

      let appliedPromotions: string[] | null = null;
      if (item.appliedPromotions) {
        try { appliedPromotions = JSON.parse(item.appliedPromotions) as string[]; } catch { /* ignored */ }
      }

      return {
        id:               item.id,
        productId:        item.productId,
        variantId:        item.variantId,
        quantity:         item.quantity,
        sku:              item.sku,
        name:             item.name,
        brand:            item.brand,
        slug:             item.slug,
        image:            item.image,
        unitPrice:        unitPrice.toApiNumber(),
        comparePrice:     ei.comparePrice?.toApiNumber() ?? null,
        lineDiscount:     lineDiscount.toApiNumber(),
        lineTotal:        lineTotal.toApiNumber(),
        taxCategory:      item.taxCategory,
        variantOptions:   ei.variantOptions ?? null,
        warehouseId:      item.warehouseId,
        appliedPromotions,
      };
    });

    const shippingMoney = shippingResult_cheapest(shipping, currencyCode);
    const taxMoney      = tax.totalTax;
    const grandTotal    = subtotal.subtract(totalDiscount).add(shippingMoney).add(taxMoney);

    return {
      items: responseItems,
      totals: {
        subtotal:      subtotal.toApiNumber(),
        totalDiscount: totalDiscount.toApiNumber(),
        shippingCost:  shippingMoney.toApiNumber(),
        taxAmount:     taxMoney.toApiNumber(),
        grandTotal:    grandTotal.toApiNumber(),
        currencyCode,
      },
    };
  }

  private buildDebug(
    engines: Awaited<ReturnType<IEngineResolver['resolve']>>,
    pipelineDurationMs: number,
    validationIssues: ValidationIssue[],
  ): CartDebugDto {
    const engineSet: Record<string, { id: string; name: string; version: string }> = {};
    for (const [slot, engine] of Object.entries(engines) as Array<[string, unknown]>) {
      const meta = (engine as { [ENGINE_METADATA]?: EngineMetadata })[ENGINE_METADATA];
      if (meta) engineSet[slot] = { id: meta.id, name: meta.name, version: meta.version };
    }
    return { engineSet, computedAt: new Date().toISOString(), pipelineDurationMs, validationIssues };
  }
}

function shippingResult_cheapest(shipping: ShippingEstimate, currencyCode: string): Money {
  return shipping.cheapestCost ?? Money.ZERO(currencyCode);
}
