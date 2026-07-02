import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateShippingDto {
  @IsString()
  @IsNotEmpty()
  shippingMethodId: string;
}
