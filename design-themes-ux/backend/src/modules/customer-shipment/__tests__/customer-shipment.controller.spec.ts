import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { OrderStatus } from '@prisma/client';
import { CustomerShipmentController } from '../customer-shipment.controller';
import { CustomerShipmentService } from '../customer-shipment.service';
import { CustomerJwtAuthGuard } from '@/modules/customer-auth/guards/customer-jwt-auth.guard';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';

const STORE_ID = 'store_1';
const CUSTOMER_ID = 'cust_1';
const ORDER_ID = 'order_1';
const AUTHENTICATED_CUSTOMER = {
  id: CUSTOMER_ID, storeId: STORE_ID, email: 'priya@example.com', name: 'Priya Sharma', isActive: true,
};

describe('CustomerShipmentController', () => {
  let controller: CustomerShipmentController;
  let service: jest.Mocked<CustomerShipmentService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerShipmentController],
      providers: [
        { provide: CustomerShipmentService, useValue: { getShipmentDetails: jest.fn(), getTracking: jest.fn() } },
      ],
    }).compile();

    controller = module.get(CustomerShipmentController);
    service = module.get(CustomerShipmentService);
  });

  afterEach(() => jest.clearAllMocks());

  it('getShipment() delegates with the guard-resolved id/storeId and the order id param', async () => {
    const response = { orderId: ORDER_ID, orderNumber: 'ORD-1', shipments: [] };
    service.getShipmentDetails.mockResolvedValue(response);

    const result = await controller.getShipment(AUTHENTICATED_CUSTOMER, ORDER_ID);

    expect(service.getShipmentDetails).toHaveBeenCalledWith(ORDER_ID, CUSTOMER_ID, STORE_ID);
    expect(result).toBe(response);
  });

  it('getTracking() delegates with the guard-resolved id/storeId and the order id param', async () => {
    const response = {
      orderId: ORDER_ID, orderNumber: 'ORD-1', orderStatus: OrderStatus.SHIPPED, timeline: [], shipments: [],
    };
    service.getTracking.mockResolvedValue(response);

    const result = await controller.getTracking(AUTHENTICATED_CUSTOMER, ORDER_ID);

    expect(service.getTracking).toHaveBeenCalledWith(ORDER_ID, CUSTOMER_ID, STORE_ID);
    expect(result).toBe(response);
  });

  describe('security wiring', () => {
    it('is guarded by CustomerJwtAuthGuard at the class level', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, CustomerShipmentController);
      expect(guards).toContain(CustomerJwtAuthGuard);
    });

    it('is marked @Public() at the class level to bypass the merchant JwtAuthGuard', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, CustomerShipmentController)).toBe(true);
    });
  });
});
