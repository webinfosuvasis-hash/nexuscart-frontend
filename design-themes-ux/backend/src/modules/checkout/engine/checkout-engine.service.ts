import { Inject, Injectable } from '@nestjs/common';
import { Cart, CartItem, CheckoutSession, CheckoutAddressSnapshot, AddressType } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

import { CheckoutConfig, CHECKOUT_CONFIG_KEY } from '../checkout.config';
import { CHECKOUT_INVENTORY_ENGINE, CHECKOUT_PROMOTION_ENGINE, CHECKOUT_SHIPPING_ENGINE, CHECKOUT_TAX_ENGINE } from '../engines/checkout-engine-tokens';
import { ICheckoutInventoryEngine } from '../engines/inventory/checkout-inventory.interface';
import { ICheckoutPromotionEngine } from '../engines/promotion/checkout-promotion.interface';
import { ICheckoutShippingEngine, CheckoutShippingMethod } from '../engines/shipping/checkout-shipping.interface';
import { ICheckoutTaxEngine } from '../engines/tax/checkout-tax.interface';
import {
  CheckoutSessionResponseDto,
  CheckoutItemDto,
  CheckoutTotalsDto,
  CheckoutValidationResultDto,
  CheckoutAddressDto,
  CheckoutPromoSummaryDto,
} from '../dto/checkout-response.dto';

type CheckoutWithRelations = CheckoutSession & {
  addresses: CheckoutAddressSnapshot[];
};

type CartWithItems = Cart & { items: CartItem[] };

interface PipelineIssue {
  code:     string;
  severity: 'BLOCKER' | 'ERROR' | 'WARNING' | 'INFO';
  message:  string;
  itemId?:  string;
}

export interface CheckoutEngineOutput {
  items:              CheckoutItemDto[];
  totals:             CheckoutTotalsDto;
  availableShippingMethods: CheckoutSessionResponseDto['availableShippingMethods'];
  selectedShippingMethod:   CheckoutSessionResponseDto['selectedShippingMethod'];
  taxBreakdown:       CheckoutSessionResponseDto['taxBreakdown'];
  appliedPromotion:   CheckoutPromoSummaryDto | null;
  validation:         CheckoutValidationResultDto;
  warnings:           string[];
  pipelineDurationMs: number;
  _debug?: CheckoutSessionResponseDto['_debug'];
}

@Injectable()
export class CheckoutEngineService {
  constructor(
    @Inject(CHECKOUT_INVENTORY_ENGINE) private readonly inventory: ICheckoutInventoryEngine,
    @Inject(CHECKOUT_PROMOTION_ENGINE) private readonly promotion: ICheckoutPromotionEngine,
    @Inject(CHECKOUT_SHIPPING_ENGINE)  private readonly shipping:  ICheckoutShippingEngine,
    @Inject(CHECKOUT_TAX_ENGINE)       private readonly tax:       ICheckoutTaxEngine,
    private readonly configSvc: ConfigService,
  ) {}

  private get cfg(): CheckoutConfig {
    return this.configSvc.get<CheckoutConfig>(CHECKOUT_CONFIG_KEY)!;
  }

  async run(
    checkout:  CheckoutWithRelations,
    cart:      CartWithItems,
    debugMode: boolean,
  ): Promise<CheckoutEngineOutput> {
    const start    = Date.now();
    const issues:  PipelineIssue[] = [];
    const warnings: string[]       = [];
    const currency = cart.currencyCode;
    const storeId  = checkout.storeId;

    // Stage 1 — Validate cart state
    if (cart.items.length === 0) {
      issues.push({ code: 'EMPTY_CART', severity: 'BLOCKER', message: 'Cart is empty' });
    }

    if (cart.version !== checkout.cartVersion) {
      issues.push({ code: 'CART_CHANGED', severity: 'BLOCKER', message: 'Cart was modified after checkout started — please restart checkout' });
    }

    // Stage 2 — Inventory re-validation
    const invInputs = cart.items.map((i) => ({
      itemId:            i.id,
      productId:         i.productId,
      variantId:         i.variantId ?? undefined,
      warehouseId:       i.warehouseId ?? undefined,
      requestedQuantity: i.quantity,
      inventorySource:   i.inventorySource,
      unitPrice:         Number(i.unitPrice),
    }));

    const invResults = await this.inventory.validateBatch(storeId, invInputs);

    for (const r of invResults) {
      if (r.isOutOfStock) {
        issues.push({ code: 'OUT_OF_STOCK', severity: 'BLOCKER', message: r.message ?? `Item is out of stock`, itemId: r.itemId });
      } else if (r.issue === 'INSUFFICIENT_STOCK') {
        issues.push({ code: 'INSUFFICIENT_STOCK', severity: 'WARNING', message: r.message ?? `Insufficient stock`, itemId: r.itemId });
        warnings.push(`Quantity adjusted for ${r.itemId}`);
      } else if (r.issue === 'PRICE_CHANGED') {
        issues.push({ code: 'PRICE_CHANGED', severity: 'WARNING', message: r.message ?? `Price changed`, itemId: r.itemId });
        warnings.push(`Price changed for item ${r.itemId}`);
      } else if (r.issue === 'PRODUCT_DISABLED') {
        issues.push({ code: 'PRODUCT_DISABLED', severity: 'BLOCKER', message: r.message ?? `Product unavailable`, itemId: r.itemId });
      } else if (r.issue === 'VARIANT_DELETED') {
        issues.push({ code: 'VARIANT_DELETED', severity: 'BLOCKER', message: r.message ?? `Variant unavailable`, itemId: r.itemId });
      }
      if (r.isLowStock) {
        warnings.push(`Low stock for item ${r.itemId}`);
      }
    }

    const invMap = new Map(invResults.map((r) => [r.itemId, r]));

    // Stage 3 — Build working items (use adjusted qty where applicable)
    const workingItems: CheckoutItemDto[] = cart.items.map((item) => {
      const inv = invMap.get(item.id);
      const qty = inv?.adjustedQuantity ?? item.quantity;
      const unitP = Number(item.unitPrice);
      const discount = Number(item.lineDiscount);
      const lineTotal = unitP * qty - discount;

      let variantOpts: Record<string, string> | null = null;
      if (item.variantOptions) {
        try { variantOpts = JSON.parse(item.variantOptions) as Record<string, string>; } catch { /* ignored */ }
      }

      return {
        id:              item.id,
        productId:       item.productId,
        variantId:       item.variantId,
        sku:             item.sku,
        name:            item.name,
        brand:           item.brand,
        image:           item.image,
        quantity:        qty,
        unitPrice:       unitP,
        lineDiscount:    discount,
        lineTotal:       round2(lineTotal),
        taxAmount:       0,
        taxCategory:     item.taxCategory,
        variantOptions:  variantOpts,
        hasStockWarning: inv?.issue === 'INSUFFICIENT_STOCK' || inv?.isLowStock || false,
        hasPriceWarning: inv?.issue === 'PRICE_CHANGED' || false,
      };
    });

    // Stage 4 — Subtotal
    let subtotal = 0;
    for (const i of workingItems) subtotal += i.lineTotal;

    // Stage 5 — Promotion validation
    let appliedPromotion: CheckoutPromoSummaryDto | null = null;
    let promotionDiscount = 0;
    let promoFreeShipping = false;

    if (cart.couponCode) {
      const promoResult = await this.promotion.validate({
        couponCode:   cart.couponCode,
        cartSubtotal: subtotal,
        currency,
        customerId:   checkout.customerId ?? undefined,
        storeId,
      });

      if (promoResult.isValid) {
        promotionDiscount = promoResult.discountAmount;
        promoFreeShipping = promoResult.discountType === 'FREE_SHIPPING';
        appliedPromotion = {
          code:           cart.couponCode,
          label:          promoResult.label,
          discountAmount: promoResult.discountAmount,
          discountType:   promoResult.discountType,
        };
      } else {
        issues.push({ code: 'PROMOTION_INVALID', severity: 'WARNING', message: promoResult.message ?? `Coupon ${cart.couponCode} is no longer valid` });
        warnings.push(`Promotion ${cart.couponCode} failed: ${promoResult.failureReason}`);
      }
    }

    const subtotalAfterPromo = Math.max(0, subtotal - promotionDiscount);

    // Stage 6 — Shipping
    const shippingAddr = checkout.addresses.find((a) => a.type === AddressType.SHIPPING);
    const shippingInput = {
      items:    workingItems.map((i) => ({ productId: i.productId, variantId: i.variantId ?? undefined, quantity: i.quantity })),
      address:  shippingAddr
                  ? { postalCode: shippingAddr.postalCode, city: shippingAddr.city, state: shippingAddr.state, country: shippingAddr.country }
                  : undefined,
      subtotal: promoFreeShipping ? 1_000_000 : subtotalAfterPromo,
      currency,
      freeShippingThreshold: this.cfg.freeShippingThreshold,
    };

    const shippingResult = await this.shipping.listMethods(storeId, shippingInput);
    const availableMethods = shippingResult.methods;

    let selectedMethod: CheckoutShippingMethod | null = null;
    if (checkout.selectedShippingMethodId) {
      selectedMethod = availableMethods.find((m) => m.id === checkout.selectedShippingMethodId) ?? null;
      if (!selectedMethod) {
        warnings.push(`Selected shipping method ${checkout.selectedShippingMethodId} is no longer available`);
      }
    }
    const shippingCost = selectedMethod?.cost ?? (promoFreeShipping ? 0 : (availableMethods[0]?.cost ?? 0));

    // Stage 7 — Tax
    const deliveryState = shippingAddr?.state ?? null;
    const taxResult = await this.tax.compute(storeId, {
      items: workingItems.map((i) => ({
        itemId:      i.id,
        lineTotal:   i.lineTotal,
        taxCategory: i.taxCategory ?? undefined,
        hsn:         undefined,
      })),
      shippingCost,
      currency,
      deliveryState: deliveryState ?? undefined,
      storeState:    this.cfg.storeStateCode,
    });

    // Stage 8 — Apply per-item tax amounts
    for (const item of workingItems) {
      item.taxAmount = taxResult.lineTaxes[item.id] ?? 0;
    }

    // Stage 9 — Assemble totals
    const totalDiscount = 0;
    const grandTotal    = subtotalAfterPromo + shippingCost + taxResult.totalTax;

    const totals: CheckoutTotalsDto = {
      subtotal:          round2(subtotal),
      totalDiscount:     round2(totalDiscount),
      promotionDiscount: round2(promotionDiscount),
      shippingCost:      round2(shippingCost),
      taxAmount:         round2(taxResult.totalTax),
      grandTotal:        round2(grandTotal),
      currencyCode:      currency,
    };

    const validation: CheckoutValidationResultDto = {
      isValid:     !issues.some((i) => i.severity === 'BLOCKER' || i.severity === 'ERROR'),
      hasBlockers: issues.some((i) => i.severity === 'BLOCKER'),
      issues:      issues.map((i) => ({ code: i.code, severity: i.severity, message: i.message, itemId: i.itemId })),
    };

    const pipelineDurationMs = Date.now() - start;

    const output: CheckoutEngineOutput = {
      items:                    workingItems,
      totals,
      availableShippingMethods: availableMethods.map((m) => ({ ...m, description: m.description ?? null, isSelected: m.id === checkout.selectedShippingMethodId })),
      selectedShippingMethod:   selectedMethod ? { ...selectedMethod, description: selectedMethod.description ?? null, isSelected: true } : null,
      taxBreakdown:             taxResult.breakdown,
      appliedPromotion,
      validation,
      warnings,
      pipelineDurationMs,
    };

    if (debugMode) {
      output._debug = {
        pipelineDurationMs,
        computedAt:    new Date().toISOString(),
        storeState:    this.cfg.storeStateCode,
        deliveryState,
        taxType:       taxResult.taxType,
      };
    }

    return output;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
