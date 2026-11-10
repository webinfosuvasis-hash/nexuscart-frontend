import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';

export const CurrentStore = createParamDecorator(
  (required: boolean = true, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    // Prefer the X-Store-Id header, fall back to the JWT's store. The header is
    // client-controlled: the global StoreContextGuard has already rejected it
    // unless it is the user's own store, a StoreStaff membership, or SUPER_ADMIN.
    const storeId = (request.storeId ?? request.user?.storeId) as string | undefined;
    if (required && !storeId) {
      throw new BadRequestException('X-Store-Id header is required for this endpoint');
    }
    return storeId as string;
  },
);
