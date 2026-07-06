import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class UpdateShipmentDto {
  @ApiPropertyOptional({ description: 'Updated carrier tracking number', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  trackingNumber?: string;

  @ApiPropertyOptional({ description: 'Updated carrier name', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  carrier?: string;

  @ApiPropertyOptional({ description: 'Updated public tracking page URL', maxLength: 500 })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  carrierUrl?: string;

  @ApiPropertyOptional({ description: 'Updated fulfillment note', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
