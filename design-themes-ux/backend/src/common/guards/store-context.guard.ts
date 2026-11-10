import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/prisma/prisma.service';

export const REQUIRE_STORE_KEY = 'requireStore';
// SetMetadata (not Reflect.metadata): Reflector reads metadata off the handler function.
export const RequireStore = () => SetMetadata(REQUIRE_STORE_KEY, true);

/** StoreStaff.role (per store) → the UserRole the PermissionsGuard evaluates. */
const MEMBERSHIP_ROLE: Record<string, string> = {
  OWNER:   'STORE_OWNER',
  MANAGER: 'STORE_MANAGER',
  STAFF:   'STORE_STAFF',
};

// ---------------------------------------------------------------------------
// Tenant isolation — registered globally right after JwtAuthGuard, so it runs
// before PermissionsGuard on every authenticated merchant route.
//
// `X-Store-Id` is client-controlled (the admin keeps it in localStorage) and
// @CurrentStore() prefers it over the JWT's store, so it must be checked here:
//   • SUPER_ADMIN                       → any store (cross-store operations)
//   • header === the user's own store   → allowed
//   • user is a StoreStaff member of it → allowed, acting with the role that
//     membership grants *in that store* (a store owner invited elsewhere as
//     STAFF gets STAFF permissions there, not their global STORE_OWNER role)
//   • otherwise                         → 403
// Public routes (storefront) and customer routes carry no merchant
// `request.user`, so they are unaffected.
// ---------------------------------------------------------------------------
@Injectable()
export class StoreContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const requireStore = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_STORE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requireStore && !request.storeId) {
      throw new ForbiddenException('X-Store-Id header is required for this endpoint');
    }

    const user = request.user;
    const headerStoreId: string | undefined = request.storeId;
    if (!user || !headerStoreId) return true;
    if (user.role === 'SUPER_ADMIN') return true;
    if (user.storeId && user.storeId === headerStoreId) return true;

    const membership = await this.prisma.storeStaff.findUnique({
      where:  { storeId_userId: { storeId: headerStoreId, userId: user.id } },
      select: { role: true },
    });
    if (!membership) throw new ForbiddenException('Access denied for this store');

    // Scope the principal to the store being acted on for the rest of the request.
    request.user = {
      ...user,
      storeId: headerStoreId,
      role:    MEMBERSHIP_ROLE[membership.role] ?? 'STORE_STAFF',
    };
    return true;
  }
}
