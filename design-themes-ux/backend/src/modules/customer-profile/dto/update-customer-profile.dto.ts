import {
  IsOptional, IsString, MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Deliberately excludes `email` — changing the login email is an
// authentication concern (ties into isEmailVerified / credential state),
// not a profile-editing one, and FI-2's CustomerAuthController owns that
// surface exclusively. This module never touches CustomerCredential.
export class UpdateCustomerProfileDto {
  @ApiPropertyOptional({ example: 'Priya Sharma' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
