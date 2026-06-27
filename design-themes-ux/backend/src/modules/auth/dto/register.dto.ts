import { IsEmail, IsString, MinLength, IsOptional, IsIn, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const BUSINESS_TYPES = ['FASHION', 'ELECTRONICS', 'FURNITURE', 'GROCERY', 'COSMETICS', 'GIFTS', 'LIFESTYLE'] as const;

export class RegisterDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/, {
    message: 'password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;

  @ApiPropertyOptional({ example: 'My Fashion Store' })
  @IsOptional()
  @IsString()
  storeName?: string;

  @ApiPropertyOptional({ enum: BUSINESS_TYPES, example: 'FASHION' })
  @IsOptional()
  @IsIn(BUSINESS_TYPES, { message: `businessType must be one of: ${BUSINESS_TYPES.join(', ')}` })
  businessType?: string;
}
