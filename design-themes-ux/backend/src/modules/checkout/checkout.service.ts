import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CartStatus, CheckoutStatus, AddressType } from '@prisma/client';
import { Request } from 'express';

import { PrismaService } from '../../prisma/prisma.service';
import { InventoryReservationService } from '../../shared/inventory/inventory-reservation.service';
import { CheckoutEngineService } from './engine/checkout-engine.service';
import { CheckoutEventBus } from './events/checkout-event-bus.service';
import { CHECKOUT_ADDRESS_VALIDATOR } from './engines/checkout-engine-tokens';
import { ICheckoutAddressValidator } from './engines/address/address-validator.interface';
import {
  CheckoutStartedEvent,
  CheckoutAddressUpdatedEvent,
  CheckoutShippingUpdatedEvent,
  CheckoutValidatedEvent,
  CheckoutCancelledEvent,
} from './events/checkout.events';
import { CheckoutConfig, CHECKOUT_CONFIG_KEY } from './checkout.config';
import { UpdateAddressDto, AddressTypeDto } from './dto/update-address.dto';
import { UpdateShippingDto } from './dto/update-shipping.dto';
import { CheckoutSessionResponseDto, CheckoutAddressDto } from './dto/checkout-response.dto';

interface CheckoutContext {
  storeId:       string;
  sessionId:     string;
  customerId?:   string | null;
  traceId?:      string | null;
  spanId?:       string | null;
  correlationId?: string | null;
  requestId?:    string | null;
  ipAddress?:    string | null;
  userAgent?:    string | null;
}

function ctxFromReq(req: Request): CheckoutContext {
  return {
    storeId:       req.storeId       ?? 'default',
    sessionId:     req.cartSessionId ?? 'unknown',
    customerId:    (req as any).customerId ?? null,
    traceId:       req.traceId       ?? null,
    spanId:        req.spanId        ?? null,
    correlationId: req.correlationId ?? null,
    requestId:     req.requestId     ?? null,
    ipAddress:     req.ip            ?? null,
    userAgent:     req.headers['user-agent'] ?? null,
  };
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma:     PrismaService,
    private readonly engine:     CheckoutEngineService,
    private readonly eventBus:   CheckoutEventBus,
    private readonly configSvc:  ConfigService,
    @Inject(CHECKOUT_ADDRESS_VALIDATOR)
    private readonly addrValidator: ICheckoutAddressValidator,
    private readonly reservations: InventoryReservationService,
  ) {}

  private get cfg(): CheckoutConfig {
    return this.configSvc.get<CheckoutConfig>(CHECKOUT_CONFIG_KEY)!;
  }

  // ─── START CHECKOUT ────────────────────────────────────────────────────────

  async startCheckout(req: Request): Promise<CheckoutSessionResponseDto> {
    const ctx = ctxFromReq(req);

    const cart = await this.prisma.cart.findFirst({
      where:   { storeId: ctx.storeId, sessionId: ctx.sessionId, status: CartStatus.ACTIVE },
      include: { items: true },
    });

    if (!cart) {
      // Cart may already be LOCKED because a checkout is in progress — detect that
      // before reporting a generic "not found".
      const lockedCart = await this.prisma.cart.findFirst({
        where:  { storeId: ctx.storeId, sessionId: ctx.sessionId, status: CartStatus.LOCKED },
        select: { id: true },
      });

      if (lockedCart) {
        const existing = await this.prisma.checkoutSession.findFirst({
          where:  {
            cartId: lockedCart.id,
            status: { notIn: [CheckoutStatus.CANCELLED, CheckoutStatus.COMPLETED, CheckoutStatus.EXPIRED] },
          },
          orderBy: { createdAt: 'desc' },
          select:  { id: true },
        });

        if (existing) {
          throw new ConflictException({
            error:      'CHECKOUT_ALREADY_ACTIVE',
            message:    'A checkout session is already active for this cart.',
            checkoutId: existing.id,
            resume:     true,
          });
        }
      }

      throw new NotFoundException('No active cart found for this session');
    }

    if (cart.items.length === 0) throw new BadRequestException('Cannot start checkout with an empty cart');

    // Optimistic-lock cart into LOCKED state
    const lockResult = await this.prisma.cart.updateMany({
      where: { id: cart.id, version: cart.version, status: CartStatus.ACTIVE },
      data:  {
        status:           CartStatus.LOCKED,
        lockedAt:         new Date(),
        lockedUntil:      new Date(Date.now() + this.cfg.sessionTimeoutMinutes * 60_000),
        checkoutStartedAt: new Date(),
      },
    });
    if (lockResult.count === 0) throw new ConflictException('Cart was modified concurrently — please try again');

    const expiresAt = new Date(Date.now() + this.cfg.sessionTimeoutMinutes * 60_000);

    const checkout = await this.prisma.checkoutSession.create({
      data: {
        storeId:       ctx.storeId,
        cartId:        cart.id,
        cartVersion:   cart.version,
        sessionId:     ctx.sessionId,
        customerId:    ctx.customerId ?? null,
        status:        CheckoutStatus.PENDING,
        expiresAt,
        traceId:       ctx.traceId ?? null,
        spanId:        ctx.spanId  ?? null,
        correlationId: ctx.correlationId ?? null,
        requestId:     ctx.requestId ?? null,
        ipAddress:     ctx.ipAddress ?? null,
        userAgent:     ctx.userAgent ?? null,
      },
      include: { addresses: true },
    });

    this.eventBus.emit(new CheckoutStartedEvent(
      { cartId: cart.id, cartVersion: cart.version },
      checkout.id, cart.id, ctx.storeId, ctx.sessionId,
      ctx.traceId ?? null, ctx.spanId ?? null, ctx.correlationId ?? null, ctx.requestId ?? null,
      ctx.ipAddress ?? null, ctx.userAgent ?? null,
    ));

    return this.buildResponse(checkout, cart);
  }

  // ─── GET CHECKOUT ──────────────────────────────────────────────────────────

  async getCheckout(checkoutId: string, req: Request): Promise<CheckoutSessionResponseDto> {
    const ctx      = ctxFromReq(req);
    const checkout = await this.requireSessionCheckout(checkoutId, ctx);
    const cart     = await this.requireCart(checkout.cartId, ctx.storeId);
    return this.buildResponse(checkout, cart);
  }

  // ─── UPDATE ADDRESS ────────────────────────────────────────────────────────

  async updateAddress(checkoutId: string, dto: UpdateAddressDto, req: Request): Promise<CheckoutSessionResponseDto> {
    const ctx      = ctxFromReq(req);
    const checkout = await this.requireSessionCheckout(checkoutId, ctx);
    this.requireNotExpiredOrCancelled(checkout);

    const validation = await this.addrValidator.validate(dto.address);
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Address validation failed',
        errors:  validation.errors,
      });
    }

    const addressType = dto.type === AddressTypeDto.BILLING ? AddressType.BILLING : AddressType.SHIPPING;

    await this.prisma.checkoutAddressSnapshot.deleteMany({
      where: { checkoutId, type: addressType },
    });

    await this.prisma.checkoutAddressSnapshot.create({
      data: {
        checkoutId,
        type:           addressType,
        firstName:      dto.address.firstName,
        lastName:       dto.address.lastName,
        line1:          dto.address.line1,
        line2:          dto.address.line2 ?? null,
        city:           dto.address.city,
        state:          dto.address.state,
        postalCode:     dto.address.postalCode,
        country:        dto.address.country,
        phone:          dto.address.phone,
        email:          dto.address.email ?? null,
        isGuestAddress: !checkout.customerId,
        sourceAddressId: dto.address.sourceAddressId ?? null,
      },
    });

    // If shipping address was just set, also copy to billing if billingSameAsShipping
    if (dto.type === AddressTypeDto.SHIPPING && dto.billingSameAsShipping) {
      await this.prisma.checkoutAddressSnapshot.deleteMany({
        where: { checkoutId, type: AddressType.BILLING },
      });
      await this.prisma.checkoutAddressSnapshot.create({
        data: {
          checkoutId,
          type:           AddressType.BILLING,
          firstName:      dto.address.firstName,
          lastName:       dto.address.lastName,
          line1:          dto.address.line1,
          line2:          dto.address.line2 ?? null,
          city:           dto.address.city,
          state:          dto.address.state,
          postalCode:     dto.address.postalCode,
          country:        dto.address.country,
          phone:          dto.address.phone,
          email:          dto.address.email ?? null,
          isGuestAddress: !checkout.customerId,
          sourceAddressId: dto.address.sourceAddressId ?? null,
        },
      });
    }

    // Address change always resets to ADDRESS_ADDED (clears shipping selection and validation)
    const newStatus = CheckoutStatus.ADDRESS_ADDED;
    const updated   = await this.prisma.checkoutSession.update({
      where:   { id: checkoutId },
      data:    { status: newStatus, isValid: false, validatedAt: null, selectedShippingMethodId: null },
      include: { addresses: true },
    });

    this.eventBus.emit(new CheckoutAddressUpdatedEvent(
      { addressType: dto.type },
      checkoutId, checkout.cartId, ctx.storeId, ctx.sessionId,
      ctx.traceId ?? null, ctx.spanId ?? null, ctx.correlationId ?? null, ctx.requestId ?? null,
      ctx.ipAddress ?? null, ctx.userAgent ?? null,
    ));

    const cart = await this.requireCart(checkout.cartId, ctx.storeId);
    return this.buildResponse(updated, cart);
  }

  // ─── UPDATE SHIPPING ───────────────────────────────────────────────────────

  async updateShipping(checkoutId: string, dto: UpdateShippingDto, req: Request): Promise<CheckoutSessionResponseDto> {
    const ctx      = ctxFromReq(req);
    const checkout = await this.requireSessionCheckout(checkoutId, ctx);
    this.requireNotExpiredOrCancelled(checkout);
    this.requireAddressSet(checkout);

    const updated = await this.prisma.checkoutSession.update({
      where:   { id: checkoutId },
      data:    {
        selectedShippingMethodId: dto.shippingMethodId,
        status:   CheckoutStatus.SHIPPING_SELECTED,
        isValid:  false,
        validatedAt: null,
      },
      include: { addresses: true },
    });

    this.eventBus.emit(new CheckoutShippingUpdatedEvent(
      { shippingMethodId: dto.shippingMethodId },
      checkoutId, checkout.cartId, ctx.storeId, ctx.sessionId,
      ctx.traceId ?? null, ctx.spanId ?? null, ctx.correlationId ?? null, ctx.requestId ?? null,
      ctx.ipAddress ?? null, ctx.userAgent ?? null,
    ));

    const cart = await this.requireCart(checkout.cartId, ctx.storeId);
    return this.buildResponse(updated, cart);
  }

  // ─── VALIDATE CHECKOUT ─────────────────────────────────────────────────────

  async validateCheckout(checkoutId: string, req: Request): Promise<CheckoutSessionResponseDto> {
    const ctx      = ctxFromReq(req);
    const checkout = await this.requireSessionCheckout(checkoutId, ctx);
    this.requireNotExpiredOrCancelled(checkout);
    this.requireAddressSet(checkout);

    const cart   = await this.requireCart(checkout.cartId, ctx.storeId);
    const result = await this.engine.run(checkout, cart, this.cfg.debugMode);

    const now    = new Date();
    const updated = await this.prisma.checkoutSession.update({
      where:   { id: checkoutId },
      data:    {
        isValid:     result.validation.isValid,
        validatedAt: now,
        status:      result.validation.isValid ? CheckoutStatus.VALIDATED : checkout.status,
      },
      include: { addresses: true },
    });

    const eventType = result.validation.isValid ? 'validation_passed' : 'validation_failed';
    this.eventBus.emit(new CheckoutValidatedEvent(
      { isValid: result.validation.isValid, issueCount: result.validation.issues.length, eventType },
      checkoutId, checkout.cartId, ctx.storeId, ctx.sessionId,
      ctx.traceId ?? null, ctx.spanId ?? null, ctx.correlationId ?? null, ctx.requestId ?? null,
      ctx.ipAddress ?? null, ctx.userAgent ?? null,
    ));

    return this.buildResponse(updated, cart, result);
  }

  // ─── GET SUMMARY ──────────────────────────────────────────────────────────

  async getSummary(checkoutId: string, req: Request): Promise<CheckoutSessionResponseDto> {
    return this.getCheckout(checkoutId, req);
  }

  /**
   * Live-recomputed summary for a caller that has already proven ownership
   * by other means (CustomerPaymentService: customer claim or guest cart
   * session). Not session-scoped — the authenticated payment call does not
   * carry the cart cookie on cross-origin deployments. Never expose this
   * directly over HTTP.
   */
  async getSummaryForVerifiedOwner(checkoutId: string, storeId: string): Promise<CheckoutSessionResponseDto> {
    const checkout = await this.requireCheckout(checkoutId, storeId);
    const cart     = await this.requireCart(checkout.cartId, storeId);
    return this.buildResponse(checkout, cart);
  }

  // ─── CANCEL CHECKOUT ──────────────────────────────────────────────────────

  async cancelCheckout(checkoutId: string, req: Request): Promise<CheckoutSessionResponseDto> {
    const ctx      = ctxFromReq(req);
    const checkout = await this.requireSessionCheckout(checkoutId, ctx);

    if (checkout.status === CheckoutStatus.CANCELLED) {
      throw new BadRequestException('Checkout is already cancelled');
    }
    if (checkout.status === CheckoutStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed checkout');
    }

    const updated = await this.prisma.checkoutSession.update({
      where:   { id: checkoutId },
      data:    { status: CheckoutStatus.CANCELLED, cancelledAt: new Date() },
      include: { addresses: true },
    });

    // Unlock the cart
    await this.prisma.cart.updateMany({
      where: { id: checkout.cartId, status: CartStatus.LOCKED },
      data:  { status: CartStatus.ACTIVE, lockedAt: null, lockedUntil: null },
    });

    // Return any stock held for this checkout's payment attempts.
    await this.reservations.releaseForCheckout(checkoutId, ctx.storeId);

    this.eventBus.emit(new CheckoutCancelledEvent(
      { reason: 'user_cancelled' },
      checkoutId, checkout.cartId, ctx.storeId, ctx.sessionId,
      ctx.traceId ?? null, ctx.spanId ?? null, ctx.correlationId ?? null, ctx.requestId ?? null,
      ctx.ipAddress ?? null, ctx.userAgent ?? null,
    ));

    const cart = await this.requireCart(checkout.cartId, ctx.storeId);
    return this.buildResponse(updated, cart);
  }

  // ─── GET ACTIVITY ─────────────────────────────────────────────────────────

  async getActivity(checkoutId: string, req: Request) {
    const ctx = ctxFromReq(req);
    await this.requireSessionCheckout(checkoutId, ctx);

    return this.prisma.checkoutActivity.findMany({
      where:   { checkoutId },
      orderBy: { createdAt: 'desc' },
      take:    50,
      select:  { id: true, activityType: true, actorType: true, actorId: true, payload: true, createdAt: true },
    });
  }

  // ─── INTERNALS ─────────────────────────────────────────────────────────────

  private async requireCheckout(checkoutId: string, storeId: string) {
    const checkout = await this.prisma.checkoutSession.findFirst({
      where:   { id: checkoutId, storeId },
      include: { addresses: true },
    });
    if (!checkout) throw new NotFoundException('Checkout session not found');
    return checkout;
  }

  /**
   * Every public /checkout/:id route goes through this: a checkout id alone
   * is not authorization. The checkout must belong to the caller's own cart
   * session — otherwise anyone holding an id could read its contact details
   * and session id, change its delivery address, or cancel it. A foreign
   * checkout 404s, the same as a missing one.
   */
  private async requireSessionCheckout(checkoutId: string, ctx: CheckoutContext) {
    const checkout = await this.prisma.checkoutSession.findFirst({
      where:   { id: checkoutId, storeId: ctx.storeId, sessionId: ctx.sessionId },
      include: { addresses: true },
    });
    if (!checkout) throw new NotFoundException('Checkout session not found');
    return checkout;
  }

  private async requireCart(cartId: string, storeId: string) {
    const cart = await this.prisma.cart.findFirst({
      where:   { id: cartId, storeId },
      include: { items: true },
    });
    if (!cart) throw new NotFoundException('Cart not found');
    return cart;
  }

  private requireNotExpiredOrCancelled(checkout: { status: CheckoutStatus; expiresAt: Date }) {
    if (checkout.status === CheckoutStatus.CANCELLED) throw new GoneException('Checkout session has been cancelled');
    if (checkout.status === CheckoutStatus.EXPIRED)   throw new GoneException('Checkout session has expired');
    if (new Date() > checkout.expiresAt)              throw new GoneException('Checkout session has expired');
  }

  private requireAddressSet(checkout: { addresses: { type: AddressType }[] }) {
    const hasShipping = checkout.addresses.some((a) => a.type === AddressType.SHIPPING);
    if (!hasShipping) throw new BadRequestException('Shipping address must be set before proceeding');
  }

  private async buildResponse(
    checkout:  Awaited<ReturnType<typeof this.requireCheckout>>,
    cart:      Awaited<ReturnType<typeof this.requireCart>>,
    precomputed?: Awaited<ReturnType<CheckoutEngineService['run']>>,
  ): Promise<CheckoutSessionResponseDto> {
    const engineOutput = precomputed ?? await this.engine.run(checkout, cart, this.cfg.debugMode);

    const addresses: CheckoutAddressDto[] = checkout.addresses.map((a) => ({
      id:             a.id,
      type:           a.type,
      firstName:      a.firstName,
      lastName:       a.lastName,
      line1:          a.line1,
      line2:          a.line2,
      city:           a.city,
      state:          a.state,
      postalCode:     a.postalCode,
      country:        a.country,
      phone:          a.phone,
      email:          a.email,
      isGuestAddress: a.isGuestAddress,
    }));

    return {
      id:                       checkout.id,
      storeId:                  checkout.storeId,
      cartId:                   checkout.cartId,
      cartVersion:              checkout.cartVersion,
      customerId:               checkout.customerId,
      status:                   checkout.status,
      addresses,
      selectedShippingMethod:   engineOutput.selectedShippingMethod,
      availableShippingMethods: engineOutput.availableShippingMethods,
      items:                    engineOutput.items,
      totals:                   engineOutput.totals,
      taxBreakdown:             engineOutput.taxBreakdown,
      appliedPromotion:         engineOutput.appliedPromotion,
      validation:               engineOutput.validation,
      warnings:                 engineOutput.warnings,
      isValid:                  checkout.isValid,
      expiresAt:                checkout.expiresAt.toISOString(),
      createdAt:                checkout.createdAt.toISOString(),
      updatedAt:                checkout.updatedAt.toISOString(),
      _debug:                   engineOutput._debug,
    };
  }
}
