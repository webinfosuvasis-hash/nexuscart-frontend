import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CartStatus, InventorySource } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CartEngineService } from './engine/cart-engine.service';
import { CartEventBus } from './events/cart-event-bus.service';
import {
  CartCreatedEvent,
  ItemAddedEvent,
  ItemRemovedEvent,
  QtyUpdatedEvent,
  CartClearedEvent,
  CartMergedEvent,
  CartLockedEvent,
  CartUnlockedEvent,
  PromotionAppliedEvent,
  PromotionRemovedEvent,
} from './events/cart.events';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { ApplyPromotionDto } from './dto/apply-promotion.dto';
import { CartResponseDto, CartActivityResponseDto } from './dto/cart-response.dto';
import { CartConfig, CART_CONFIG_KEY } from './cart.config';
import { Request } from 'express';

interface CartContext {
  storeId:      string;
  sessionId:    string;
  customerId?:  string | null;
  traceId?:     string | null;
  spanId?:      string | null;
  correlationId?: string | null;
  requestId?:   string | null;
  ipAddress?:   string | null;
  userAgent?:   string | null;
}

function ctxFromReq(req: Request): CartContext {
  return {
    storeId:      req.storeId      ?? 'default',
    sessionId:    req.cartSessionId ?? 'unknown',
    customerId:   (req as any).customerId ?? null,
    traceId:      req.traceId      ?? null,
    spanId:       req.spanId       ?? null,
    correlationId: req.correlationId ?? null,
    requestId:    req.requestId    ?? null,
    ipAddress:    req.ip ?? null,
    userAgent:    req.headers['user-agent'] ?? null,
  };
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private readonly prisma:     PrismaService,
    private readonly engine:     CartEngineService,
    private readonly eventBus:   CartEventBus,
    private readonly configSvc:  ConfigService,
  ) {}

  private get cfg(): CartConfig {
    return this.configSvc.get<CartConfig>(CART_CONFIG_KEY)!;
  }

  // ─── GET CART ──────────────────────────────────────────────────────────────

  async getCart(req: Request): Promise<CartResponseDto> {
    const ctx   = ctxFromReq(req);
    const cart  = await this.findOrCreate(ctx);
    const items = await this.prisma.cartItem.findMany({ where: { cartId: cart.id } });

    const engineOutput = await this.engine.run(
      { ...cart, items },
      this.cfg.debugMode,
    );

    return this.buildResponse(cart, engineOutput);
  }

  // ─── ADD ITEM ──────────────────────────────────────────────────────────────

  async addItem(dto: AddCartItemDto, req: Request): Promise<CartResponseDto> {
    const ctx  = ctxFromReq(req);
    const cart = await this.findOrCreate(ctx);

    const product = await this.prisma.product.findFirst({
      where:   { id: dto.productId, storeId: ctx.storeId },
      include: {
        variants: { where: dto.variantId ? { id: dto.variantId } : undefined },
        brand:    { select: { name: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    const variant = dto.variantId
      ? (product.variants.find((v) => v.id === dto.variantId) ?? null)
      : null;
    if (dto.variantId && !variant) throw new NotFoundException('Variant not found');

    const unitPrice  = variant?.price ?? product.price;
    const comparePrice = variant?.comparePrice ?? product.comparePrice;
    const sku        = variant?.sku   ?? product.sku;
    const image      = (variant as { image?: string } | null)?.image ?? product.thumbnail ?? '';

    // Upsert: if same product+variant already in cart, increment quantity
    const existing = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId: dto.productId, variantId: dto.variantId ?? null },
    });

    if (existing) {
      const newQty = Math.min(existing.quantity + dto.quantity, 100);
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data:  { quantity: newQty, updatedAt: new Date() },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId:          cart.id,
          storeId:         ctx.storeId,
          productId:       dto.productId,
          variantId:       dto.variantId ?? null,
          quantity:        dto.quantity,
          sku,
          name:            product.name,
          brand:           product.brand?.name ?? null,
          slug:            product.slug,
          seoUrl:          null,
          image,
          unitPrice,
          comparePrice:    comparePrice ?? null,
          taxCategory:     (product as { taxCategory?: string }).taxCategory ?? null,
          hsn:             (product as { hsn?: string }).hsn ?? null,
          gstClass:        (product as { gstClass?: string }).gstClass ?? null,
          weight:          (product as { weight?: unknown }).weight != null
                             ? Number((product as { weight?: unknown }).weight)
                             : null,
          dimensions:      null,
          variantOptions:  (variant as { options?: string | null } | null)?.options ?? null,
          warehouseId:     dto.warehouseId ?? null,
          inventorySource: variant ? InventorySource.VARIANT : InventorySource.PRODUCT,
          lineDiscount:    0,
        },
      });
    }

    await this.bumpVersion(cart.id);
    this.eventBus.emit(new ItemAddedEvent(
      { productId: dto.productId, variantId: dto.variantId, quantity: dto.quantity },
      cart.id, ctx.storeId, ctx.sessionId,
      ctx.traceId ?? null, ctx.spanId ?? null, ctx.correlationId ?? null, ctx.requestId ?? null,
      ctx.ipAddress ?? null, ctx.userAgent ?? null,
    ));

    return this.getCart(req);
  }

  // ─── UPDATE ITEM QTY ───────────────────────────────────────────────────────

  async updateItem(itemId: string, dto: UpdateCartItemDto, req: Request): Promise<CartResponseDto> {
    const ctx  = ctxFromReq(req);
    const cart = await this.requireActiveCart(ctx);
    const item = await this.requireCartItem(itemId, cart.id);

    if (dto.quantity === 0) {
      return this.removeItem(itemId, req);
    }

    const cappedQty = Math.min(dto.quantity, 100);
    await this.prisma.cartItem.update({
      where: { id: item.id },
      data:  { quantity: cappedQty },
    });

    await this.bumpVersion(cart.id);
    this.eventBus.emit(new QtyUpdatedEvent(
      { itemId, quantity: cappedQty, previousQuantity: item.quantity },
      cart.id, ctx.storeId, ctx.sessionId,
      ctx.traceId ?? null, ctx.spanId ?? null, ctx.correlationId ?? null, ctx.requestId ?? null,
      ctx.ipAddress ?? null, ctx.userAgent ?? null,
    ));

    return this.getCart(req);
  }

  // ─── REMOVE ITEM ───────────────────────────────────────────────────────────

  async removeItem(itemId: string, req: Request): Promise<CartResponseDto> {
    const ctx  = ctxFromReq(req);
    const cart = await this.requireActiveCart(ctx);
    const item = await this.requireCartItem(itemId, cart.id);

    await this.prisma.cartItem.delete({ where: { id: item.id } });
    await this.bumpVersion(cart.id);

    this.eventBus.emit(new ItemRemovedEvent(
      { itemId, productId: item.productId, variantId: item.variantId },
      cart.id, ctx.storeId, ctx.sessionId,
      ctx.traceId ?? null, ctx.spanId ?? null, ctx.correlationId ?? null, ctx.requestId ?? null,
      ctx.ipAddress ?? null, ctx.userAgent ?? null,
    ));

    return this.getCart(req);
  }

  // ─── CLEAR CART ────────────────────────────────────────────────────────────

  async clearCart(req: Request): Promise<CartResponseDto> {
    const ctx  = ctxFromReq(req);
    const cart = await this.requireActiveCart(ctx);

    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await this.bumpVersion(cart.id);

    this.eventBus.emit(new CartClearedEvent(
      {},
      cart.id, ctx.storeId, ctx.sessionId,
      ctx.traceId ?? null, ctx.spanId ?? null, ctx.correlationId ?? null, ctx.requestId ?? null,
      ctx.ipAddress ?? null, ctx.userAgent ?? null,
    ));

    return this.getCart(req);
  }

  // ─── MERGE CART ────────────────────────────────────────────────────────────

  async mergeCarts(guestCartId: string, req: Request): Promise<CartResponseDto> {
    const ctx  = ctxFromReq(req);
    const dest = await this.findOrCreate(ctx);

    const guest = await this.prisma.cart.findFirst({
      where:   { id: guestCartId, storeId: ctx.storeId },
      include: { items: true },
    });
    if (!guest) throw new NotFoundException('Guest cart not found');
    if (guest.id === dest.id) throw new BadRequestException('Cannot merge cart into itself');
    if (guest.status !== CartStatus.ACTIVE) {
      throw new ForbiddenException(`Guest cart is ${guest.status.toLowerCase()}`);
    }

    for (const guestItem of guest.items) {
      const existing = await this.prisma.cartItem.findFirst({
        where: { cartId: dest.id, productId: guestItem.productId, variantId: guestItem.variantId },
      });
      if (existing) {
        const newQty = Math.min(existing.quantity + guestItem.quantity, 100);
        await this.prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: newQty } });
      } else {
        const { id: _id, cartId: _cartId, createdAt: _c, updatedAt: _u, ...rest } = guestItem;
        await this.prisma.cartItem.create({ data: { ...rest, cartId: dest.id } });
      }
    }

    // Mark guest as MERGED with optimistic lock
    const result = await this.prisma.cart.updateMany({
      where: { id: guest.id, version: guest.version },
      data:  { status: CartStatus.MERGED, mergedIntoCartId: dest.id },
    });
    if (result.count === 0) throw new ConflictException('Cart was modified concurrently');

    await this.bumpVersion(dest.id);
    this.eventBus.emit(new CartMergedEvent(
      { guestCartId, destCartId: dest.id },
      dest.id, ctx.storeId, ctx.sessionId,
      ctx.traceId ?? null, ctx.spanId ?? null, ctx.correlationId ?? null, ctx.requestId ?? null,
      ctx.ipAddress ?? null, ctx.userAgent ?? null,
    ));

    return this.getCart(req);
  }

  // ─── APPLY PROMOTION ───────────────────────────────────────────────────────

  async applyPromotion(dto: ApplyPromotionDto, req: Request): Promise<CartResponseDto> {
    const ctx  = ctxFromReq(req);
    const cart = await this.requireActiveCart(ctx);

    await this.prisma.cart.update({
      where: { id: cart.id },
      data:  { couponCode: dto.code },
    });

    await this.bumpVersion(cart.id);
    this.eventBus.emit(new PromotionAppliedEvent(
      { code: dto.code },
      cart.id, ctx.storeId, ctx.sessionId,
      ctx.traceId ?? null, ctx.spanId ?? null, ctx.correlationId ?? null, ctx.requestId ?? null,
      ctx.ipAddress ?? null, ctx.userAgent ?? null,
    ));

    return this.getCart(req);
  }

  // ─── REMOVE PROMOTION ──────────────────────────────────────────────────────

  async removePromotion(code: string, req: Request): Promise<CartResponseDto> {
    const ctx  = ctxFromReq(req);
    const cart = await this.requireActiveCart(ctx);

    if (cart.couponCode !== code) {
      throw new NotFoundException('Promotion code not applied to this cart');
    }

    await this.prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
    await this.bumpVersion(cart.id);

    this.eventBus.emit(new PromotionRemovedEvent(
      { code },
      cart.id, ctx.storeId, ctx.sessionId,
      ctx.traceId ?? null, ctx.spanId ?? null, ctx.correlationId ?? null, ctx.requestId ?? null,
      ctx.ipAddress ?? null, ctx.userAgent ?? null,
    ));

    return this.getCart(req);
  }

  // ─── LOCK CART ─────────────────────────────────────────────────────────────

  async lockCart(req: Request): Promise<CartResponseDto> {
    const ctx  = ctxFromReq(req);
    const cart = await this.requireActiveCart(ctx);

    const lockedUntil = new Date(Date.now() + this.cfg.lockTimeoutMinutes * 60_000);
    const result = await this.prisma.cart.updateMany({
      where: { id: cart.id, version: cart.version },
      data:  { status: CartStatus.LOCKED, lockedAt: new Date(), lockedUntil },
    });
    if (result.count === 0) throw new ConflictException('Cart was modified concurrently');

    this.eventBus.emit(new CartLockedEvent(
      { lockedUntil: lockedUntil.toISOString() },
      cart.id, ctx.storeId, ctx.sessionId,
      ctx.traceId ?? null, ctx.spanId ?? null, ctx.correlationId ?? null, ctx.requestId ?? null,
      ctx.ipAddress ?? null, ctx.userAgent ?? null,
    ));

    return this.getCart(req);
  }

  // ─── UNLOCK CART ───────────────────────────────────────────────────────────

  async unlockCart(req: Request): Promise<CartResponseDto> {
    const ctx  = ctxFromReq(req);
    const cart = await this.findActiveOrLockedCart(ctx);

    if (!cart) throw new NotFoundException('No cart found for this session');
    if (cart.status !== CartStatus.LOCKED) {
      throw new BadRequestException('Cart is not locked');
    }

    const result = await this.prisma.cart.updateMany({
      where: { id: cart.id, version: cart.version },
      data:  { status: CartStatus.ACTIVE, lockedAt: null, lockedUntil: null },
    });
    if (result.count === 0) throw new ConflictException('Cart was modified concurrently');

    this.eventBus.emit(new CartUnlockedEvent(
      { reason: 'manual' },
      cart.id, ctx.storeId, ctx.sessionId,
      ctx.traceId ?? null, ctx.spanId ?? null, ctx.correlationId ?? null, ctx.requestId ?? null,
      ctx.ipAddress ?? null, ctx.userAgent ?? null,
    ));

    return this.getCart(req);
  }

  // ─── GET ACTIVITY ──────────────────────────────────────────────────────────

  async getActivity(req: Request): Promise<CartActivityResponseDto[]> {
    const ctx  = ctxFromReq(req);
    const cart = await this.prisma.cart.findFirst({
      where:  {
        storeId:   ctx.storeId,
        sessionId: ctx.sessionId,
        status:    { in: [CartStatus.ACTIVE, CartStatus.LOCKED] },
      },
      select: { id: true },
    });
    if (!cart) return [];

    const activities = await this.prisma.cartActivity.findMany({
      where:   { cartId: cart.id },
      orderBy: { createdAt: 'desc' },
      take:    50,
      select:  { id: true, activityType: true, actorType: true, actorId: true, payload: true, createdAt: true },
    });

    return activities.map((a) => ({
      id:           a.id,
      activityType: a.activityType,
      actorType:    a.actorType,
      actorId:      a.actorId,
      payload:      a.payload as Record<string, unknown>,
      createdAt:    a.createdAt.toISOString(),
    }));
  }

  // ─── INTERNALS ─────────────────────────────────────────────────────────────

  private async findOrCreate(ctx: CartContext) {
    const existing = await this.prisma.cart.findFirst({
      where: {
        storeId:   ctx.storeId,
        sessionId: ctx.sessionId,
        status:    { in: [CartStatus.ACTIVE, CartStatus.LOCKED] },
      },
    });
    if (existing) {
      const thresholdMs = this.cfg.readThresholdMinutes * 60_000;
      if (Date.now() - existing.lastActivityAt.getTime() > thresholdMs) {
        await this.prisma.cart.update({
          where: { id: existing.id },
          data:  { lastActivityAt: new Date() },
        });
      }
      return existing;
    }

    let cart: Awaited<ReturnType<typeof this.prisma.cart.create>>;
    try {
      cart = await this.prisma.cart.create({
        data: {
          storeId:    ctx.storeId,
          sessionId:  ctx.sessionId,
          customerId: ctx.customerId ?? null,
          status:     CartStatus.ACTIVE,
        },
      });
    } catch {
      // Race condition: another concurrent request created the cart first.
      // Re-query and return that cart rather than surfacing a DB error.
      const raceCart = await this.prisma.cart.findFirst({
        where: {
          storeId:   ctx.storeId,
          sessionId: ctx.sessionId,
          status:    { in: [CartStatus.ACTIVE, CartStatus.LOCKED] },
        },
      });
      if (raceCart) return raceCart;
      throw new Error('Failed to create or retrieve cart');
    }

    this.eventBus.emit(new CartCreatedEvent(
      {},
      cart.id, ctx.storeId, ctx.sessionId,
      ctx.traceId ?? null, ctx.spanId ?? null, ctx.correlationId ?? null, ctx.requestId ?? null,
      ctx.ipAddress ?? null, ctx.userAgent ?? null,
    ));

    return cart;
  }

  private async requireActiveCart(ctx: CartContext) {
    const cart = await this.prisma.cart.findFirst({
      where: { storeId: ctx.storeId, sessionId: ctx.sessionId, status: CartStatus.ACTIVE },
    });
    if (!cart) throw new NotFoundException('Active cart not found');
    return cart;
  }

  private async findActiveOrLockedCart(ctx: CartContext) {
    return this.prisma.cart.findFirst({
      where: {
        storeId:   ctx.storeId,
        sessionId: ctx.sessionId,
        status:    { in: [CartStatus.ACTIVE, CartStatus.LOCKED] },
      },
    });
  }

  private async requireCartItem(itemId: string, cartId: string) {
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cartId } });
    if (!item) throw new NotFoundException('Cart item not found');
    return item;
  }

  private async bumpVersion(cartId: string): Promise<void> {
    await this.prisma.cart.update({
      where: { id: cartId },
      data:  { version: { increment: 1 }, lastActivityAt: new Date() },
    });
  }

  private buildResponse(
    cart: Awaited<ReturnType<typeof this.findOrCreate>>,
    engineOutput: Awaited<ReturnType<CartEngineService['run']>>,
  ): CartResponseDto {
    return {
      id:             cart.id,
      storeId:        cart.storeId,
      sessionId:      cart.sessionId,
      customerId:     cart.customerId,
      status:         cart.status,
      version:        cart.version,
      currencyCode:   cart.currencyCode,
      locale:         cart.locale,
      couponCode:     cart.couponCode,
      items:          engineOutput.items,
      totals:         engineOutput.totals,
      shipping:       engineOutput.shipping,
      itemCount:      engineOutput.items.reduce((s, i) => s + i.quantity, 0),
      uniqueItemCount: engineOutput.items.length,
      lockedUntil:    cart.lockedUntil?.toISOString() ?? null,
      lastActivityAt: cart.lastActivityAt.toISOString(),
      createdAt:      cart.createdAt.toISOString(),
      updatedAt:      cart.updatedAt.toISOString(),
      _debug:         engineOutput._debug,
    };
  }
}
