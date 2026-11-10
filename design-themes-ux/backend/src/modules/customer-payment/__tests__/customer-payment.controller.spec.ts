import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PaymentTxStatus } from '@prisma/client';
import { CustomerPaymentController } from '../customer-payment.controller';
import { CustomerPaymentService } from '../customer-payment.service';
import { CustomerJwtAuthGuard } from '@/modules/customer-auth/guards/customer-jwt-auth.guard';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';

const STORE_ID = 'store_1';
const CUSTOMER_ID = 'cust_1';
const CHECKOUT_ID = 'checkout_1';
const PAYMENT_ID = 'pay_1';
const AUTHENTICATED_CUSTOMER = {
  id: CUSTOMER_ID, storeId: STORE_ID, email: 'priya@example.com', name: 'Priya Sharma', isActive: true,
};
const INITIATION_RESPONSE = {
  paymentId: PAYMENT_ID, status: PaymentTxStatus.GATEWAY_CREATED, gatewayCode: 'razorpay',
  amountInPaise: 99950, currency: 'INR', orderId: null,
};

describe('CustomerPaymentController', () => {
  let controller: CustomerPaymentController;
  let service: jest.Mocked<CustomerPaymentService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerPaymentController],
      providers: [
        {
          provide: CustomerPaymentService,
          useValue: {
            initiatePayment: jest.fn(),
            getPaymentStatus: jest.fn(),
            retryPayment: jest.fn(),
            getPaymentDetails: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(CustomerPaymentController);
    service = module.get(CustomerPaymentService);
  });

  afterEach(() => jest.clearAllMocks());

  it('initiate() delegates with the guard-resolved customer, checkout id param, dto, and request', async () => {
    service.initiatePayment.mockResolvedValue(INITIATION_RESPONSE);
    const dto = { gatewayCode: 'razorpay' };
    const req = { headers: {} } as any;

    const result = await controller.initiate(AUTHENTICATED_CUSTOMER, CHECKOUT_ID, dto, req);

    expect(service.initiatePayment).toHaveBeenCalledWith(CHECKOUT_ID, AUTHENTICATED_CUSTOMER, dto, req);
    expect(result).toBe(INITIATION_RESPONSE);
  });

  it('getStatus() delegates with the guard-resolved customer and payment id param', async () => {
    service.getPaymentStatus.mockResolvedValue({ id: PAYMENT_ID, status: PaymentTxStatus.CAPTURED, orderId: 'order_1', orderNumber: 'ORD-2026-000001' });

    const result = await controller.getStatus(AUTHENTICATED_CUSTOMER, PAYMENT_ID);

    expect(service.getPaymentStatus).toHaveBeenCalledWith(PAYMENT_ID, AUTHENTICATED_CUSTOMER);
    expect(result.status).toBe(PaymentTxStatus.CAPTURED);
  });

  it('retry() delegates with the guard-resolved customer and payment id param', async () => {
    service.retryPayment.mockResolvedValue({ ...INITIATION_RESPONSE, paymentId: 'pay_2' });

    const result = await controller.retry(AUTHENTICATED_CUSTOMER, PAYMENT_ID);

    expect(service.retryPayment).toHaveBeenCalledWith(PAYMENT_ID, AUTHENTICATED_CUSTOMER);
    expect(result.paymentId).toBe('pay_2');
  });

  it('getDetails() delegates with the guard-resolved customer and payment id param', async () => {
    service.getPaymentDetails.mockResolvedValue({
      id: PAYMENT_ID, status: PaymentTxStatus.CAPTURED, gatewayCode: 'razorpay', amountInPaise: 99950,
      currency: 'INR', attemptNumber: 1, orderId: 'order_1', createdAt: new Date().toISOString(),
      authorizedAt: null, capturedAt: new Date().toISOString(), failedAt: null, cancelledAt: null, refundedAt: null,
    });

    const result = await controller.getDetails(AUTHENTICATED_CUSTOMER, PAYMENT_ID);

    expect(service.getPaymentDetails).toHaveBeenCalledWith(PAYMENT_ID, AUTHENTICATED_CUSTOMER);
    expect(result.orderId).toBe('order_1');
  });

  describe('security wiring', () => {
    it('is guarded by CustomerJwtAuthGuard at the class level', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, CustomerPaymentController);
      expect(guards).toContain(CustomerJwtAuthGuard);
    });

    it('is marked @Public() at the class level to bypass the merchant JwtAuthGuard', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, CustomerPaymentController)).toBe(true);
    });
  });
});
