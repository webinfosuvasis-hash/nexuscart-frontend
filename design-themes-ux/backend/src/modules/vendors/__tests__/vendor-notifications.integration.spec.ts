/**
 * End-to-end check of vendor order emails against a REAL database and a REAL
 * SMTP conversation — no Prisma or EmailService mocks:
 *
 *   ORDER_CREATED outbox event → OutboxProcessorService → customer confirmation
 *   + vendor fan-out → VENDOR_ORDER_EMAIL outbox events → nodemailer → a local
 *   fake SMTP server that records messages and can answer 4xx / 5xx.
 *
 * Skipped unless VENDOR_IT_DATABASE_URL points at a LOCAL, disposable MySQL /
 * MariaDB database that already has the schema (see the staging checklist).
 * It refuses any non-local host so it can never touch a shared database.
 *
 *   VENDOR_IT_DATABASE_URL=mysql://root@127.0.0.1:3399/nexus_it npx jest vendor-notifications.integration
 */
import * as net from 'net';
import { ConflictException, Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaService } from '@/prisma/prisma.service';
import { EmailModule } from '@/shared/email/email.module';
import { OutboxProcessorService } from '../../outbox/outbox-processor.service';
import { PaymentOrchestratorNotificationService } from '../../payment-orchestrator/payment-orchestrator-notification.service';
import { OrderConfirmationEmailService } from '../../payment-orchestrator/order-confirmation-email.service';
import { VendorsModule } from '../vendors.module';
import { VendorOrderNotificationService, VENDOR_EMAIL_MAX_ATTEMPTS } from '../vendor-order-notification.service';
import { VendorsService } from '../vendors.service';
import { ProductsService } from '../../products/products.service';

const DB_URL = process.env.VENDOR_IT_DATABASE_URL ?? '';
const isLocal = /^mysql:\/\/[^@]*@(127\.0\.0\.1|localhost)(:\d+)?\//.test(DB_URL);
if (DB_URL && !isLocal) throw new Error('VENDOR_IT_DATABASE_URL must point at 127.0.0.1/localhost');
const describeIt = isLocal ? describe : describe.skip;

// ── Minimal SMTP server ──────────────────────────────────────────────────────

type Behaviour = 'ok' | 'temp' | 'perm';
interface Received { from: string; to: string[]; data: string }

function startSmtp() {
  const received: Received[] = [];
  const behaviour = new Map<string, Behaviour[]>(); // per-recipient script; last entry repeats
  const next = (rcpt: string): Behaviour => {
    const script = behaviour.get(rcpt);
    if (!script?.length) return 'ok';
    return script.length > 1 ? script.shift()! : script[0];
  };
  const server = net.createServer((sock) => {
    let mail: Received = { from: '', to: [], data: '' };
    let inData = false;
    let buf = '';
    sock.write('220 fake-smtp ready\r\n');
    sock.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      let idx: number;
      while ((idx = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        if (inData) {
          if (line === '.') { inData = false; received.push(mail); sock.write('250 2.0.0 queued as fake\r\n'); mail = { from: '', to: [], data: '' }; }
          else mail.data += (line.startsWith('..') ? line.slice(1) : line) + '\n';
          continue;
        }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO') sock.write('250-fake-smtp\r\n250 8BITMIME\r\n');
        else if (cmd === 'HELO') sock.write('250 fake-smtp\r\n');
        else if (cmd === 'MAIL') { mail.from = line.slice(10).replace(/[<>]/g, ''); sock.write('250 OK\r\n'); }
        else if (cmd === 'RCPT') {
          const rcpt = line.replace(/^RCPT TO:\s*/i, '').replace(/[<>]/g, '').trim();
          const b = next(rcpt);
          if (b === 'temp') sock.write(`451 4.3.0 <${rcpt}>: temporarily unavailable\r\n`);
          else if (b === 'perm') sock.write(`550 5.1.1 <${rcpt}>: mailbox unavailable\r\n`);
          else { mail.to.push(rcpt); sock.write('250 OK\r\n'); }
        } else if (cmd === 'DATA') { inData = true; sock.write('354 go ahead\r\n'); }
        else if (cmd === 'RSET') { mail = { from: '', to: [], data: '' }; sock.write('250 OK\r\n'); }
        else if (cmd === 'QUIT') { sock.end('221 bye\r\n'); }
        else sock.write('250 OK\r\n');
      }
    });
    sock.on('error', () => undefined);
  });
  return new Promise<{ port: number; received: Received[]; behaviour: typeof behaviour; close: () => Promise<void> }>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      port: (server.address() as net.AddressInfo).port, received, behaviour,
      close: () => new Promise((r) => server.close(() => r())),
    }));
  });
}

// Quoted-printable bodies wrap lines and encode '=' — decode before asserting.
const decodeQP = (s: string) => Buffer.from(
  s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16))), 'latin1',
).toString('utf8');

// ── Suite ────────────────────────────────────────────────────────────────────

describeIt('Vendor order emails — real DB + real SMTP conversation', () => {
  jest.setTimeout(120_000);

  let prisma: PrismaService;
  let smtp: Awaited<ReturnType<typeof startSmtp>>;
  let outbox: OutboxProcessorService;
  let notifications: VendorOrderNotificationService;
  let vendorsSvc: VendorsService;
  let productsSvc: ProductsService;
  let close: () => Promise<void>;

  const RUN = `it${Date.now()}`;
  const ids: Record<string, string> = {};
  const to = (name: string) => `${name}.${RUN}@vendors.test`;

  /** Lets every scheduled retry run now (stands in for waiting out the backoff). */
  const advanceClock = () =>
    prisma.$executeRawUnsafe(`UPDATE outbox_events SET nextRetryAt = '2000-01-01' WHERE status = 'PENDING' AND storeId = ?`, ids.store);
  const drain = async (rounds = 1) => { for (let i = 0; i < rounds; i++) { await advanceClock(); await outbox.processBatch(); } };
  const row = (orderId: string, vendorId: string) =>
    prisma.vendorOrderNotification.findUnique({ where: { orderId_vendorId: { orderId, vendorId } } });
  const mailsTo = (addr: string) => smtp.received.filter((m) => m.to.includes(addr));

  async function placeOrder(key: string, paymentMethod: string, paymentStatus: 'PENDING' | 'PAID', lines: Array<[string, string | null]>) {
    const order = await prisma.order.create({
      data: {
        storeId: ids.store, orderNumber: `ORD-${RUN}-${key}`, status: 'PENDING', paymentStatus, paymentMethod,
        subtotal: 1000, total: 1000, customerId: ids.customer,
        items: { create: lines.map(([productKey, vendorKey], i) => ({
          productId: ids[productKey], productName: `Product ${productKey}`, sku: `SKU-${productKey}-${RUN}`,
          quantity: i + 1, unitPrice: 500, total: 500 * (i + 1), vendorId: vendorKey ? ids[vendorKey] : null,
        })) },
      },
    });
    // What PaymentOrchestratorService.completePayment persists for every order path.
    await prisma.outboxEvent.create({
      data: {
        storeId: ids.store, eventType: 'ORDER_CREATED', aggregateId: order.id, aggregateType: 'Order',
        payload: { orderId: order.id, orderNumber: order.orderNumber, storeId: ids.store },
      },
    });
    return order;
  }

  beforeAll(async () => {
    smtp = await startSmtp();

    @Global()
    @Module({ providers: [{ provide: PrismaService, useFactory: () => new PrismaService({ datasourceUrl: DB_URL }) }], exports: [PrismaService] })
    class LocalPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true, ignoreEnvFile: true,
          load: [() => ({
            SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_FROM: 'NexusCart <noreply@nexuscart.test>',
            OUTBOX_BATCH_SIZE: 50, OUTBOX_MAX_BACKOFF_MINUTES: 60,
          })],
        }),
        EventEmitterModule.forRoot({ wildcard: true }),
        LocalPrismaModule, EmailModule, VendorsModule,
      ],
      providers: [OutboxProcessorService, PaymentOrchestratorNotificationService, OrderConfirmationEmailService, ProductsService],
    }).compile();
    const app = moduleRef.createNestApplication({ logger: ['error'] });
    await app.init(); // registers @OnEvent listeners, connects Prisma
    close = () => app.close();

    prisma        = moduleRef.get(PrismaService);
    outbox        = moduleRef.get(OutboxProcessorService);
    notifications = moduleRef.get(VendorOrderNotificationService);
    vendorsSvc    = moduleRef.get(VendorsService);
    productsSvc   = moduleRef.get(ProductsService);

    // Only this run's rows are processed by the outbox in this test DB.
    await prisma.outboxEvent.updateMany({ where: { status: { in: ['PENDING', 'PROCESSING'] } }, data: { status: 'DEAD' } });

    const owner = await prisma.user.create({ data: { email: `owner.${RUN}@store.test`, name: 'Owner', password: 'x' } });
    const store = await prisma.store.create({ data: { name: `Store ${RUN}`, slug: `store-${RUN}`, domain: `${RUN}.test`, ownerId: owner.id } });
    ids.store = store.id;
    await prisma.storeSettings.create({ data: { storeId: store.id, orderEmailEnabled: true } as any });
    const otherOwner = await prisma.user.create({ data: { email: `other.${RUN}@store.test`, name: 'Other', password: 'x' } });
    const other = await prisma.store.create({ data: { name: `Other ${RUN}`, slug: `other-${RUN}`, domain: `other-${RUN}.test`, ownerId: otherOwner.id } });
    ids.otherStore = other.id;
    const customer = await prisma.customer.create({ data: { storeId: store.id, email: to('customer'), name: 'Asha Rao' } as any });
    ids.customer = customer.id;

    for (const [key, status, notifyOnOrder] of [
      ['vOk', 'ACTIVE', true], ['vFlaky', 'ACTIVE', true], ['vBounce', 'ACTIVE', true],
      ['vInactive', 'INACTIVE', true], ['vMuted', 'ACTIVE', false], ['vDown', 'ACTIVE', true],
    ] as const) {
      const v = await vendorsSvc.create(store.id, { name: `${key} ${RUN}`, email: to(key), status, notifyOnOrder });
      ids[key] = v.id;
    }
    ids.foreignVendor = (await vendorsSvc.create(other.id, { name: `Foreign ${RUN}`, email: to('foreign') })).id;

    const cat = await prisma.category.create({ data: { storeId: store.id, name: 'Kurtas', slug: `kurtas-${RUN}` } });
    for (const key of ['pOk', 'pFlaky', 'pBounce', 'pInactive', 'pMuted', 'pDown', 'pOwn']) {
      const p = await productsSvc.create(store.id, {
        name: `${key} ${RUN}`, price: 500, sku: `SKU-${key}-${RUN}`, categoryId: cat.id,
        vendorId: key === 'pOwn' || key === 'pInactive' ? undefined : ids[`v${key.slice(1)}`],
      });
      ids[key] = p.id;
    }
    // pInactive was assigned while its vendor was active (assignment check applies to new assignments only).
    await prisma.product.update({ where: { id: ids.pInactive }, data: { vendorId: ids.vInactive } });
  });

  afterAll(async () => {
    await close?.();
    await smtp?.close();
  });

  it('Prisma stores DateTime in UTC (the outbox compares nextRetryAt against UTC_TIMESTAMP())', async () => {
    const ev = await prisma.outboxEvent.create({
      data: { storeId: ids.store, eventType: 'TZ_PROBE', aggregateId: 'x', aggregateType: 'x', payload: {}, status: 'DEAD' },
    });
    const [{ drift }] = await prisma.$queryRawUnsafe<Array<{ drift: bigint }>>(
      'SELECT ABS(TIMESTAMPDIFF(SECOND, nextRetryAt, UTC_TIMESTAMP(3))) AS drift FROM outbox_events WHERE id = ?', ev.id,
    );
    expect(Number(drift)).toBeLessThan(60);
  });

  it('product rules hold against the real DB: cross-store and inactive vendors rejected, duplicate works', async () => {
    await expect(productsSvc.create(ids.store, { name: `X ${RUN}`, price: 1, vendorId: ids.foreignVendor }))
      .rejects.toThrow('does not refer to a vendor in this store');
    await expect(productsSvc.update(ids.store, ids.pOwn, { vendorId: ids.vInactive }))
      .rejects.toThrow('Inactive vendors cannot be assigned');
    await expect(vendorsSvc.create(ids.store, { name: `vOk ${RUN}`, email: to('dupe') })).rejects.toBeInstanceOf(ConflictException);
    await expect(vendorsSvc.remove(ids.store, ids.vOk)).rejects.toBeInstanceOf(ConflictException);
    await expect(vendorsSvc.findOne(ids.otherStore, ids.vOk)).rejects.toThrow('Vendor not found');

    const copy = await productsSvc.duplicate(ids.store, ids.pOk);
    expect(copy.vendorId).toBe(ids.vOk);
    const inactiveCopy = await productsSvc.duplicate(ids.store, ids.pInactive);
    expect(inactiveCopy.vendorId).toBeNull();

    const unassigned = await productsSvc.update(ids.store, copy.id, { vendorId: null });
    expect(unassigned.vendorId).toBeNull();
  });

  it('tags and images survive create → read → partial update → tag update → duplicate, in the storefront\'s format', async () => {
    const { parseJsonArray } = require('@/common/catalog/product-query.util');
    const created = await productsSvc.create(ids.store, {
      name: `Tagged ${RUN}`, price: 10, sku: `SKU-tagged-${RUN}`,
      tags: ['cotton', 'summer'], images: ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'],
    });
    const read = await productsSvc.findOne(ids.store, created.id);
    expect(parseJsonArray(read.tags)).toEqual(['cotton', 'summer']);
    expect(parseJsonArray(read.images)).toEqual(['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg']);

    await productsSvc.update(ids.store, created.id, { name: `Tagged renamed ${RUN}` }); // tags/images omitted
    const afterRename = await productsSvc.findOne(ids.store, created.id);
    expect(parseJsonArray(afterRename.tags)).toEqual(['cotton', 'summer']);
    expect(parseJsonArray(afterRename.images)).toHaveLength(2);

    await productsSvc.update(ids.store, created.id, { tags: ['silk'] });
    const afterTags = await productsSvc.findOne(ids.store, created.id);
    expect(parseJsonArray(afterTags.tags)).toEqual(['silk']);
    expect(parseJsonArray(afterTags.images)).toHaveLength(2);

    const copy = await productsSvc.duplicate(ids.store, created.id);
    expect(parseJsonArray(copy.tags)).toEqual(['silk']);
    expect(parseJsonArray(copy.images)).toHaveLength(2);
  });

  let codOrder: { id: string; orderNumber: string };

  it('COD order across six vendors + own stock: one email per deliverable vendor, retries, permanent failure, skips', async () => {
    smtp.behaviour.set(to('vFlaky'), ['temp', 'temp', 'ok']);
    smtp.behaviour.set(to('vBounce'), ['perm']);
    codOrder = await placeOrder('cod', 'cod', 'PENDING', [
      ['pOk', 'vOk'], ['pFlaky', 'vFlaky'], ['pBounce', 'vBounce'], ['pInactive', 'vInactive'], ['pMuted', 'vMuted'], ['pOwn', null],
    ]);

    await outbox.processBatch();          // ORDER_CREATED: customer email + fan-out
    expect(mailsTo(to('customer'))).toHaveLength(1);
    expect((await row(codOrder.id, ids.vInactive))?.status).toBe('SKIPPED');
    expect((await row(codOrder.id, ids.vMuted))?.status).toBe('SKIPPED');

    await drain();                        // first delivery round
    expect((await row(codOrder.id, ids.vOk))?.status).toBe('SENT');
    expect(await row(codOrder.id, ids.vFlaky)).toEqual(expect.objectContaining({ status: 'RETRYING', attempts: 1 }));
    const bounce = await row(codOrder.id, ids.vBounce);
    expect(bounce).toEqual(expect.objectContaining({ status: 'FAILED', attempts: 1 }));
    expect(bounce!.lastError).toContain('550');
    expect(bounce!.lastError).not.toContain(to('vBounce'));

    await drain(3);
    expect(await row(codOrder.id, ids.vFlaky)).toEqual(expect.objectContaining({ status: 'SENT', attempts: 3, lastError: null }));

    const okMail = decodeQP(mailsTo(to('vOk'))[0].data);
    expect(okMail).toContain(`SKU-pOk-${RUN}`);
    expect(okMail).not.toContain(`SKU-pFlaky-${RUN}`);
    expect(okMail).not.toContain(`SKU-pOwn-${RUN}`);
    expect(okMail).toContain('payment has NOT been received yet. It is due on delivery.');
    expect(okMail).not.toContain('Asha Rao');
    expect(okMail).not.toContain(to('customer'));
    expect(mailsTo(to('vFlaky'))).toHaveLength(1);
    for (const v of ['vBounce', 'vInactive', 'vMuted']) expect(mailsTo(to(v))).toHaveLength(0);
  });

  it('a redelivered ORDER_CREATED sends nothing new to the customer or any vendor', async () => {
    const before = smtp.received.length;
    const rowsBefore = await prisma.vendorOrderNotification.count({ where: { orderId: codOrder.id } });
    await prisma.outboxEvent.create({
      data: { storeId: ids.store, eventType: 'ORDER_CREATED', aggregateId: codOrder.id, aggregateType: 'Order',
        payload: { orderId: codOrder.id, orderNumber: codOrder.orderNumber, storeId: ids.store } },
    });
    await drain(3);
    expect(smtp.received.length).toBe(before);
    expect(await prisma.vendorOrderNotification.count({ where: { orderId: codOrder.id } })).toBe(rowsBefore);
  });

  it('manual resend delivers a FAILED email exactly once and refuses a delivered one', async () => {
    smtp.behaviour.set(to('vBounce'), ['ok']);
    const failed = await row(codOrder.id, ids.vBounce);
    await notifications.resend(ids.store, failed!.id);
    await expect(notifications.resend(ids.store, failed!.id)).rejects.toBeInstanceOf(ConflictException); // in flight
    await drain(2);
    expect((await row(codOrder.id, ids.vBounce))?.status).toBe('SENT');
    expect(mailsTo(to('vBounce'))).toHaveLength(1);
    await expect(notifications.resend(ids.store, failed!.id)).rejects.toThrow('already delivered');
    await expect(notifications.resend(ids.otherStore, failed!.id)).rejects.toThrow('not found');
  });

  it('online paid order is described as paid; unconfirmed online is not', async () => {
    const paid = await placeOrder('paid', 'razorpay', 'PAID', [['pOk', 'vOk']]);
    const unconfirmed = await placeOrder('unconf', 'razorpay', 'PENDING', [['pOk', 'vOk']]);
    await drain(3);
    const bodies = mailsTo(to('vOk')).map((m) => decodeQP(m.data));
    expect(bodies.find((b) => b.includes(paid.orderNumber))).toContain('Paid online (payment confirmed)');
    const u = bodies.find((b) => b.includes(unconfirmed.orderNumber))!;
    expect(u).toContain('Online payment — not yet confirmed');
    expect(u).not.toContain('Paid online');
  });

  it('a vendor whose server never recovers stops after the bounded budget — FAILED, nothing delivered, outbox settled', async () => {
    smtp.behaviour.set(to('vDown'), ['temp']);
    const order = await placeOrder('down', 'cod', 'PENDING', [['pDown', 'vDown']]);
    await drain(VENDOR_EMAIL_MAX_ATTEMPTS + 4);

    const r = await row(order.id, ids.vDown);
    expect(r).toEqual(expect.objectContaining({ status: 'FAILED', attempts: VENDOR_EMAIL_MAX_ATTEMPTS }));
    expect(mailsTo(to('vDown'))).toHaveLength(0);
    const events = await prisma.outboxEvent.findMany({ where: { aggregateId: r!.id } });
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('SENT'); // the final FAILED is recorded, not re-thrown
    expect(events[0].attempts).toBe(VENDOR_EMAIL_MAX_ATTEMPTS);
  });

  it('retries wait for their backoff (nothing is re-sent before nextRetryAt)', async () => {
    smtp.behaviour.set(to('vFlaky'), ['temp', 'ok']);
    const order = await placeOrder('wait', 'cod', 'PENDING', [['pFlaky', 'vFlaky']]);
    await outbox.processBatch(); // ORDER_CREATED
    await outbox.processBatch(); // first send → 451 → RETRYING, scheduled ~30s out
    const before = await row(order.id, ids.vFlaky);
    expect(before?.status).toBe('RETRYING');
    await outbox.processBatch(); // no clock advance: must not retry yet
    expect((await row(order.id, ids.vFlaky))?.attempts).toBe(1);
    await drain(); // clock advanced → retry runs
    expect((await row(order.id, ids.vFlaky))?.status).toBe('SENT');
  });
});

// ── HTTP layer: real ValidationPipe (main.ts options), exception filter and
//    PermissionsGuard; a test middleware stands in for the JWT. ─────────────

describeIt('Vendor HTTP API — validation, permissions, store isolation', () => {
  jest.setTimeout(60_000);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ValidationPipe } = require('@nestjs/common');
  const { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } = require('@nestjs/core');
  const { TransformInterceptor } = require('@/common/interceptors/transform.interceptor');
  const { AllExceptionsFilter } = require('@/common/filters/all-exceptions.filter');
  const { PermissionsGuard } = require('@/common/guards/permissions.guard');

  let app: any;
  let base: string;
  let prisma: PrismaService;
  const RUN = `http${Date.now()}`;
  const stores: Record<string, string> = {};

  const call = (method: string, path: string, role: string, store: string, body?: unknown) =>
    fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', connection: 'close', 'x-test-role': role, 'x-test-store': store },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

  beforeAll(async () => {
    @Global()
    @Module({ providers: [{ provide: PrismaService, useFactory: () => new PrismaService({ datasourceUrl: DB_URL }) }], exports: [PrismaService] })
    class LocalPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ({})] }),
        EventEmitterModule.forRoot(), LocalPrismaModule, EmailModule, VendorsModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: PermissionsGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.use((req: any, _res: any, next: () => void) => {
      req.user = { role: req.headers['x-test-role'], storeId: req.headers['x-test-store'] };
      next();
    });
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true, forbidNonWhitelisted: false, transform: true, transformOptions: { enableImplicitConversion: true },
    }));
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}`;
    prisma = moduleRef.get(PrismaService);

    for (const k of ['a', 'b']) {
      const u = await prisma.user.create({ data: { email: `${k}.${RUN}@store.test`, name: k, password: 'x' } });
      stores[k] = (await prisma.store.create({ data: { name: `${k} ${RUN}`, slug: `${k}-${RUN}`, domain: `${k}-${RUN}.test`, ownerId: u.id } })).id;
    }
  });
  afterAll(async () => { await app?.close(); });

  it('validates input: bad email, blank name, unknown status → 400 with field messages', async () => {
    const bad = await call('POST', '/vendors', 'STORE_OWNER', stores.a, { name: '  ', email: 'nope', status: 'BANNED' });
    expect(bad.status).toBe(400);
    const msg = JSON.stringify(bad.body.message);
    expect(msg).toMatch(/email/);
    expect(msg).toMatch(/name/);
    expect(msg).toMatch(/status/);
  });

  it('creates in the caller\'s store (a smuggled storeId is stripped), normalises email, rejects duplicates with 409', async () => {
    const ok = await call('POST', '/vendors', 'STORE_OWNER', stores.a,
      { name: `Suta ${RUN}`, email: ' Orders@Suta.Example ', storeId: stores.b, notifyOnOrder: false });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toEqual(expect.objectContaining({ email: 'orders@suta.example', status: 'ACTIVE', notifyOnOrder: false }));
    const saved = await prisma.vendor.findUnique({ where: { id: ok.body.data.id } });
    expect(saved!.storeId).toBe(stores.a);

    const dup = await call('POST', '/vendors', 'STORE_OWNER', stores.a, { name: `Suta ${RUN}`, email: 'x@y.co' });
    expect(dup.status).toBe(409);
    expect(dup.body.message).toContain('already exists');
  });

  it('owner vs manager vs staff', async () => {
    expect((await call('POST', '/vendors', 'STORE_MANAGER', stores.a, { name: `M ${RUN}`, email: 'm@y.co' })).status).toBe(403);
    expect((await call('GET', '/vendors', 'STORE_MANAGER', stores.a)).status).toBe(200);
    expect((await call('GET', '/vendors', 'STORE_STAFF', stores.a)).status).toBe(403);
    expect((await call('GET', '/vendor-notifications', 'STORE_MANAGER', stores.a)).status).toBe(200);
    expect((await call('POST', '/vendor-notifications/anything/resend', 'STORE_MANAGER', stores.a)).status).toBe(403);
    expect((await call('POST', '/vendor-notifications/anything/resend', 'STORE_OWNER', stores.a)).status).toBe(404);
  });

  it('another store cannot read, update or list store A\'s vendors', async () => {
    const created = await call('POST', '/vendors', 'STORE_OWNER', stores.a, { name: `Iso ${RUN}`, email: 'iso@y.co' });
    const id = created.body.data.id;
    expect((await call('GET', `/vendors/${id}`, 'STORE_OWNER', stores.b)).status).toBe(404);
    expect((await call('PUT', `/vendors/${id}`, 'STORE_OWNER', stores.b, { status: 'INACTIVE' })).status).toBe(404);
    expect((await prisma.vendor.findUnique({ where: { id } }))!.status).toBe('ACTIVE');
    const listB = await call('GET', '/vendors', 'STORE_OWNER', stores.b);
    expect(listB.body.data.items.map((v: any) => v.id)).not.toContain(id);
  });

  it('activate / deactivate round-trip and list filtering by status', async () => {
    const created = await call('POST', '/vendors', 'STORE_OWNER', stores.a, { name: `Toggle ${RUN}`, email: 't@y.co' });
    const id = created.body.data.id;
    expect((await call('PUT', `/vendors/${id}`, 'STORE_OWNER', stores.a, { status: 'INACTIVE' })).body.data.status).toBe('INACTIVE');
    const inactive = await call('GET', '/vendors?status=INACTIVE&limit=200', 'STORE_OWNER', stores.a);
    expect(inactive.body.data.items.map((v: any) => v.id)).toContain(id);
    expect((await call('PUT', `/vendors/${id}`, 'STORE_OWNER', stores.a, { status: 'ACTIVE' })).body.data.status).toBe('ACTIVE');
    expect((await call('GET', '/vendors?status=WHATEVER', 'STORE_OWNER', stores.a)).status).toBe(400);
  });
});
