import {
  IsObject, IsOptional, IsBoolean, IsNumber, Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBlockDto {
  @ApiPropertyOptional({ description: 'Partial settings patch — merged with existing settings' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'New fractional sort position', example: 3.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
