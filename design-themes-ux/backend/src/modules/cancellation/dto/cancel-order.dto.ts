import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelOrderDto {
  @ApiProperty({ description: 'Human-readable cancellation reason', minLength: 1, maxLength: 500 })
  @IsString()
  @Length(1, 500)
  reason: string;

  @ApiProperty({ description: 'Stable idempotency key — must be re-used on retry to prevent duplicate processing' })
  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}
