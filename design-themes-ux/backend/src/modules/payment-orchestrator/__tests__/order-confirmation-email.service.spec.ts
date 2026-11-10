import { Prisma } from '@prisma/client';
import { OrderConfirmationEmailService } from '../order-confirmation-email.service';

const STORE = 'store_1';
const ORDER = 'order_1';

function setup(over: { order?: Record<string, unknown>; template?: unknown } = {}) {
  const prisma = {
    storeSettings:     { findFirst: jest.fn().mockResolvedValue({ orderEmailEnabled: true, currency: 'INR' }) },
    order:             { findFirst: jest.fn().mockResolvedValue({
      id: ORDER, orderNumber: 'ORD-2026-000042', total: '24999.00', paymentMethod: 'cod', customerId: 'cust_1', shippingAddress: null,
      ...over.order,
    }) },
    customer:          { findFirst: jest.fn().mockResolvedValue({ email: 'priya@example.com', name: 'Priya Sharma' }) },
    emailTemplate:     { findFirst: jest.fn().mockResolvedValue(over.template ?? null) },
    idempotencyRecord: { create: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  } as any;
  const email = { send: jest.fn().mockResolvedValue({ status: 'accepted', messageId: '<m1@smtp>' }) } as any;
  const service = new OrderConfirmationEmailService(prisma, email);
  service.retryDelaysMs = [0, 0];
  const logs: string[] = [];
  for (const level of ['log', 'warn', 'error'] as const) {
    jest.spyOn((service as any).logger, level).mockImplementation((m: unknown) => { logs.push(String(m)); });
  }
  return { prisma, email, service, logs };
}

describe('OrderConfirmationEmailService', () => {
  it('sends the confirmation with the customer-facing order number and reports accepted', async () => {
    const { email, service, prisma } = setup();

    expect(await service.send(STORE, ORDER)).toBe('accepted');

    const msg = email.send.mock.calls[0][0];
    expect(msg.to).toBe('priya@example.com');
    expect(msg.subject).toContain('ORD-2026-000042');
    expect(msg.html).toContain('ORD-2026-000042');
    expect(msg.text).toContain('Cash on Delivery');
    expect(msg.html).not.toContain(ORDER); // never the internal id
    expect(prisma.idempotencyRecord.deleteMany).not.toHaveBeenCalled(); // claim kept
  });

  it('emails a guest at the address captured on their checkout', async () => {
    const { email, service, prisma } = setup({
      order: { customerId: null, shippingAddress: JSON.stringify({ firstName: 'Asha', lastName: 'Rao', email: 'asha@example.com' }) },
    });

    expect(await service.send(STORE, ORDER)).toBe('accepted');
    expect(email.send.mock.calls[0][0].to).toBe('asha@example.com');
    expect(email.send.mock.calls[0][0].text).toContain('Hi Asha Rao');
    expect(prisma.customer.findFirst).not.toHaveBeenCalled();
  });

  it('a redelivered ORDER_CREATED event does not send a second email', async () => {
    const { email, service, prisma } = setup();
    prisma.idempotencyRecord.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
    );

    expect(await service.send(STORE, ORDER)).toBe('duplicate');
    expect(email.send).not.toHaveBeenCalled();
  });

  it('never claims "sent" when SMTP is not configured, and releases the claim for a later resend', async () => {
    const { email, service, prisma, logs } = setup();
    email.send.mockResolvedValue({ status: 'not_configured' });

    expect(await service.send(STORE, ORDER)).toBe('not_configured');
    expect(prisma.idempotencyRecord.deleteMany).toHaveBeenCalledWith({ where: { key: `email:order-confirmation:${ORDER}` } });
    expect(logs.some((l) => /NOT sent: SMTP is not configured/.test(l))).toBe(true);
    expect(logs.some((l) => /accepted/.test(l))).toBe(false);
  });

  it('retries transient SMTP errors and succeeds', async () => {
    const { email, service } = setup();
    email.send
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockResolvedValueOnce({ status: 'accepted', messageId: '<m2@smtp>' });

    expect(await service.send(STORE, ORDER)).toBe('accepted');
    expect(email.send).toHaveBeenCalledTimes(2);
  });

  it('gives up after the retry budget, reports failed and releases the claim', async () => {
    const { email, service, prisma } = setup();
    email.send.mockRejectedValue(new Error('ECONNREFUSED'));

    expect(await service.send(STORE, ORDER)).toBe('failed');
    expect(email.send).toHaveBeenCalledTimes(3);
    expect(prisma.idempotencyRecord.deleteMany).toHaveBeenCalled();
  });

  it('a recipient rejected by the SMTP server is a failure, not a send', async () => {
    const { email, service } = setup();
    email.send.mockResolvedValue({ status: 'rejected', reason: '550 mailbox unavailable' });

    expect(await service.send(STORE, ORDER)).toBe('failed');
  });

  it('respects the store switch and missing recipients without sending', async () => {
    const off = setup();
    off.prisma.storeSettings.findFirst.mockResolvedValue({ orderEmailEnabled: false, currency: 'INR' });
    expect(await off.service.send(STORE, ORDER)).toBe('disabled');

    const guestNoEmail = setup({ order: { customerId: null, shippingAddress: JSON.stringify({ firstName: 'A' }) } });
    expect(await guestNoEmail.service.send(STORE, ORDER)).toBe('no_recipient');

    expect(off.email.send).not.toHaveBeenCalled();
    expect(guestNoEmail.email.send).not.toHaveBeenCalled();
    expect(guestNoEmail.prisma.idempotencyRecord.create).not.toHaveBeenCalled();
  });

  it('fills merchant template placeholders, HTML-escaping customer-controlled values', async () => {
    const { email, service } = setup({
      order: { customerId: null, shippingAddress: JSON.stringify({ firstName: '<script>x</script>', lastName: '', email: 'a@b.co' }) },
      template: { subject: 'Your order {{orderNumber}}', htmlContent: '<h1>Hi {{customerName}}</h1><p>{{orderNumber}} {{unknown}}</p>' },
    });

    await service.send(STORE, ORDER);

    const msg = email.send.mock.calls[0][0];
    expect(msg.subject).toBe('Your order ORD-2026-000042');
    expect(msg.html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(msg.html).not.toContain('<script>');
    expect(msg.html).toContain('{{unknown}}');
  });

  it('never writes a full email address to the logs', async () => {
    const { service, logs } = setup();
    await service.send(STORE, ORDER);

    expect(logs.join('\n')).not.toContain('priya@example.com');
    expect(logs.join('\n')).toContain('p***@example.com');
  });
});
