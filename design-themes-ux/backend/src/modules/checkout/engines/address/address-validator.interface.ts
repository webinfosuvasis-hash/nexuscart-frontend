export interface AddressInput {
  firstName:  string;
  lastName:   string;
  line1:      string;
  line2?:     string;
  city:       string;
  state:      string;
  postalCode: string;
  country:    string;
  phone:      string;
  email?:     string;
}

export type AddressValidationErrorCode =
  | 'REQUIRED_FIELD'
  | 'INVALID_PHONE'
  | 'INVALID_EMAIL'
  | 'INVALID_POSTAL_CODE'
  | 'INVALID_COUNTRY'
  | 'INVALID_STATE';

export interface AddressValidationError {
  field:   string;
  code:    AddressValidationErrorCode;
  message: string;
}

export interface AddressValidationResult {
  isValid: boolean;
  errors:  AddressValidationError[];
}

export interface ICheckoutAddressValidator {
  validate(address: AddressInput): Promise<AddressValidationResult>;
}
