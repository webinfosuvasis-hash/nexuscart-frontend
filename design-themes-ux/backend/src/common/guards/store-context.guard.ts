import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const REQUIRE_STORE_KEY = 'requireStore';
export const RequireStore = () =>
  Reflect.metadata(REQUIRE_STORE_KEY, true);

@Injectable()
export class StoreContextGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requireStore = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_STORE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requireStore) return true;

    const request = context.switchToHttp().getRequest();
    if (!request.storeId) {
      throw new ForbiddenException(
        'X-Store-Id header is required for this endpoint',
      );
    }

    const user = request.user;
    if (user?.role === 'SUPER_ADMIN') return true;

    if (user?.storeId && user.storeId !== request.storeId) {
      throw new ForbiddenException('Access denied for this store');
    }

    return true;
  }
}
