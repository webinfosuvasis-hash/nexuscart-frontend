import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ShipmentItemDto {
  @ApiProperty({ description: 'Product ID to include in this shipment' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiPropertyOptional({ description: 'Variant ID, if the product has variants' })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({ description: 'Quantity shipped', minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateShipmentDto {
  @ApiPropertyOptional({ description: 'Carrier tracking number', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  trackingNumber?: string;

  @ApiPropertyOptional({ description: 'Carrier name (e.g. DHL, FedEx)', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  carrier?: string;

  @ApiPropertyOptional({ description: 'Public tracking page URL', maxLength: 500 })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  carrierUrl?: string;

  @ApiPropertyOptional({ description: 'Internal fulfillment note', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ description: 'Line items included in this shipment', type: [ShipmentItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShipmentItemDto)
  items?: ShipmentItemDto[];
}
