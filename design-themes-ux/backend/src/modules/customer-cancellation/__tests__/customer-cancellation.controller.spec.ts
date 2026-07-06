import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { OrderStatus } from '@prisma/client';
import { CustomerCancellationController } from '../customer-cancellation.controller';
import { CustomerCancellationService } from '../customer-cancellation.service';
import { CustomerJwtAuthGuard } from '@/modules/customer-auth/guards/customer-jwt-auth.guard';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';

const STORE_ID = 'store_1';
const CUSTOMER_ID = 'cust_1';
const ORDER_ID = 'order_1';
const AUTHENTICATED_CUSTOMER = {
  id: CUSTOMER_ID, storeId: STORE_ID, email: 'priya@example.com', name: 'Priya Sharma', isActive: true,
};

describe('CustomerCancellationController', () => {
  let controller: CustomerCancellationController;
  let service: jest.Mocked<CustomerCancellationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerCancellationController],
      providers: [
        {
          provide: CustomerCancellationService,
          useValue: { requestCancellation: jest.fn(), getCancellationStatus: jest.fn(), getRefundStatus: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(CustomerCancellationController);
    service = module.get(CustomerCancellationService);
  });

  afterEach(() => jest.clearAllMocks());

  it('cancelMyOrder() delegates with the guard-resolved id/storeId, the order id param, and the request body reason', async () => {
    const response = {
      orderId: ORDER_ID, orderNumber: 'ORD-1', orderStatus: OrderStatus.CANCELLED, canCancel: false,
      isCancelled: true, cancelledAt: '2026-01-02T00:00:00.000Z', cancellationReason: 'Changed my mind',
      paymentAction: 'CANCELLED', timeline: [],
    };
    service.requestCancellation.mockResolvedValue(response as any);

    const result = await controller.cancelMyOrder(AUTHENTICATED_CUSTOMER as any, ORDER_ID, { reason: 'Changed my mind' });

    expect(service.requestCancellation).toHaveBeenCalledWith(ORDER_ID, CUSTOMER_ID, STORE_ID, 'Changed my mind');
    expect(result).toBe(response);
  });

  it('getCancellationStatus() delegates with the guard-resolved id/storeId and the order id param', async () => {
    const response = {
      orderId: ORDER_ID, orderNumber: 'ORD-1', orderStatus: OrderStatus.PENDING, canCancel: true,
      isCancelled: false, cancelledAt: null, cancellationReason: null, timeline: [],
    };
    service.getCancellationStatus.mockResolvedValue(response as any);

    const result = await controller.getCancellationStatus(AUTHENTICATED_CUSTOMER as any, ORDER_ID);

    expect(service.getCancellationStatus).toHaveBeenCalledWith(ORDER_ID, CUSTOMER_ID, STORE_ID);
    expect(result).toBe(response);
  });

  it('getRefundStatus() delegates with the guard-resolved id/storeId and the order id param', async () => {
    const response = { orderId: ORDER_ID, orderNumber: 'ORD-1', hasRefund: false, refund: null };
    service.getRefundStatus.mockResolvedValue(response as any);

    const result = await controller.getRefundStatus(AUTHENTICATED_CUSTOMER as any, ORDER_ID);

    expect(service.getRefundStatus).toHaveBeenCalledWith(ORDER_ID, CUSTOMER_ID, STORE_ID);
    expect(result).toBe(response);
  });

  describe('security wiring', () => {
    it('is guarded by CustomerJwtAuthGuard at the class level', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, CustomerCancellationController);
      expect(guards).toContain(CustomerJwtAuthGuard);
    });

    it('is marked @Public() at the class level to bypass the merchant JwtAuthGuard', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, CustomerCancellationController)).toBe(true);
    });
  });
});
