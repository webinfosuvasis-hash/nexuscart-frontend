import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class InitiatePaymentDto {
  @ApiPropertyOptional({
    description: "Gateway code to pay with (e.g. 'razorpay', 'stripe', 'cod', 'mock'). "
      + "Defaults to the store's configured default gateway (StorePaymentConfig.defaultGateway) when omitted.",
    example: 'razorpay',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  gatewayCode?: string;
}
