import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InitiatePaymentDto } from '../dto/initiate-payment.dto';

const errorsFor = async (body: Record<string, unknown>) =>
  (await validate(plainToInstance(InitiatePaymentDto, body), { whitelist: true })).map((e) => e.property);

describe('InitiatePaymentDto — gateways a shopper may use', () => {
  it.each([{}, { gatewayCode: 'cod' }, { gatewayCode: 'razorpay' }])('accepts %j', async (body) => {
    expect(await errorsFor(body)).toEqual([]);
  });

  it.each(['mock', 'upi', 'credit_card', 'debit_card', 'net_banking', 'wallet', 'stripe', 'COD', ''])(
    'rejects gatewayCode %p (internal gateway or a storefront-only method choice)',
    async (gatewayCode) => {
      expect(await errorsFor({ gatewayCode })).toContain('gatewayCode');
    },
  );
});
