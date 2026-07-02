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
      where:  { storeId, sessionId },
      select: { id: true, status: true, lockedUntil: true },
    });

    // No cart yet — first mutation creates it; allow through
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

    if (
      cart.status === CartStatus.MERGED ||
      cart.status === CartStatus.CONVERTED
    ) {
      throw new ForbiddenException(`Cart is ${cart.status.toLowerCase()} and no longer mutable`);
    }

    req.resolvedCart = cart;
    return true;
  }
}
