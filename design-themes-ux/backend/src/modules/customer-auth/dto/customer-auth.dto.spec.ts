import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterCustomerDto } from './register-customer.dto';
import { LoginCustomerDto } from './login-customer.dto';
import { ChangeCustomerPasswordDto } from './change-customer-password.dto';
import { ForgotPasswordDto } from './forgot-password.dto';
import { ResetPasswordDto } from './reset-password.dto';
import { VerifyEmailDto } from './verify-email.dto';

const VALID_PASSWORD = 'StrongPass123!';
const VALID_TOKEN = 'a'.repeat(64);

describe('RegisterCustomerDto', () => {
  it('accepts a valid payload without phone', async () => {
    const dto = plainToInstance(RegisterCustomerDto, {
      name: 'Priya Sharma',
      email: 'priya@example.com',
      password: VALID_PASSWORD,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts a valid payload with phone', async () => {
    const dto = plainToInstance(RegisterCustomerDto, {
      name: 'Priya Sharma',
      email: 'priya@example.com',
      password: VALID_PASSWORD,
      phone: '9876543210',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    const dto = plainToInstance(RegisterCustomerDto, {
      name: 'Priya Sharma',
      email: 'not-an-email',
      password: VALID_PASSWORD,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a password missing a digit', async () => {
    const dto = plainToInstance(RegisterCustomerDto, {
      name: 'Priya Sharma',
      email: 'priya@example.com',
      password: 'NoDigitsHere',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const dto = plainToInstance(RegisterCustomerDto, {
      name: 'Priya Sharma',
      email: 'priya@example.com',
      password: 'Sh0rt!',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a name longer than 100 characters', async () => {
    const dto = plainToInstance(RegisterCustomerDto, {
      name: 'x'.repeat(101),
      email: 'priya@example.com',
      password: VALID_PASSWORD,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });
});

describe('LoginCustomerDto', () => {
  it('accepts a valid payload', async () => {
    const dto = plainToInstance(LoginCustomerDto, {
      email: 'priya@example.com',
      password: 'anything',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a missing email', async () => {
    const dto = plainToInstance(LoginCustomerDto, { password: 'anything' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('does not enforce password complexity on login', async () => {
    const dto = plainToInstance(LoginCustomerDto, {
      email: 'priya@example.com',
      password: 'x',
    });
    expect(await validate(dto)).toHaveLength(0);
  });
});

describe('ChangeCustomerPasswordDto', () => {
  it('accepts a valid payload', async () => {
    const dto = plainToInstance(ChangeCustomerPasswordDto, {
      oldPassword: 'whatever-it-was',
      newPassword: VALID_PASSWORD,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a weak newPassword', async () => {
    const dto = plainToInstance(ChangeCustomerPasswordDto, {
      oldPassword: 'whatever-it-was',
      newPassword: 'weak',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
  });
});

describe('ForgotPasswordDto', () => {
  it('accepts a valid email', async () => {
    const dto = plainToInstance(ForgotPasswordDto, { email: 'priya@example.com' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    const dto = plainToInstance(ForgotPasswordDto, { email: 'nope' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });
});

describe('ResetPasswordDto', () => {
  it('accepts a valid 64-char token and strong password', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      token: VALID_TOKEN,
      newPassword: VALID_PASSWORD,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a token that is not 64 characters', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      token: 'too-short',
      newPassword: VALID_PASSWORD,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'token')).toBe(true);
  });

  it('rejects a weak newPassword', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      token: VALID_TOKEN,
      newPassword: 'weak',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
  });
});

describe('VerifyEmailDto', () => {
  it('accepts a valid 64-char token', async () => {
    const dto = plainToInstance(VerifyEmailDto, { token: VALID_TOKEN });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a token that is not 64 characters', async () => {
    const dto = plainToInstance(VerifyEmailDto, { token: 'short' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'token')).toBe(true);
  });
});
