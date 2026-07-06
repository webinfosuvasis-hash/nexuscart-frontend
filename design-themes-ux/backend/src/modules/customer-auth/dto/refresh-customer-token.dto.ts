import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshCustomerTokenDto {
  @ApiProperty({ description: 'Raw refresh token previously issued by register/login/refresh' })
  @IsString()
  refreshToken: string;
}
