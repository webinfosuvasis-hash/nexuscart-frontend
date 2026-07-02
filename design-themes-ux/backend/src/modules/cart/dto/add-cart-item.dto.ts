import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class AddCartItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  quantity: number;

  @IsString()
  @IsOptional()
  warehouseId?: string;
}
