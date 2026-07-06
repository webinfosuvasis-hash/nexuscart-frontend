import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Raw verification token from the emailed link (32 random bytes, hex-encoded — 64 chars)' })
  @IsString()
  @Length(64, 64)
  token: string;
}
