import {
  IsString, IsNotEmpty, IsObject, IsOptional,
  IsBoolean, IsNumber, Min, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddBlockDto {
  @ApiProperty({ description: 'Block type — must match a BlockDefinition.type', example: 'heading' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  type: string;

  @ApiPropertyOptional({ description: 'Initial settings for this block instance' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  /**
   * Explicit sort position. If omitted, block is appended at the end
   * (sortOrder = maxExisting + 1.0).
   */
  @ApiPropertyOptional({ description: 'Fractional sort position within the section', example: 2.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
