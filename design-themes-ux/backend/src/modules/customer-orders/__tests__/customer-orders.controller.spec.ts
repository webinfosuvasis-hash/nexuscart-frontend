import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { CustomerOrdersController } from '../customer-orders.controller';
import { CustomerOrdersService } from '../customer-orders.service';
import { CustomerJwtAuthGuard } from '@/modules/customer-auth/guards/customer-jwt-auth.guard';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';

const STORE_ID = 'store_1';
const CUSTOMER_ID = 'cust_1';
const ORDER_ID = 'order_1';
const AUTHENTICATED_CUSTOMER = {
  id: CUSTOMER_ID, storeId: STORE_ID, email: 'priya@example.com', name: 'Priya Sharma', isActive: true,
};

describe('CustomerOrdersController', () => {
  let controller: CustomerOrdersController;
  let service: jest.Mocked<CustomerOrdersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerOrdersController],
      providers: [
        { provide: CustomerOrdersService, useValue: { listOrders: jest.fn(), getOrderDetails: jest.fn() } },
      ],
    }).compile();

    controller = module.get(CustomerOrdersController);
    service = module.get(CustomerOrdersService);
  });

  afterEach(() => jest.clearAllMocks());

  it('list() delegates with the guard-resolved id/storeId and the query dto', async () => {
    const response = { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    service.listOrders.mockResolvedValue(response);
    const query = { page: 1, limit: 20 };

    const result = await controller.list(AUTHENTICATED_CUSTOMER, query as any);

    expect(service.listOrders).toHaveBeenCalledWith(CUSTOMER_ID, STORE_ID, query);
    expect(result).toBe(response);
  });

  it('getOne() delegates with the guard-resolved id/storeId and the order id param', async () => {
    const response = {
      id: ORDER_ID, orderNumber: 'ORD-1', status: OrderStatus.PROCESSING, paymentStatus: PaymentStatus.PAID,
    };
    service.getOrderDetails.mockResolvedValue(response as any);

    const result = await controller.getOne(AUTHENTICATED_CUSTOMER, ORDER_ID);

    expect(service.getOrderDetails).toHaveBeenCalledWith(ORDER_ID, CUSTOMER_ID, STORE_ID);
    expect(result).toBe(response);
  });

  describe('security wiring', () => {
    it('is guarded by CustomerJwtAuthGuard at the class level', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, CustomerOrdersController);
      expect(guards).toContain(CustomerJwtAuthGuard);
    });

    it('is marked @Public() at the class level to bypass the merchant JwtAuthGuard', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, CustomerOrdersController)).toBe(true);
    });
  });
});
