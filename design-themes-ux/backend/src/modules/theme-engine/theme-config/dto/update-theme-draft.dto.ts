import {
  IsObject,
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  ValidateNested,
  IsHexColor,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

// ─── Nested value objects ─────────────────────────────────────────────────────

export class ThemeColorsDto {
  @ApiPropertyOptional({ example: '#16a34a' })
  @IsOptional() @IsHexColor()
  primary?: string;

  @ApiPropertyOptional({ example: '#f0fdf4' })
  @IsOptional() @IsHexColor()
  secondary?: string;

  @ApiPropertyOptional({ example: '#fb923c' })
  @IsOptional() @IsHexColor()
  accent?: string;

  @ApiPropertyOptional({ example: '#ffffff' })
  @IsOptional() @IsHexColor()
  background?: string;

  @ApiPropertyOptional({ example: '#111827' })
  @IsOptional() @IsHexColor()
  text?: string;

  @ApiPropertyOptional({ example: '#f9fafb' })
  @IsOptional() @IsHexColor()
  surface?: string;
}

export class ThemeTypographyDto {
  @ApiPropertyOptional({ example: 'Nunito' })
  @IsOptional() @IsString()
  headingFont?: string;

  @ApiPropertyOptional({ example: 'Nunito' })
  @IsOptional() @IsString()
  bodyFont?: string;

  @ApiPropertyOptional({ example: 1.0, minimum: 0.75, maximum: 1.5 })
  @IsOptional() @IsNumber() @Min(0.75) @Max(1.5)
  baseSizeRem?: number;

  @ApiPropertyOptional({ example: 1.6, minimum: 1.0, maximum: 2.5 })
  @IsOptional() @IsNumber() @Min(1.0) @Max(2.5)
  lineHeight?: number;
}

export class ThemeLayoutDto {
  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  stickyHeader?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  sidebarCart?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  megaMenu?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  backToTop?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  cookieConsent?: boolean;
}

// ─── Root DTO ─────────────────────────────────────────────────────────────────

export class UpdateThemeDraftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ThemeColorsDto)
  colors?: ThemeColorsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ThemeTypographyDto)
  typography?: ThemeTypographyDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ThemeLayoutDto)
  layout?: ThemeLayoutDto;
}
