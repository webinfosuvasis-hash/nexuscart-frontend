import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { CustomerJwtPayload, AuthenticatedCustomer } from '../types/customer-auth.types';

// FI-1 — isolated from the merchant `JwtStrategy` ('jwt'): different Passport
// strategy name, different secret (CUSTOMER_JWT_SECRET), different Prisma
// model (Customer, not User). A merchant-signed token can never verify here —
// it's rejected by signature before `validate()` even runs.
@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(Strategy, 'customer-jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('CUSTOMER_JWT_SECRET'),
    });
  }

  async validate(payload: CustomerJwtPayload): Promise<AuthenticatedCustomer> {
    // Defense-in-depth: even though a merchant token can never carry this
    // secret, explicitly reject any payload that isn't a customer token.
    if (payload.type !== 'customer') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Always scoped by (id, storeId) together — never id alone — so a token
    // minted under one store can never resolve a customer in another store.
    const customer = await this.prisma.customer.findFirst({
      where: { id: payload.sub, storeId: payload.storeId },
      select: {
        id: true, storeId: true, email: true, name: true, isActive: true,
      },
    });

    if (!customer || !customer.isActive) {
      throw new UnauthorizedException('Customer not found or inactive');
    }

    return customer;
  }
}
