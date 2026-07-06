import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedCustomer } from '../types/customer-auth.types';

// Exported separately from the decorator factory so it can be unit-tested
// directly, without going through Nest's param-decorator metadata pipeline.
export function extractCurrentCustomer(
  data: keyof AuthenticatedCustomer | undefined,
  ctx: ExecutionContext,
) {
  const request = ctx.switchToHttp().getRequest();
  const customer: AuthenticatedCustomer | undefined = request.customer;
  return data ? customer?.[data] : customer;
}

export const CurrentCustomer = createParamDecorator(extractCurrentCustomer);
