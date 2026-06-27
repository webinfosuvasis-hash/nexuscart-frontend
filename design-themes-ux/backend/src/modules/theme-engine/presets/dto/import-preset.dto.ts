import { IsString, IsObject, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportPresetDto {
  @ApiProperty({ description: 'Preset name (overrides the name in the JSON)' })
  @IsOptional() @IsString() @MaxLength(60)
  name?: string;

  /**
   * Raw preset config JSON previously exported via GET /theme/presets/:id/export.
   * The service validates themeId + themeVersion compatibility before applying.
   */
  @ApiProperty()
  @IsObject()
  data: Record<string, unknown>;
}
