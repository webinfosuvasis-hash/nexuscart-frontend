import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** Only name, description, and tag are editable on a CUSTOM preset. */
export class UpdatePresetDto {
  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional() @IsString() @MaxLength(60)
  name?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional() @IsString() @MaxLength(200)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(40)
  @IsIn(['seasonal', 'brand', 'campaign', 'other'])
  tag?: string;
}
