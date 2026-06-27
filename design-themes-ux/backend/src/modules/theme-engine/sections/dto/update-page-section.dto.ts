import {
  IsObject, IsOptional, IsBoolean, IsInt, Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePageSectionDto {
  @ApiPropertyOptional()
  @IsOptional() @IsObject()
  settings?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isVisible?: boolean;
}
