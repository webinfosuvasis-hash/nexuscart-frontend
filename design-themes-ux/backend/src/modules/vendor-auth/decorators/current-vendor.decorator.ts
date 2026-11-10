import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedVendor } from '../vendor-auth.types';

/**
 * The verified vendor principal (from VendorJwtAuthGuard). The only source of
 * a vendor's vendorId / storeId — never read them from the body, query or headers.
 */
export const CurrentVendor = createParamDecorator(
  (data: keyof AuthenticatedVendor | undefined, ctx: ExecutionContext) => {
    const vendor: AuthenticatedVendor | undefined = ctx.switchToHttp().getRequest().vendor;
    if (!vendor) throw new UnauthorizedException('Vendor authentication required');
    return data ? vendor[data] : vendor;
  },
);
