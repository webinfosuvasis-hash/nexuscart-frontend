import {
  IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum AddressTypeDto {
  SHIPPING = 'SHIPPING',
  BILLING  = 'BILLING',
}

export class AddressDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  firstName: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  lastName: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  line1: string;

  @IsString() @IsOptional() @MaxLength(255)
  line2?: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  city: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  state: string;

  @IsString() @IsNotEmpty() @MaxLength(20)
  postalCode: string;

  @IsString() @IsNotEmpty() @MaxLength(5)
  country: string;

  @IsString() @IsNotEmpty() @MaxLength(20)
  phone: string;

  @IsString() @IsOptional() @MaxLength(255)
  email?: string;

  @IsString() @IsOptional()
  sourceAddressId?: string;
}

export class UpdateAddressDto {
  @IsEnum(AddressTypeDto)
  type: AddressTypeDto;

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @IsOptional()
  billingSameAsShipping?: boolean;
}
