import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';

export const CurrentStore = createParamDecorator(
  (required: boolean = true, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    // Prefer explicit X-Store-Id header (super-admin cross-store ops),
    // fallback to the storeId on the authenticated user's JWT
    const storeId = (request.storeId ?? request.user?.storeId) as string | undefined;
    if (required && !storeId) {
      throw new BadRequestException('X-Store-Id header is required for this endpoint');
    }
    return storeId as string;
  },
);
