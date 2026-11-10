import { Test, TestingModule } from '@nestjs/testing';
import { AdminInvoiceController } from '../admin-invoice.controller';
import { InvoiceService } from '../invoice.service';
import { InvoicePdfService } from '../invoice-pdf.service';

const STORE_ID = 'store_1';
const ORDER_ID = 'order_1';

describe('AdminInvoiceController', () => {
  let controller: AdminInvoiceController;
  let invoiceService: jest.Mocked<InvoiceService>;
  let invoicePdf: jest.Mocked<InvoicePdfService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminInvoiceController],
      providers: [
        { provide: InvoiceService, useValue: { getInvoiceData: jest.fn() } },
        { provide: InvoicePdfService, useValue: { render: jest.fn() } },
      ],
    }).compile();

    controller = module.get(AdminInvoiceController);
    invoiceService = module.get(InvoiceService);
    invoicePdf = module.get(InvoicePdfService);
  });

  afterEach(() => jest.clearAllMocks());

  it('getInvoiceData() delegates with the store-scoped id and order id param', async () => {
    const data = { invoiceNumber: 'INV-2026-000001' } as any;
    invoiceService.getInvoiceData.mockResolvedValue(data);

    const result = await controller.getInvoiceData(STORE_ID, ORDER_ID);

    expect(invoiceService.getInvoiceData).toHaveBeenCalledWith(ORDER_ID, STORE_ID);
    expect(result).toBe(data);
  });

  it('downloadInvoice() renders the PDF and sets the correct headers', async () => {
    const data = { invoiceNumber: 'INV-2026-000001' } as any;
    const pdfBuffer = Buffer.from('%PDF-fake');
    invoiceService.getInvoiceData.mockResolvedValue(data);
    invoicePdf.render.mockResolvedValue(pdfBuffer);

    const res = { setHeader: jest.fn(), send: jest.fn() } as any;
    await controller.downloadInvoice(STORE_ID, ORDER_ID, res);

    expect(invoiceService.getInvoiceData).toHaveBeenCalledWith(ORDER_ID, STORE_ID);
    expect(invoicePdf.render).toHaveBeenCalledWith(data);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'inline; filename="invoice-INV-2026-000001.pdf"');
    expect(res.send).toHaveBeenCalledWith(pdfBuffer);
  });
});
