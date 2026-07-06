import { ApiProperty } from '@nestjs/swagger';

// FI-2 — Swagger-only response shapes. Documents exactly what
// CustomerAuthController's handlers return; no behavior lives here.

export class CustomerTokenPairResponseDto {
  @ApiProperty({ description: 'Short-lived JWT sent as `Authorization: Bearer <token>` on subsequent requests' })
  accessToken: string;

  @ApiProperty({ description: 'Long-lived token used to obtain a new pair via POST /customer/auth/refresh' })
  refreshToken: string;
}

export class CustomerMeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  storeId: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  isActive: boolean;
}

export class CustomerAuthMessageResponseDto {
  @ApiProperty({ example: 'Logged out' })
  message: string;
}
