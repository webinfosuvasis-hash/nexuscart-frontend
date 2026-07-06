import { ApiProperty } from '@nestjs/swagger';

// Swagger-only response shape — mirrors CustomerProfileResponse
// (backend/src/modules/customer-auth/types/customer-auth.types.ts), which
// carries the actual return type. Kept as a real class (not the interface)
// only because Swagger needs decorated properties to render a schema.
export class CustomerProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ nullable: true, type: String })
  phone: string | null;

  @ApiProperty()
  isEmailVerified: boolean;
}
