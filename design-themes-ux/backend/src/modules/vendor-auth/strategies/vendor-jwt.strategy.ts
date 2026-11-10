import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { VendorStatus, VendorUserStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  AuthenticatedVendor, VENDOR_JWT_AUDIENCE, VENDOR_JWT_ISSUER, VendorJwtPayload,
} from '../vendor-auth.types';

// ---------------------------------------------------------------------------
// 'vendor-jwt' — isolated from the merchant 'jwt' and the 'customer-jwt'
// strategies: its own secret, issuer and audience, so neither of the other
// token kinds can verify here (and a vendor token cannot verify there).
//
// The token is only a pointer. Every request reloads the VendorUser and its
// Vendor, and rejects unless both are ACTIVE, the ids match the claims and the
// tokenVersion is current — so suspension, revocation, vendor deactivation and
// password changes take effect on the very next request.
// ---------------------------------------------------------------------------
@Injectable()
export class VendorJwtStrategy extends PassportStrategy(Strategy, 'vendor-jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest:   ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:      config.get<string>('VENDOR_JWT_SECRET'),
      issuer:           VENDOR_JWT_ISSUER,
      audience:         VENDOR_JWT_AUDIENCE,
      algorithms:       ['HS256'],
    });
  }

  async validate(payload: VendorJwtPayload): Promise<AuthenticatedVendor> {
    if (payload.typ !== 'vendor' || !payload.sub) throw new UnauthorizedException('Invalid token type');

    const user = await this.prisma.vendorUser.findUnique({
      where:  { id: payload.sub },
      select: {
        id: true, storeId: true, vendorId: true, email: true, name: true, status: true, tokenVersion: true,
        vendor: { select: { status: true, storeId: true } },
      },
    });
    if (
      !user
      || user.status !== VendorUserStatus.ACTIVE
      || user.vendor.status !== VendorStatus.ACTIVE
      || user.vendor.storeId !== user.storeId
      || user.vendorId !== payload.vid
      || user.storeId !== payload.sid
      || user.tokenVersion !== payload.tv
    ) {
      throw new UnauthorizedException('Vendor session is no longer valid');
    }
    return { vendorUserId: user.id, vendorId: user.vendorId, storeId: user.storeId, email: user.email, name: user.name };
  }
}
