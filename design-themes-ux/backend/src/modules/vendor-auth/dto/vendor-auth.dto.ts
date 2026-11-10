import { IsEmail, IsIn, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PASSWORD_RULE, PASSWORD_RULE_MESSAGE } from '../vendor-auth.types';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const normalizeEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

// None of these DTOs has a vendorId / storeId / status field: the global
// ValidationPipe (whitelist) strips anything a client adds.

export class VendorLoginDto {
  @ApiProperty() @Transform(normalizeEmail) @IsEmail() @MaxLength(320) email: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(128) password: string;
}

export class VendorAcceptInviteDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) token: string;
  @ApiProperty() @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_RULE_MESSAGE }) password: string;
}

export class VendorForgotPasswordDto {
  @ApiProperty() @Transform(normalizeEmail) @IsEmail() @MaxLength(320) email: string;
}

export class VendorResetPasswordDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) token: string;
  @ApiProperty() @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_RULE_MESSAGE }) password: string;
}

export class VendorChangePasswordDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(128) currentPassword: string;
  @ApiProperty() @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_RULE_MESSAGE }) newPassword: string;
}

export class VendorUpdateProfileDto {
  @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200) name: string;
}

// ── Owner-side ────────────────────────────────────────────────────────────

export class InviteVendorUserDto {
  @ApiProperty({ example: 'orders@suta.example' }) @Transform(normalizeEmail) @IsEmail() @MaxLength(320) email: string;
  @ApiProperty({ example: 'Asha (Suta Boutique)' }) @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200) name: string;
}

export class SetVendorUserStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED', 'REVOKED'] })
  @IsIn(['ACTIVE', 'SUSPENDED', 'REVOKED'])
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
}
