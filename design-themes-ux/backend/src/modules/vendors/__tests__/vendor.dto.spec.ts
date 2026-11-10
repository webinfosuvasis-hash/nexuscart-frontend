import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateVendorDto, UpdateVendorDto } from '../dto/vendor.dto';
import { CreateProductDto } from '../../products/dto/create-product.dto';

async function errorsFor<T extends object>(cls: new () => T, body: Record<string, unknown>) {
  const dto = plainToInstance(cls, body);
  const errors = await validate(dto, { whitelist: true });
  return { dto, fields: errors.map((e) => e.property) };
}

describe('Vendor DTO validation', () => {
  it('accepts a valid vendor and normalises name and email', async () => {
    const { dto, fields } = await errorsFor(CreateVendorDto, { name: '  Suta Boutique ', email: ' Orders@Suta.Example ' });
    expect(fields).toEqual([]);
    expect(dto.name).toBe('Suta Boutique');
    expect(dto.email).toBe('orders@suta.example');
  });

  it.each([
    ['missing email',  { name: 'A' },                               'email'],
    ['invalid email',  { name: 'A', email: 'not-an-email' },        'email'],
    ['email with spaces inside', { name: 'A', email: 'a b@c.co' },  'email'],
    ['blank name',     { name: '   ', email: 'a@b.co' },            'name'],
    ['name too long',  { name: 'x'.repeat(201), email: 'a@b.co' },  'name'],
    ['unknown status', { name: 'A', email: 'a@b.co', status: 'BANNED' }, 'status'],
    ['non-boolean notifyOnOrder', { name: 'A', email: 'a@b.co', notifyOnOrder: 'yes' }, 'notifyOnOrder'],
  ])('rejects %s', async (_label, body, field) => {
    const { fields } = await errorsFor(CreateVendorDto, body);
    expect(fields).toContain(field);
  });

  it('update allows partial bodies but still validates what is sent', async () => {
    expect((await errorsFor(UpdateVendorDto, { status: 'INACTIVE' })).fields).toEqual([]);
    expect((await errorsFor(UpdateVendorDto, { email: 'nope' })).fields).toContain('email');
  });
});

describe('CreateProductDto.vendorId', () => {
  const base = { name: 'Kurta', price: 999 };

  it('is optional, accepts a string id and accepts null (unassign)', async () => {
    expect((await errorsFor(CreateProductDto, base)).fields).toEqual([]);
    expect((await errorsFor(CreateProductDto, { ...base, vendorId: 'ckvendor123' })).fields).toEqual([]);
    expect((await errorsFor(CreateProductDto, { ...base, vendorId: null })).fields).toEqual([]);
  });

  it('rejects non-string and oversized ids', async () => {
    expect((await errorsFor(CreateProductDto, { ...base, vendorId: 42 })).fields).toContain('vendorId');
    expect((await errorsFor(CreateProductDto, { ...base, vendorId: 'x'.repeat(192) })).fields).toContain('vendorId');
  });

  it('strips vendorCommission — there is no commission model', async () => {
    const { dto } = await errorsFor(CreateProductDto, { ...base, vendorCommission: 15 });
    const errors = await validate(dto, { whitelist: true });
    expect(errors).toEqual([]);
    expect(dto).not.toHaveProperty('vendorCommission');
  });
});
