import { IsEmail, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

enum StaffRole {
  STAFF   = 'STAFF',
  MANAGER = 'MANAGER',
  VIEWER  = 'VIEWER',
}

export class InviteStaffDto {
  @ApiProperty({ example: 'staff@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ enum: StaffRole, default: StaffRole.STAFF })
  @IsOptional()
  @IsEnum(StaffRole, { message: 'role must be STAFF, MANAGER, or VIEWER' })
  role?: StaffRole = StaffRole.STAFF;
}
