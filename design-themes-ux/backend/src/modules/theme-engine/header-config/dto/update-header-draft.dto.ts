import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
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

// ─── Component ────────────────────────────────────────────────────────────────

export class HeaderComponentDto {
  @IsString()
  id: string;

  @IsString()
  @IsIn([
    'logo', 'navigation', 'search', 'cart', 'account',
    'announcement', 'cta_button', 'language_switcher',
    'currency_switcher', 'social_icons', 'spacer', 'custom_html',
  ])
  type: string;

  @IsObject()
  settings: Record<string, unknown>;
}

// ─── Zone ─────────────────────────────────────────────────────────────────────

export class HeaderZoneDto {
  @IsString()
  @IsIn(['zone1', 'zone2', 'zone3'])
  id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HeaderComponentDto)
  components: HeaderComponentDto[];

  @IsOptional() @IsString()
  background?: string;

  @IsOptional()
  height?: 'auto' | number;

  @IsOptional()
  @IsIn(['all', 'desktop_only', 'mobile_only', 'hidden'])
  visibility?: string;

  @IsOptional() @IsInt() @Min(0) @Max(80)
  paddingTop?: number;

  @IsOptional() @IsInt() @Min(0) @Max(80)
  paddingBottom?: number;

  @IsOptional()
  @IsIn(['none', '1px', '2px'])
  borderBottom?: string;

  @IsOptional() @IsString()
  borderColor?: string;
}

// ─── Behavior ─────────────────────────────────────────────────────────────────

export class HeaderBehaviorDto {
  @IsOptional()
  @IsIn(['off', 'always', 'scroll_up', 'scroll_after'])
  stickyMode?: string;

  @IsOptional() @IsInt() @Min(0) @Max(2000)
  stickyScrollPx?: number;

  @IsOptional() @IsBoolean()
  transparentOnHero?: boolean;

  @IsOptional()
  @IsIn(['sm', 'md', 'lg'])
  mobileBreakpoint?: string;

  @IsOptional()
  @IsIn(['overlay', 'slide_left', 'slide_right'])
  mobileDrawerStyle?: string;

  @IsOptional() @IsInt() @Min(1) @Max(9999)
  zIndex?: number;
}

// ─── Root DTO ─────────────────────────────────────────────────────────────────

/**
 * Validation rule (from spec): Zone 2 must have at least one component.
 * Enforced in HeaderConfigService.validateZones(), not here, to provide
 * a descriptive error message rather than a generic validation failure.
 */
export class UpdateHeaderDraftDto {
  @ApiPropertyOptional({ type: [HeaderZoneDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => HeaderZoneDto)
  zones?: HeaderZoneDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => HeaderBehaviorDto)
  behavior?: HeaderBehaviorDto;
}
