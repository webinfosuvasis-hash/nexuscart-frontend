import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Gateways a shopper may pay with through the customer/guest checkout APIs.
 * Deliberately excludes the internal 'mock' gateway (it captures instantly,
 * so it would turn any request into a paid order without real money).
 * Storefront-only method choices (UPI, cards, net banking, wallets) are not
 * gateways and are never accepted here.
 */
export const CUSTOMER_GATEWAY_CODES = ['cod', 'razorpay'] as const;
export type CustomerGatewayCode = (typeof CUSTOMER_GATEWAY_CODES)[number];

export class InitiatePaymentDto {
  @ApiPropertyOptional({
    description: "Gateway code to pay with ('cod' or 'razorpay'). "
      + "Defaults to the store's configured default gateway (StorePaymentConfig.defaultGateway) when omitted.",
    enum: CUSTOMER_GATEWAY_CODES,
    example: 'cod',
  })
  @IsOptional()
  @IsIn(CUSTOMER_GATEWAY_CODES, { message: `gatewayCode must be one of: ${CUSTOMER_GATEWAY_CODES.join(', ')}` })
  gatewayCode?: string;
}
