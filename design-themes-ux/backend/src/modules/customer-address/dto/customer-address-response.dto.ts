import { ApiProperty } from '@nestjs/swagger';

// Swagger-only response shape — mirrors the CustomerAddress Prisma model
// (schema.prisma) field-for-field; there is no separate "public-safe"
// projection needed since nothing sensitive lives on this model.
export class CustomerAddressResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true, type: String })
  label: string | null;

  @ApiProperty({ nullable: true, type: String })
  firstName: string | null;

  @ApiProperty({ nullable: true, type: String })
  lastName: string | null;

  @ApiProperty()
  line1: string;

  @ApiProperty({ nullable: true, type: String })
  line2: string | null;

  @ApiProperty()
  city: string;

  @ApiProperty()
  state: string;

  @ApiProperty()
  postalCode: string;

  @ApiProperty()
  country: string;

  @ApiProperty({ nullable: true, type: String })
  phone: string | null;

  @ApiProperty({ description: 'Single shared default flag — reused by both default-shipping and default-billing (CustomerAddress has no separate shipping/billing default columns)' })
  isDefault: boolean;
}
