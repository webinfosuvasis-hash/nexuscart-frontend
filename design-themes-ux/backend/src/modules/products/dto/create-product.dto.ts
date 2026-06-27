import {
  IsString, IsNumber, IsOptional, IsBoolean, IsArray, IsEnum,
  IsInt, Min, IsPositive, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductVariantDto {
  @ApiProperty({ example: 'Red / L' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'SKU-RED-L' })
  @IsOptional()
  @IsString()
  sku?: string;                         // optional — backend auto-generates if absent

  @ApiProperty({ example: 1299 })
  @IsNumber()
  @Min(0)                               // allow 0 (e.g. free variants); @IsPositive was too strict
  price: number;

  @ApiPropertyOptional({ example: 1599 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  comparePrice?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ description: 'Combination object e.g. { Color: "Red", Size: "38" }' })
  @IsOptional()
  options?: Record<string, string>;     // stored as Json on ProductVariant
}

export class CreateProductDto {
  @ApiProperty({ example: 'Floral Kurta Set' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'floral-kurta-set' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiProperty({ example: 1299 })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiPropertyOptional({ example: 1599 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  comparePrice?: number;

  @ApiPropertyOptional({ example: 1200 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({ example: 'SKU-001' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ example: 'BARCODE-001' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  stock?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  lowStockThreshold?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @ApiPropertyOptional({ example: ['https://...'] })
  @IsOptional()
  @IsArray()
  images?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  thumbnail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ example: ['cotton', 'summer'] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ example: 0.5 })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional({ type: [ProductVariantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  @ApiPropertyOptional({ example: 'GST 18%' })
  @IsOptional()
  @IsString()
  taxCategory?: string;

  @ApiPropertyOptional({ example: '5208' })
  @IsOptional()
  @IsString()
  hsCode?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  priceIncludesTax?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  seo?: { title?: string; description?: string; keywords?: string };
}
