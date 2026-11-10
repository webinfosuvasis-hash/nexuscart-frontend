import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddressDto } from './update-address.dto';

const address = (email?: unknown) => plainToInstance(AddressDto, {
  firstName: 'Asha', lastName: 'Rao', line1: '1 MG Road', city: 'Bengaluru', state: 'KA',
  postalCode: '560001', phone: '9876543210', ...(email === undefined ? {} : { email }),
});

const emailErrors = async (email?: unknown) =>
  (await validate(address(email))).filter((e) => e.property === 'email');

describe('checkout address email (guest checkout contact + gateway payer)', () => {
  it('accepts a valid email', async () => {
    expect(await emailErrors('asha@example.com')).toHaveLength(0);
  });

  it('stays optional — signed-in customers may omit it', async () => {
    expect(await emailErrors()).toHaveLength(0);
  });

  it.each(['not-an-email', 'asha@', '@example.com', 'asha example.com'])('rejects %p', async (email) => {
    expect(await emailErrors(email)).not.toHaveLength(0);
  });
});
