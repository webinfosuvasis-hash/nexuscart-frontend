import { IsOptional, IsString } from 'class-validator';

export class StartCheckoutDto {
  @IsString()
  @IsOptional()
  customerId?: string;
}
