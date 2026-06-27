import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

// ─── Widget ───────────────────────────────────────────────────────────────────

export class FooterWidgetDto {
  @IsString()
  id: string;

  @IsString()
  @IsIn([
    'brand_block', 'nav_column', 'newsletter', 'newsletter_form',
    'contact_info', 'payment_badges', 'app_badges',
    'copyright', 'legal_links', 'social_icons', 'custom_html',
  ])
  type: string;

  @IsObject()
  settings: Record<string, unknown>;
}

// ─── Column ───────────────────────────────────────────────────────────────────

export class FooterColumnDto {
  @IsString()
  id: string;

  @IsOptional() @IsString()
  title?: string;

  @IsInt() @Min(15) @Max(70)
  widthPercent: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FooterWidgetDto)
  widgets: FooterWidgetDto[];
}

// ─── Bottom bar ───────────────────────────────────────────────────────────────

export class FooterBottomBarDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FooterWidgetDto)
  components: FooterWidgetDto[];

  @IsOptional() @IsString()
  backgroundColor?: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export class FooterSettingsDto {
  /** Background color of the top footer area */
  @IsOptional() @IsString()
  topBackground?: string;

  /** 1px border line above the footer */
  @IsOptional() @IsBoolean()
  topBorder?: boolean;

  /** Divider line between top footer and bottom bar */
  @IsOptional() @IsBoolean()
  divider?: boolean;

  @IsOptional() @IsString()
  dividerColor?: string;

  /**
   * Top padding in pixels.
   * The FooterBuilder used to save `paddingVertical` (string T-shirt size).
   * Both UIs now write paddingTop + paddingBottom as numbers so the renderer
   * can use them directly without a conversion step.
   */
  @IsOptional() @IsNumber() @Min(0) @Max(240)
  paddingTop?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(240)
  paddingBottom?: number;

  /** Show the bottom bar (copyright + payment badges row) */
  @IsOptional() @IsBoolean()
  showBottomBar?: boolean;

  /** Background color of the bottom bar */
  @IsOptional() @IsString()
  bottomBarBg?: string;

  /**
   * @deprecated Use paddingTop / paddingBottom instead.
   * Kept in the DTO so old saved rows that still have this key are not
   * rejected. The renderer ignores it.
   */
  @IsOptional() @IsString()
  paddingVertical?: string;
}

// ─── Root DTO ─────────────────────────────────────────────────────────────────

/**
 * Validation rule (from spec): column widthPercent values must sum to 100.
 * Enforced in FooterConfigService.validateColumns().
 */
export class UpdateFooterDraftDto {
  @ApiPropertyOptional({ type: [FooterColumnDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => FooterColumnDto)
  columns?: FooterColumnDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => FooterBottomBarDto)
  bottomBar?: FooterBottomBarDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => FooterSettingsDto)
  settings?: FooterSettingsDto;
}
