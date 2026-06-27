import {
  IsString, IsOptional, IsBoolean, IsObject,
  IsIn, MaxLength, IsDateString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const VALID_STATUSES = ['LIVE', 'DRAFT', 'SCHEDULED', 'DISABLED'] as const;

export class UpdateSectionDto {
  @ApiPropertyOptional({ example: 'Hero Banner Carousel' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @ApiPropertyOptional({ enum: VALID_STATUSES })
  @IsOptional()
  @IsIn(VALID_STATUSES)
  status?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Section-specific config JSON (Phase 2+)' })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ example: '2026-07-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  goLiveAt?: string;

  @ApiPropertyOptional({ example: '2026-07-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  expireAt?: string;
}
