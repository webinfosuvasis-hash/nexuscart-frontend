import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  RetryableVendorEmailError, SENDING_STALE_MS, VENDOR_EMAIL_MAX_ATTEMPTS, VENDOR_ORDER_EMAIL_EVENT,
  VendorOrderNotificationService, sanitizeError,
} from '../vendor-order-notification.service';

const STORE = 'store_1';
const ORDER = 'order_1';

const line = (vendorId: string, sku: string, over: Record<string, unknown> = {}) => ({
  vendorId, productName: `Product ${sku}`, variantName: null, sku, quantity: 1, unitPrice: '500.00', total: '500.00', ...over,
});
const vendor = (id: string, over: Record<string, unknown> = {}) => ({
  id, name: `Vendor ${id}`, email: `${id}@vendors.example`, status: 'ACTIVE', notifyOnOrder: true, ...over,
});

// ---------------------------------------------------------------------------
// In-memory stand-in for the two tables this service writes, enforcing the
// (orderId, vendorId) unique key and the compare-and-swap `where` clauses the
// service relies on — so idempotency is tested, not assumed.
// ---------------------------------------------------------------------------

function matches(row: any, where: any): boolean {
  return Object.entries(where).every(([k, v]: [string, any]) => {
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
    if (v instanceof Date) return row[k]?.getTime() === v.getTime();
    return row[k] === v;
  });
}

function setup(over: { order?: Record<string, unknown>; items?: any[]; vendors?: any[] } = {}) {
  const rows: any[] = [];
  const outbox: any[] = [];
  let seq = 0;
  let clock = 1_000;
  const items = over.items ?? [line('v1', 'A1')];
  const vendors = over.vendors ?? [vendor('v1')];

  const notifications = {
    create: jest.fn(async ({ data }: any) => {
      if (rows.some((r) => r.orderId === data.orderId && r.vendorId === data.vendorId)) {
        throw new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' });
      }
      const row = { id: `n${++seq}`, attempts: 0, lastError: null, nextRetryAt: null, updatedAt: new Date(Date.now() + clock++), ...data };
      rows.push(row);
      return row;
    }),
    findFirst: jest.fn(async ({ where }: any) => { const r = rows.find((x) => matches(x, where)); return r ? { ...r } : null; }),
    updateMany: jest.fn(async ({ where, data }: any) => {
      const hit = rows.filter((r) => matches(r, where));
      for (const r of hit) {
        for (const [k, v] of Object.entries(data) as [string, any][]) {
          r[k] = v && typeof v === 'object' && 'increment' in v ? r[k] + v.increment : v;
        }
        r.updatedAt = new Date(Date.now() + clock++);
      }
      return { count: hit.length };
    }),
    findMany: jest.fn(async () => rows),
    count:    jest.fn(async () => rows.length),
  };

  const prisma = {
    order: {
      findFirst: jest.fn(async ({ select }: any) => {
        const base = { id: ORDER, orderNumber: 'ORD-2026-000042', paymentMethod: 'razorpay', paymentStatus: 'PAID', ...over.order };
        const wantVendor = select?.items?.where?.vendorId;
        const own = typeof wantVendor === 'string'
          ? items.filter((l) => l.vendorId === wantVendor)
          : items.filter((l) => l.vendorId != null);
        return { ...base, items: own };
      }),
    },
    vendor: {
      findMany:  jest.fn(async ({ where }: any) => vendors.filter((v) => where.id.in.includes(v.id))),
      findFirst: jest.fn(async ({ where }: any) => vendors.find((v) => v.id === where.id) ?? null),
    },
    storeSettings: { findFirst: jest.fn().mockResolvedValue({ currency: 'INR' }) },
    vendorOrderNotification: notifications,
    outboxEvent: { create: jest.fn(async ({ data }: any) => { outbox.push(data); return data; }) },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  } as any;

  const email = { send: jest.fn().mockResolvedValue({ status: 'accepted', messageId: '<m1@smtp>' }) } as any;
  const config = { get: jest.fn((_k: string, d: unknown) => d) } as any;
  const service = new VendorOrderNotificationService(prisma, email, config);
  const logs: string[] = [];
  for (const level of ['log', 'warn', 'error'] as const) {
    jest.spyOn((service as any).logger, level).mockImplementation((m: unknown) => { logs.push(String(m)); });
  }
  const rowFor = (vendorId: string) => rows.find((r) => r.vendorId === vendorId);
  const deliverFor = (vendorId: string) => service.deliver({ storeId: STORE, notificationId: rowFor(vendorId).id });
  const sentTo = (addr: string) => email.send.mock.calls.map((c: any[]) => c[0]).find((m: any) => m.to === addr);
  return { prisma, email, service, logs, rows, outbox, rowFor, deliverFor, sentTo };
}

const smtpError = (message: string, responseCode?: number) => Object.assign(new Error(message), { responseCode });

describe('VendorOrderNotificationService — fan-out (ORDER_CREATED)', () => {
  it('queues one notification + one outbox event per vendor; unassigned lines queue nothing', async () => {
    const { service, rows, outbox } = setup({
      items:   [line('v1', 'A1'), line('v2', 'B1'), line('v1', 'A2'), line(null as any, 'OWN')],
      vendors: [vendor('v1'), vendor('v2')],
    });

    const res = await service.fanOut(STORE, ORDER);

    expect(res).toEqual([{ vendorId: 'v1', outcome: 'queued' }, { vendorId: 'v2', outcome: 'queued' }]);
    expect(rows.map((r) => [r.vendorId, r.status])).toEqual([['v1', 'PENDING'], ['v2', 'PENDING']]);
    expect(outbox).toHaveLength(2);
    expect(outbox[0]).toEqual(expect.objectContaining({
      storeId: STORE, eventType: VENDOR_ORDER_EMAIL_EVENT, aggregateId: rows[0].id,
      payload: { storeId: STORE, notificationId: rows[0].id }, maxAttempts: VENDOR_EMAIL_MAX_ATTEMPTS + 2,
    }));
  });

  it('a redelivered ORDER_CREATED queues nothing new (unique per order × vendor)', async () => {
    const { service, outbox } = setup();
    await service.fanOut(STORE, ORDER);
    expect(await service.fanOut(STORE, ORDER)).toEqual([{ vendorId: 'v1', outcome: 'duplicate' }]);
    expect(outbox).toHaveLength(1);
  });

  it('records inactive, notifications-off and deleted vendors as SKIPPED without queueing', async () => {
    const { service, rows, outbox } = setup({
      items:   [line('v1', 'A'), line('v2', 'B'), line('v3', 'C'), line('gone', 'D')],
      vendors: [vendor('v1'), vendor('v2', { status: 'INACTIVE' }), vendor('v3', { notifyOnOrder: false })],
    });

    await service.fanOut(STORE, ORDER);

    expect(rows.map((r) => [r.vendorId, r.status, r.lastError])).toEqual([
      ['v1', 'PENDING', null],
      ['v2', 'SKIPPED', 'Vendor is inactive'],
      ['v3', 'SKIPPED', 'Vendor has order notifications turned off'],
      ['gone', 'SKIPPED', 'Vendor no longer exists'],
    ]);
    expect(outbox).toHaveLength(1);
  });

  it('an order with only the store\'s own products creates nothing', async () => {
    const { service, rows, prisma } = setup({ items: [line(null as any, 'OWN')] });
    expect(await service.fanOut(STORE, ORDER)).toEqual([]);
    expect(rows).toHaveLength(0);
    expect(prisma.vendor.findMany).not.toHaveBeenCalled();
  });

  it('non-duplicate DB errors propagate (so ORDER_CREATED is retried)', async () => {
    const { service, prisma } = setup();
    prisma.vendorOrderNotification.create.mockRejectedValueOnce(new Error('deadlock'));
    await expect(service.fanOut(STORE, ORDER)).rejects.toThrow('deadlock');
  });

  it('scopes every read to the store', async () => {
    const { service, prisma } = setup();
    await service.fanOut(STORE, ORDER);
    expect(prisma.order.findFirst.mock.calls[0][0].where).toEqual({ id: ORDER, storeId: STORE });
    expect(prisma.vendor.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['v1'] }, storeId: STORE });
  });
});

describe('VendorOrderNotificationService — delivery (VENDOR_ORDER_EMAIL)', () => {
  it('sends each vendor only their own lines and marks SENT', async () => {
    const t = setup({
      items:   [line('v1', 'A1'), line('v2', 'B1'), line('v1', 'A2', { quantity: 2, total: '1000.00' })],
      vendors: [vendor('v1'), vendor('v2')],
    });
    await t.service.fanOut(STORE, ORDER);

    expect(await t.deliverFor('v1')).toBe('SENT');
    expect(await t.deliverFor('v2')).toBe('SENT');

    const v1 = t.sentTo('v1@vendors.example');
    expect(v1.text).toContain('A1');
    expect(v1.text).toContain('A2');
    expect(v1.text).not.toContain('B1');
    expect(v1.text).toContain('3 unit(s), INR 1500.00');
    const v2 = t.sentTo('v2@vendors.example');
    expect(v2.text).toContain('B1');
    expect(v2.text).not.toContain('A1');
    expect(t.rowFor('v1')).toEqual(expect.objectContaining({ status: 'SENT', attempts: 1, messageId: '<m1@smtp>', lastError: null }));
    expect(t.rowFor('v1').sentAt).toBeInstanceOf(Date);
  });

  it('a duplicate outbox delivery of a SENT notification does not email again', async () => {
    const t = setup();
    await t.service.fanOut(STORE, ORDER);
    await t.deliverFor('v1');
    expect(await t.deliverFor('v1')).toBe('noop');
    expect(t.email.send).toHaveBeenCalledTimes(1);
  });

  it('a notification already SENDING (another worker, or a crash mid-send) is never auto-resent', async () => {
    const t = setup();
    await t.service.fanOut(STORE, ORDER);
    t.rowFor('v1').status = 'SENDING';
    expect(await t.deliverFor('v1')).toBe('noop');
    expect(t.email.send).not.toHaveBeenCalled();
  });

  it('COD: says payment has not been received and is due on delivery', async () => {
    const t = setup({ order: { paymentMethod: 'cod', paymentStatus: 'PENDING' } });
    await t.service.fanOut(STORE, ORDER);
    await t.deliverFor('v1');
    const msg = t.email.send.mock.calls[0][0];
    expect(msg.text).toContain('Cash on Delivery — payment has NOT been received yet. It is due on delivery.');
    expect(msg.html).toContain('NOT been received');
    expect(msg.text).not.toMatch(/Paid online/);
  });

  it.each([
    ['PAID',    'Paid online (payment confirmed)', null],
    ['PENDING', 'Online payment — not yet confirmed', 'Paid online'],
  ])('online, paymentStatus=%s', async (paymentStatus, expected, forbidden) => {
    const t = setup({ order: { paymentMethod: 'razorpay', paymentStatus } });
    await t.service.fanOut(STORE, ORDER);
    await t.deliverFor('v1');
    const text = t.email.send.mock.calls[0][0].text;
    expect(text).toContain(expected);
    if (forbidden) expect(text).not.toContain(forbidden);
  });

  it('re-checks the vendor at send time: deactivated since queueing → SKIPPED, no email', async () => {
    const t = setup();
    await t.service.fanOut(STORE, ORDER);
    t.prisma.vendor.findFirst.mockResolvedValue(vendor('v1', { status: 'INACTIVE' }));
    expect(await t.deliverFor('v1')).toBe('SKIPPED');
    expect(t.email.send).not.toHaveBeenCalled();
    expect(t.rowFor('v1').lastError).toBe('Vendor is inactive');
  });

  it('transient SMTP failure → RETRYING with backoff and throws so the outbox retries; then succeeds', async () => {
    const t = setup();
    await t.service.fanOut(STORE, ORDER);
    t.email.send.mockRejectedValueOnce(smtpError('connect ETIMEDOUT')).mockRejectedValueOnce(smtpError('421 try later', 421));

    await expect(t.deliverFor('v1')).rejects.toBeInstanceOf(RetryableVendorEmailError);
    expect(t.rowFor('v1')).toEqual(expect.objectContaining({ status: 'RETRYING', attempts: 1, lastError: 'connect ETIMEDOUT' }));
    const delay1 = t.rowFor('v1').nextRetryAt.getTime() - Date.now();
    expect(delay1).toBeGreaterThan(25_000);
    expect(delay1).toBeLessThanOrEqual(30_000);

    await expect(t.deliverFor('v1')).rejects.toBeInstanceOf(RetryableVendorEmailError);
    const delay2 = t.rowFor('v1').nextRetryAt.getTime() - Date.now();
    expect(delay2).toBeGreaterThan(55_000); // exponential: 30s → 60s

    expect(await t.deliverFor('v1')).toBe('SENT');
    expect(t.rowFor('v1')).toEqual(expect.objectContaining({ attempts: 3, lastError: null, nextRetryAt: null }));
    expect(t.email.send).toHaveBeenCalledTimes(3);
  });

  it('stops after the bounded retry budget: FAILED, no throw (no infinite retries)', async () => {
    const t = setup();
    await t.service.fanOut(STORE, ORDER);
    t.email.send.mockRejectedValue(smtpError('ECONNREFUSED'));

    for (let i = 1; i < VENDOR_EMAIL_MAX_ATTEMPTS; i++) {
      await expect(t.deliverFor('v1')).rejects.toBeInstanceOf(RetryableVendorEmailError);
    }
    expect(await t.deliverFor('v1')).toBe('FAILED');
    expect(t.rowFor('v1')).toEqual(expect.objectContaining({ status: 'FAILED', attempts: VENDOR_EMAIL_MAX_ATTEMPTS }));
    expect(await t.deliverFor('v1')).toBe('noop'); // a stray redelivery does nothing
    expect(t.email.send).toHaveBeenCalledTimes(VENDOR_EMAIL_MAX_ATTEMPTS);
  });

  it.each([
    ['5xx thrown by the SMTP server', () => Promise.reject(smtpError('550 5.1.1 <v1@vendors.example>: mailbox unavailable', 550))],
    ['recipient rejected',            () => Promise.resolve({ status: 'rejected', reason: '550 no such user v1@vendors.example' })],
    ['SMTP not configured',           () => Promise.resolve({ status: 'not_configured' })],
  ])('permanent failure (%s) → FAILED at once, no retry, address masked', async (_l, impl) => {
    const t = setup();
    await t.service.fanOut(STORE, ORDER);
    t.email.send.mockImplementation(impl);

    expect(await t.deliverFor('v1')).toBe('FAILED');
    expect(t.rowFor('v1').attempts).toBe(1);
    expect(t.rowFor('v1').lastError).not.toContain('v1@vendors.example');
    expect(t.logs.join('\n')).not.toContain('v1@vendors.example');
    expect(t.logs.some((l) => /accepted/.test(l))).toBe(false);
  });

  it('one vendor failing does not affect another vendor', async () => {
    const t = setup({ items: [line('v1', 'A'), line('v2', 'B')], vendors: [vendor('v1'), vendor('v2')] });
    await t.service.fanOut(STORE, ORDER);
    t.email.send.mockImplementation(async (m: any) => {
      if (m.to.startsWith('v1')) throw smtpError('550 rejected', 550);
      return { status: 'accepted', messageId: '<ok>' };
    });
    expect(await t.deliverFor('v1')).toBe('FAILED');
    expect(await t.deliverFor('v2')).toBe('SENT');
  });

  it('carries no customer or payment identifiers, masks addresses in logs, escapes HTML', async () => {
    const t = setup({
      items:   [line('v1', 'X', { productName: '<img src=x onerror=alert(1)>' })],
      vendors: [vendor('v1', { name: '<b>Evil</b>' })],
    });
    await t.service.fanOut(STORE, ORDER);
    await t.deliverFor('v1');

    const select = t.prisma.order.findFirst.mock.calls.at(-1)[0].select;
    for (const field of ['customerId', 'shippingAddress', 'billingAddress', 'paymentTransactionId', 'total']) {
      expect(select).not.toHaveProperty(field);
    }
    const html = t.email.send.mock.calls[0][0].html;
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>Evil</b>');
    expect(html).toContain('&lt;b&gt;Evil&lt;/b&gt;');
    expect(html).not.toContain(ORDER);
    expect(t.logs.join('\n')).not.toContain('v1@vendors.example');
    expect(t.logs.join('\n')).toContain('v***@vendors.example');
  });

  it('ignores events for another store\'s notification', async () => {
    const t = setup();
    await t.service.fanOut(STORE, ORDER);
    expect(await t.service.deliver({ storeId: 'store_2', notificationId: t.rowFor('v1').id })).toBe('noop');
    expect(t.email.send).not.toHaveBeenCalled();
  });
});

describe('VendorOrderNotificationService — manual resend', () => {
  async function failed() {
    const t = setup();
    await t.service.fanOut(STORE, ORDER);
    t.email.send.mockRejectedValueOnce(smtpError('550 gone', 550));
    await t.deliverFor('v1');
    t.outbox.length = 0;
    return t;
  }

  it('re-queues a FAILED notification with a fresh retry budget, then delivers it', async () => {
    const t = await failed();
    await t.service.resend(STORE, t.rowFor('v1').id);

    expect(t.rowFor('v1')).toEqual(expect.objectContaining({ status: 'PENDING', attempts: 0, lastError: null }));
    expect(t.outbox).toHaveLength(1);
    expect(await t.deliverFor('v1')).toBe('SENT');
  });

  it('refuses to resend a delivered email', async () => {
    const t = setup();
    await t.service.fanOut(STORE, ORDER);
    await t.deliverFor('v1');
    await expect(t.service.resend(STORE, t.rowFor('v1').id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses while already queued (no double re-queue from a double click)', async () => {
    const t = await failed();
    await t.service.resend(STORE, t.rowFor('v1').id);
    await expect(t.service.resend(STORE, t.rowFor('v1').id)).rejects.toThrow('already queued');
    expect(t.outbox).toHaveLength(1);
  });

  it('refuses while a send is in flight, allows it once the send is abandoned', async () => {
    const t = setup();
    await t.service.fanOut(STORE, ORDER);
    Object.assign(t.rowFor('v1'), { status: 'SENDING', updatedAt: new Date() });
    await expect(t.service.resend(STORE, t.rowFor('v1').id)).rejects.toBeInstanceOf(ConflictException);

    t.rowFor('v1').updatedAt = new Date(Date.now() - SENDING_STALE_MS - 1);
    await expect(t.service.resend(STORE, t.rowFor('v1').id)).resolves.toBeTruthy();
  });

  it('two concurrent resends cannot both queue (compare-and-swap)', async () => {
    const t = await failed();
    const id = t.rowFor('v1').id;
    const results = await Promise.allSettled([t.service.resend(STORE, id), t.service.resend(STORE, id)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(t.outbox).toHaveLength(1);
  });

  it('refuses for inactive / notifications-off vendors and for another store', async () => {
    const t = await failed();
    t.prisma.vendor.findFirst.mockResolvedValueOnce(vendor('v1', { status: 'INACTIVE' }));
    await expect(t.service.resend(STORE, t.rowFor('v1').id)).rejects.toBeInstanceOf(BadRequestException);
    t.prisma.vendor.findFirst.mockResolvedValueOnce(vendor('v1', { notifyOnOrder: false }));
    await expect(t.service.resend(STORE, t.rowFor('v1').id)).rejects.toBeInstanceOf(BadRequestException);
    await expect(t.service.resend('store_2', t.rowFor('v1').id)).rejects.toBeInstanceOf(NotFoundException);
    expect(t.outbox).toHaveLength(0);
  });
});

describe('sanitizeError', () => {
  it('masks every address and bounds the length', () => {
    const out = sanitizeError(`550 <asha.rao@example.com> and bob@x.io rejected ${'x'.repeat(600)}`);
    expect(out).not.toMatch(/asha\.rao@|bob@/);
    expect(out).toContain('a***@example.com>');
    expect(out.length).toBe(500);
  });
});

describe('listener wiring', () => {
  // @nestjs/event-emitter swallows listener errors unless suppressErrors=false;
  // a swallowed throw means the outbox marks the event SENT and never retries.
  it('VENDOR_ORDER_EMAIL and ORDER_CREATED listeners let errors reach the outbox', () => {
    const { PaymentOrchestratorNotificationService } = require('../../payment-orchestrator/payment-orchestrator-notification.service');
    const meta = (fn: unknown) => Reflect.getMetadata('EVENT_LISTENER_METADATA', fn as object);
    expect(meta(VendorOrderNotificationService.prototype.deliver)).toEqual([
      { event: VENDOR_ORDER_EMAIL_EVENT, options: { suppressErrors: false } },
    ]);
    expect(meta(PaymentOrchestratorNotificationService.prototype.handleOrderCreated)).toEqual([
      { event: 'ORDER_CREATED', options: { suppressErrors: false } },
    ]);
  });
});
