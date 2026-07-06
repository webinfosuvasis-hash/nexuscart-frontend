import {
  IsString, Length, MinLength, Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Raw reset token from the emailed link (32 random bytes, hex-encoded — 64 chars)' })
  @IsString()
  @Length(64, 64)
  token: string;

  @ApiProperty({ example: 'NewPass123!' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/, {
    message: 'newPassword must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  newPassword: string;
}
