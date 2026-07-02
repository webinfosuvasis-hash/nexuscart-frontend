import { Injectable } from '@nestjs/common';
import {
  ICheckoutAddressValidator,
  AddressInput,
  AddressValidationResult,
  AddressValidationError,
} from './address-validator.interface';

const INDIA_STATES = new Set([
  'AN','AP','AR','AS','BR','CH','CG','DD','DH','DL','GA','GJ','HR','HP','JK',
  'JH','KA','KL','LD','MP','MH','MN','ML','MZ','NL','OD','PY','PB','RJ','SK',
  'TN','TS','TR','UP','UK','WB',
]);

@Injectable()
export class DefaultCheckoutAddressValidator implements ICheckoutAddressValidator {
  async validate(addr: AddressInput): Promise<AddressValidationResult> {
    const errors: AddressValidationError[] = [];

    const required: [keyof AddressInput, string][] = [
      ['firstName',  'First name'],
      ['lastName',   'Last name'],
      ['line1',      'Address line 1'],
      ['city',       'City'],
      ['state',      'State'],
      ['postalCode', 'Postal code'],
      ['country',    'Country'],
      ['phone',      'Phone number'],
    ];

    for (const [field, label] of required) {
      if (!addr[field] || String(addr[field]).trim() === '') {
        errors.push({ field, code: 'REQUIRED_FIELD', message: `${label} is required` });
      }
    }

    if (addr.phone && !/^\+?[\d\s\-()]{7,15}$/.test(addr.phone.trim())) {
      errors.push({ field: 'phone', code: 'INVALID_PHONE', message: 'Phone number format is invalid' });
    }

    if (addr.email && addr.email.trim() !== '') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr.email.trim())) {
        errors.push({ field: 'email', code: 'INVALID_EMAIL', message: 'Email address format is invalid' });
      }
    }

    if (addr.country === 'IN') {
      if (addr.postalCode && !/^\d{6}$/.test(addr.postalCode.trim())) {
        errors.push({ field: 'postalCode', code: 'INVALID_POSTAL_CODE', message: 'Indian PIN code must be 6 digits' });
      }
      const stateCode = addr.state?.toUpperCase().trim();
      if (stateCode && !INDIA_STATES.has(stateCode)) {
        errors.push({ field: 'state', code: 'INVALID_STATE', message: `Invalid Indian state code: ${addr.state}` });
      }
    }

    if (addr.country && addr.country.trim() !== '' && !/^[A-Z]{2,3}$/.test(addr.country.trim().toUpperCase())) {
      errors.push({ field: 'country', code: 'INVALID_COUNTRY', message: 'Country must be a valid ISO 3166-1 alpha-2/3 code' });
    }

    return { isValid: errors.length === 0, errors };
  }
}
