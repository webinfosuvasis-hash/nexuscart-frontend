import { IsString, IsOptional, IsObject, MaxLength } from 'class-validator';

export class TrackEventDto {
  @IsString()
  @MaxLength(100)
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  page?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sessionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, string | number | boolean>;
}
