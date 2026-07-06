import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

export class MarkDeliveredDto {
  @ApiPropertyOptional({
    description: 'Actual delivery timestamp; defaults to now() when omitted',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  deliveredAt?: Date;
}
