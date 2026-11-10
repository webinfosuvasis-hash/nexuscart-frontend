import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { CartStatus } from '@prisma/client';

/**
 * Gate for cart mutations (add / update / remove / coupon / clear).
 *
 * A cart session can own several carts over time: once a cart is CONVERTED
 * (an order was placed) or MERGED (into a customer's cart at sign-in) it is
 * finished, and the next mutation starts a fresh ACTIVE cart — exactly how
 * CartService.findOrCreate resolves the session's cart. So this guard only
 * looks at the session's *live* cart (ACTIVE or LOCKED); finished carts never
 * block the shopper and are never mutated (the service ignores them too).
 */
@Injectable()
export class CartMutationGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req       = context.switchToHttp().getRequest<Request>();
    const storeId   = req.storeId ?? 'default';
    const sessionId = req.cartSessionId;

    if (!sessionId) {
      throw new ForbiddenException('Missing cart session');
    }

    const cart = await this.prisma.cart.findFirst({
      where:   { storeId, sessionId, status: { in: [CartStatus.ACTIVE, CartStatus.LOCKED] } },
      orderBy: { createdAt: 'desc' },
      select:  { id: true, status: true, lockedUntil: true },
    });

    // No live cart (none yet, or only finished CONVERTED/MERGED ones) —
    // the mutation creates a new one; allow through.
    if (!cart) {
      req.resolvedCart = null;
      return true;
    }

    // Lazy LOCKED auto-unlock
    if (cart.status === CartStatus.LOCKED) {
      if (cart.lockedUntil && cart.lockedUntil < new Date()) {
        await this.prisma.cart.update({
          where: { id: cart.id },
          data:  { status: CartStatus.ACTIVE, lockedAt: null, lockedUntil: null },
        });
        req.resolvedCart = { ...cart, status: CartStatus.ACTIVE };
        return true;
      }
      throw new ConflictException('Cart is locked and cannot be mutated');
    }

    req.resolvedCart = cart;
    return true;
  }
}
