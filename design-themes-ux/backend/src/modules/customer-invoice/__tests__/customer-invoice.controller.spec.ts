import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CustomerInvoiceController } from '../customer-invoice.controller';
import { CustomerInvoiceService } from '../customer-invoice.service';
import { InvoicePdfService } from '@/modules/invoice/invoice-pdf.service';
import { CustomerJwtAuthGuard } from '@/modules/customer-auth/guards/customer-jwt-auth.guard';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';

const STORE_ID = 'store_1';
const CUSTOMER_ID = 'cust_1';
const ORDER_ID = 'order_1';
const AUTHENTICATED_CUSTOMER = {
  id: CUSTOMER_ID, storeId: STORE_ID, email: 'priya@example.com', name: 'Priya Sharma', isActive: true,
};

describe('CustomerInvoiceController', () => {
  let controller: CustomerInvoiceController;
  let service: jest.Mocked<CustomerInvoiceService>;
  let invoicePdf: jest.Mocked<InvoicePdfService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerInvoiceController],
      providers: [
        { provide: CustomerInvoiceService, useValue: { getMyInvoiceData: jest.fn() } },
        { provide: InvoicePdfService, useValue: { render: jest.fn() } },
      ],
    }).compile();

    controller = module.get(CustomerInvoiceController);
    service = module.get(CustomerInvoiceService);
    invoicePdf = module.get(InvoicePdfService);
  });

  afterEach(() => jest.clearAllMocks());

  it('getInvoiceData() delegates with the guard-resolved id/storeId and the order id param', async () => {
    const data = { invoiceNumber: 'INV-2026-000001' } as any;
    service.getMyInvoiceData.mockResolvedValue(data);

    const result = await controller.getInvoiceData(AUTHENTICATED_CUSTOMER as any, ORDER_ID);

    expect(service.getMyInvoiceData).toHaveBeenCalledWith(ORDER_ID, CUSTOMER_ID, STORE_ID);
    expect(result).toBe(data);
  });

  it('downloadInvoice() renders the PDF and sets the correct headers', async () => {
    const data = { invoiceNumber: 'INV-2026-000001' } as any;
    const pdfBuffer = Buffer.from('%PDF-fake');
    service.getMyInvoiceData.mockResolvedValue(data);
    invoicePdf.render.mockResolvedValue(pdfBuffer);
    const res = { setHeader: jest.fn(), send: jest.fn() } as any;

    await controller.downloadInvoice(AUTHENTICATED_CUSTOMER as any, ORDER_ID, res);

    expect(service.getMyInvoiceData).toHaveBeenCalledWith(ORDER_ID, CUSTOMER_ID, STORE_ID);
    expect(invoicePdf.render).toHaveBeenCalledWith(data);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'inline; filename="invoice-INV-2026-000001.pdf"');
    expect(res.send).toHaveBeenCalledWith(pdfBuffer);
  });

  describe('security wiring', () => {
    it('is guarded by CustomerJwtAuthGuard at the class level', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, CustomerInvoiceController);
      expect(guards).toContain(CustomerJwtAuthGuard);
    });

    it('is marked @Public() at the class level to bypass the merchant JwtAuthGuard', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, CustomerInvoiceController)).toBe(true);
    });
  });
});
