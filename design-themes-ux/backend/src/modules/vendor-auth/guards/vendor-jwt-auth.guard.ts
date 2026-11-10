import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Runs only where declared with @UseGuards(VendorJwtAuthGuard) — never globally.
// `property: 'vendor'` puts the principal on `request.vendor`, so `request.user`
// is never set on a vendor route: the merchant StoreContextGuard and
// PermissionsGuard never see a vendor, and a vendor can never be mistaken for
// a merchant principal.
@Injectable()
export class VendorJwtAuthGuard extends AuthGuard('vendor-jwt') {
  constructor() {
    super({ property: 'vendor' });
  }

  handleRequest<TVendor = unknown>(err: unknown, vendor: TVendor): TVendor {
    if (err || !vendor) {
      throw err || new UnauthorizedException('Invalid or expired vendor token');
    }
    return vendor;
  }
}
