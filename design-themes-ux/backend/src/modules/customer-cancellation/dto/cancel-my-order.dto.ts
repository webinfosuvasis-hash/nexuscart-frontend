import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelMyOrderDto {
  @ApiProperty({ description: 'Human-readable cancellation reason', minLength: 1, maxLength: 500 })
  @IsString()
  @Length(1, 500)
  reason: string;
}
