import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// FI-1 — isolated from the merchant `JwtAuthGuard`: wraps the 'customer-jwt'
// Passport strategy only, and is never applied globally — it only ever runs
// on routes that explicitly declare `@UseGuards(CustomerJwtAuthGuard)`.
//
// `property: 'customer'` tells the underlying @nestjs/passport AuthGuard to
// assign the resolved principal to `request.customer` instead of the default
// `request.user` — so `request.user` is never set at all on a customer
// route, not merely set-then-deleted. This is what guarantees a customer
// route can never expose (or be confused with) a merchant principal.
@Injectable()
export class CustomerJwtAuthGuard extends AuthGuard('customer-jwt') {
  constructor() {
    super({ property: 'customer' });
  }

  handleRequest<TCustomer = unknown>(err: unknown, customer: TCustomer): TCustomer {
    if (err || !customer) {
      throw err || new UnauthorizedException('Invalid or expired customer token');
    }
    return customer;
  }
}
