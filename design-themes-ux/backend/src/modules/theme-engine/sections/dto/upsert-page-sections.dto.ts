import {
  IsArray, IsString, IsObject, IsOptional,
  IsBoolean, IsNumber, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Block item (Phase 2) ─────────────────────────────────────────────────────

export class BlockItemDto {
  @ApiPropertyOptional({ description: 'Block type (e.g., "heading", "button")' })
  @IsString()
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}

// ─── Section item ─────────────────────────────────────────────────────────────

export class PageSectionItemDto {
  /** Existing section id — ignored on upsert (service always recreates) */
  @IsOptional() @IsString()
  id?: string;

  @IsString()
  sectionDefId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  /**
   * Optional block list. When provided, these blocks are created instead of
   * seeding from SectionDefinition.defaultBlocks. This allows the editor to
   * persist its full section+block state in one PUT request.
   */
  @ApiPropertyOptional({ type: [BlockItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlockItemDto)
  blocks?: BlockItemDto[];
}

/** Batch replace all draft sections (and their blocks) for a page. */
export class UpsertPageSectionsDto {
  @ApiProperty({ type: [PageSectionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PageSectionItemDto)
  sections: PageSectionItemDto[];
}
