import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ApplyPromotionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;
}
