import {
  IsString,
  IsOptional,
  MaxLength,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePresetDto {
  @ApiProperty({ maxLength: 60 })
  @IsString()
  @MaxLength(60)
  name: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  /**
   * Optional grouping tag shown in the Presets UI.
   * Examples: 'seasonal', 'brand', 'campaign'
   */
  @ApiPropertyOptional({ example: 'seasonal' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @IsIn(['seasonal', 'brand', 'campaign', 'other'])
  tag?: string;
}
