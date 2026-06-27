import {
  IsString,
  IsObject,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddPageSectionDto {
  @ApiProperty({ description: 'SectionDefinition id, e.g. "hero" or "custom:banner@v1"' })
  @IsString()
  sectionDefId: string;

  @ApiPropertyOptional({ description: 'Merchant settings overrides for this section instance' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
