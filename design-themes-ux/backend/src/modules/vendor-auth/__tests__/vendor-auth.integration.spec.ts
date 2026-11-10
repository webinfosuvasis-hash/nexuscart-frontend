/**
 * Vendor portal authentication over real HTTP against a REAL database, with
 * the production merchant guard chain, StoreContextMiddleware, ValidationPipe,
 * cookie-parser, exception filter and response interceptor. Invitation and
 * reset links are taken from real emails captured by an in-process SMTP sink.
 *
 * Skipped unless IT_DATABASE_URL points at a LOCAL disposable database with the
 * schema applied; any non-local host is refused.
 *
 *   IT_DATABASE_URL=mysql://root@127.0.0.1:3399/nexus_it npx jest vendor-auth.integration
 */
import * as net from 'net';
import * as bcrypt from 'bcryptjs';
import * as cookieParser from 'cookie-parser';
import { Controller, Get, Global, MiddlewareConsumer, Module, NestModule, RequestMethod, UseGuards, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaService } from '@/prisma/prisma.service';
import { CacheService } from '@/shared/cache/cache.service';
import { EmailModule } from '@/shared/email/email.module';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { StoreContextGuard } from '@/common/guards/store-context.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { StoreContextMiddleware } from '@/common/middleware/store-context.middleware';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { Public } from '@/common/decorators/public.decorator';
import { AuthModule } from '@/modules/auth/auth.module';
import { ProductsModule } from '@/modules/products/products.module';
import { VendorsModule } from '@/modules/vendors/vendors.module';
import { CustomerJwtStrategy } from '@/modules/customer-auth/strategies/customer-jwt.strategy';
import { CustomerJwtAuthGuard } from '@/modules/customer-auth/guards/customer-jwt-auth.guard';
import { VendorAuthModule } from '../vendor-auth.module';
import { VENDOR_JWT_AUDIENCE, VENDOR_JWT_ISSUER, sha256 } from '../vendor-auth.types';

const DB_URL = process.env.IT_DATABASE_URL ?? process.env.VENDOR_IT_DATABASE_URL ?? '';
const isLocal = /^mysql:\/\/[^@]*@(127\.0\.0\.1|localhost)(:\d+)?\//.test(DB_URL);
if (DB_URL && !isLocal) throw new Error('IT_DATABASE_URL must point at 127.0.0.1/localhost');
const describeIt = isLocal ? describe : describe.skip;

// ── SMTP sink ────────────────────────────────────────────────────────────────
function startSmtp() {
  const mails: Array<{ to: string[]; data: string }> = [];
  const server = net.createServer((sock) => {
    let mail = { to: [] as string[], data: '' }; let inData = false; let buf = '';
    sock.write('220 sink\r\n');
    sock.on('data', (c) => {
      buf += c.toString('utf8'); let i: number;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (inData) { if (line === '.') { inData = false; mails.push(mail); mail = { to: [], data: '' }; sock.write('250 ok\r\n'); } else mail.data += line + '\n'; continue; }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO') sock.write('250-sink\r\n250 8BITMIME\r\n');
        else if (cmd === 'RCPT') { mail.to.push(line.replace(/^RCPT TO:\s*/i, '').replace(/[<>]/g, '')); sock.write('250 ok\r\n'); }
        else if (cmd === 'DATA') { inData = true; sock.write('354 go\r\n'); }
        else if (cmd === 'QUIT') sock.end('221 bye\r\n');
        else sock.write('250 ok\r\n');
      }
    });
    sock.on('error', () => undefined);
  });
  return new Promise<{ port: number; mails: typeof mails; close: () => Promise<void> }>((r) =>
    server.listen(0, '127.0.0.1', () => r({ port: (server.address() as net.AddressInfo).port, mails, close: () => new Promise((d) => server.close(() => d())) })));
}
const decodeQP = (s: string) => Buffer.from(s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8');

// A route only a customer token can pass — to prove a vendor token cannot.
@Controller('it-customer-only')
class CustomerOnlyController {
  @Public() @UseGuards(CustomerJwtAuthGuard) @Get() ok() { return { ok: true }; }
}

describeIt('Vendor portal authentication — real HTTP + DB + SMTP', () => {
  jest.setTimeout(120_000);
  const RUN = `va${Date.now()}`;
  const SECRETS = {
    JWT_SECRET: `merchant-${RUN}-0123456789abcdefghij`, CUSTOMER_JWT_SECRET: `customer-${RUN}-0123456789abcdefghij`,
    VENDOR_JWT_SECRET: `vendor-${RUN}-0123456789abcdefghijkl`,
  };
  const PW = 'Correct-Horse-9';
  const ids: Record<string, string> = {};
  const admin: Record<string, string> = {};
  let app: any; let base: string; let prisma: PrismaService; let jwt: JwtService;
  let smtp: Awaited<ReturnType<typeof startSmtp>>;

  type Res = { status: number; body: any; cookie?: string; setCookie?: string };
  const call = async (method: string, path: string, opts: { token?: string; store?: string; cookie?: string; body?: unknown } = {}): Promise<Res> => {
    const r = await fetch(`${base}/api/v1${path}`, {
      method,
      headers: {
        'content-type': 'application/json', connection: 'close',
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.store ? { 'x-store-id': opts.store } : {}),
        ...(opts.cookie ? { cookie: opts.cookie } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const setCookie = r.headers.get('set-cookie') ?? undefined;
    const cookie = setCookie?.match(/nc_vendor_rt=([^;]*)/)?.[1];
    return { status: r.status, body: await r.json().catch(() => null), setCookie, cookie: cookie ? `nc_vendor_rt=${cookie}` : undefined };
  };
  const lastLink = (to: string, view: 'accept-invite' | 'reset-password') => {
    const mail = [...smtp.mails].reverse().find((m) => m.to.includes(to));
    const m = mail && decodeQP(mail.data).match(new RegExp(`#/${view}\\?token=([A-Za-z0-9_%-]+)`));
    return m ? decodeURIComponent(m[1]) : undefined;
  };
  const invite = (email: string, vendor = 'vendorA', store = 'storeA', as = 'ownerA') =>
    call('POST', `/vendors/${ids[vendor]}/users`, { token: admin[as], store: ids[store], body: { email, name: `Name ${email}` } });
  const activate = async (email: string, vendor = 'vendorA') => {
    const r = await invite(email, vendor);
    expect(r.status).toBe(201);
    const res = await call('POST', '/vendor/auth/accept-invite', { body: { token: lastLink(email, 'accept-invite'), password: PW } });
    expect(res.status).toBe(200);
    return { userId: r.body.data.user.id as string, access: res.body.data.accessToken as string, cookie: res.cookie! };
  };

  beforeAll(async () => {
    smtp = await startSmtp();

    @Global()
    @Module({
      providers: [
        { provide: PrismaService, useFactory: () => new PrismaService({ datasourceUrl: DB_URL }) },
        { provide: CacheService, useValue: { get: async () => null, set: async () => undefined, del: async () => undefined } },
      ],
      exports: [PrismaService, CacheService],
    })
    class TestInfraModule {}

    @Module({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true, ignoreEnvFile: true,
          load: [() => ({
            ...SECRETS, JWT_EXPIRES_IN: '15m', NODE_ENV: 'development', VENDOR_PORTAL_URL: 'http://portal.test/vendor.html',
            SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_FROM: 'NexusCart <noreply@nexuscart.test>',
          })],
        }),
        EventEmitterModule.forRoot(), PassportModule, TestInfraModule, EmailModule,
        AuthModule, ProductsModule, VendorsModule, VendorAuthModule,
      ],
      controllers: [CustomerOnlyController],
      providers: [
        CustomerJwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: StoreContextGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
      ],
    })
    class TestRoot implements NestModule {
      configure(c: MiddlewareConsumer) { c.apply(StoreContextMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL }); }
    }

    const moduleRef = await Test.createTestingModule({ imports: [TestRoot] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true, transformOptions: { enableImplicitConversion: true } }));
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}`;
    prisma = moduleRef.get(PrismaService);
    jwt = new JwtService({});

    const hash = await bcrypt.hash(PW, 4);
    for (const s of ['A', 'B']) {
      const owner = await prisma.user.create({ data: { email: `owner${s}.${RUN}@it.test`, name: `Owner ${s}`, password: hash, role: 'STORE_OWNER' } });
      const store = await prisma.store.create({ data: { name: `Store ${s} ${RUN}`, slug: `vs${s.toLowerCase()}-${RUN}`, domain: `vs${s.toLowerCase()}-${RUN}.test`, ownerId: owner.id, status: 'ACTIVE' } });
      await prisma.user.update({ where: { id: owner.id }, data: { storeId: store.id } });
      await prisma.storeStaff.create({ data: { storeId: store.id, userId: owner.id, role: 'OWNER' } });
      ids[`store${s}`] = store.id;
      ids[`vendor${s}`] = (await prisma.vendor.create({ data: { storeId: store.id, name: `Vendor ${s} ${RUN}`, email: `v${s}.${RUN}@it.test` } })).id;
      admin[`owner${s}`] = (await call('POST', '/auth/login', { body: { email: owner.email, password: PW } })).body.data.accessToken;
    }
    ids.vendorA2 = (await prisma.vendor.create({ data: { storeId: ids.storeA, name: `Vendor A2 ${RUN}`, email: `va2.${RUN}@it.test` } })).id;
    for (const [key, role] of [['managerA', 'MANAGER'], ['staffA', 'STAFF']] as const) {
      const u = await prisma.user.create({ data: { email: `${key}.${RUN}@it.test`, name: key, password: hash, role: role === 'MANAGER' ? 'STORE_MANAGER' : 'STORE_STAFF' } });
      await prisma.storeStaff.create({ data: { storeId: ids.storeA, userId: u.id, role } });
      admin[key] = (await call('POST', '/auth/login', { body: { email: u.email, password: PW } })).body.data.accessToken;
    }
  });

  afterAll(async () => { await app?.close(); await smtp?.close(); });

  // ── Invitation & account management (owner) ──────────────────────────────

  it('owner invites: 201, the email carries a link, and the token is neither returned nor stored raw', async () => {
    const email = `inv1.${RUN}@vendor.test`;
    const r = await invite(email);
    expect(r.status).toBe(201);
    expect(r.body.data.invitation).toBe('sent');
    expect(r.body.data.user).toEqual(expect.objectContaining({ email, status: 'INVITED' }));
    const token = lastLink(email, 'accept-invite')!;
    expect(token).toBeTruthy();
    expect(JSON.stringify(r.body)).not.toContain(token);
    const stored = await prisma.vendorAuthToken.findMany({ where: { vendorUserId: r.body.data.user.id } });
    expect(stored.map((t) => t.tokenHash)).toEqual([sha256(token)]);
    expect(JSON.stringify(stored)).not.toContain(token);
  });

  it('managers may list portal accounts but not invite, reset or change status; staff may do neither', async () => {
    expect((await call('GET', `/vendors/${ids.vendorA}/users`, { token: admin.managerA, store: ids.storeA })).status).toBe(200);
    expect((await invite(`m.${RUN}@vendor.test`, 'vendorA', 'storeA', 'managerA')).status).toBe(403);
    expect((await call('GET', `/vendors/${ids.vendorA}/users`, { token: admin.staffA, store: ids.storeA })).status).toBe(403);
  });

  it('another store\'s owner cannot see or invite to this store\'s vendor', async () => {
    expect((await invite(`x.${RUN}@vendor.test`, 'vendorA', 'storeA', 'ownerB')).status).toBe(403);      // header A, owner of B
    expect((await call('POST', `/vendors/${ids.vendorA}/users`, { token: admin.ownerB, body: { email: `y.${RUN}@v.test`, name: 'Y' } })).status).toBe(404);
    expect((await call('GET', `/vendors/${ids.vendorA}/users`, { token: admin.ownerB })).status).toBe(404);
  });

  it('one email cannot be linked to two vendors of the same store', async () => {
    const email = `dual.${RUN}@vendor.test`;
    expect((await invite(email, 'vendorA')).status).toBe(201);
    expect((await invite(email, 'vendorA2')).status).toBe(409);
  });

  // ── Activation & login ────────────────────────────────────────────────────

  it('accepting an invitation: bad token / weak password rejected; success sets a hardened cookie; the link is single-use', async () => {
    const email = `acc.${RUN}@vendor.test`;
    await invite(email);
    const token = lastLink(email, 'accept-invite')!;
    expect((await call('POST', '/vendor/auth/accept-invite', { body: { token: 'nope', password: PW } })).status).toBe(400);
    expect((await call('POST', '/vendor/auth/accept-invite', { body: { token, password: 'weak' } })).status).toBe(400);

    const ok = await call('POST', '/vendor/auth/accept-invite', { body: { token, password: PW } });
    expect(ok.status).toBe(200);
    expect(ok.body.data.accessToken).toBeTruthy();
    expect(ok.body.data).not.toHaveProperty('refreshToken');
    expect(ok.setCookie).toMatch(/HttpOnly/i);
    expect(ok.setCookie).toMatch(/SameSite=Strict/i);
    expect(ok.setCookie).toMatch(/Path=\/api\/v1\/vendor\/auth/);
    expect(ok.body.data.vendor).toEqual(expect.objectContaining({ email, vendor: expect.objectContaining({ id: ids.vendorA }) }));

    expect((await call('POST', '/vendor/auth/accept-invite', { body: { token, password: PW } })).status).toBe(400);
  });

  it('an expired invitation is rejected', async () => {
    const email = `exp.${RUN}@vendor.test`;
    const r = await invite(email);
    await prisma.vendorAuthToken.updateMany({ where: { vendorUserId: r.body.data.user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await call('POST', '/vendor/auth/accept-invite', { body: { token: lastLink(email, 'accept-invite'), password: PW } })).status).toBe(400);
  });

  it('login: generic errors, store required, success', async () => {
    const email = `login.${RUN}@vendor.test`;
    await activate(email);
    const wrong = await call('POST', '/vendor/auth/login', { store: ids.storeA, body: { email, password: 'Wrong-Pass-1' } });
    const unknown = await call('POST', '/vendor/auth/login', { store: ids.storeA, body: { email: `ghost.${RUN}@v.test`, password: PW } });
    expect([wrong.status, unknown.status]).toEqual([401, 401]);
    expect(wrong.body.message).toBe(unknown.body.message);
    expect((await call('POST', '/vendor/auth/login', { body: { email, password: PW } })).status).toBe(400);
    expect((await call('POST', '/vendor/auth/login', { store: ids.storeB, body: { email, password: PW } })).status).toBe(401); // wrong store
    expect((await call('POST', '/vendor/auth/login', { store: ids.storeA, body: { email, password: PW } })).status).toBe(200);
  });

  it('locks the account after 5 failed attempts, even for the correct password', async () => {
    const email = `lock.${RUN}@vendor.test`;
    await activate(email);
    for (let i = 0; i < 5; i++) await call('POST', '/vendor/auth/login', { store: ids.storeA, body: { email, password: 'Wrong-Pass-1' } });
    const r = await call('POST', '/vendor/auth/login', { store: ids.storeA, body: { email, password: PW } });
    expect(r.status).toBe(401);
    expect(r.body.message).toMatch(/Too many attempts/);
  });

  // ── Sessions ──────────────────────────────────────────────────────────────

  it('refresh rotates the cookie; replaying an old cookie revokes every session', async () => {
    const { access, cookie } = await activate(`rot.${RUN}@vendor.test`);
    const r1 = await call('POST', '/vendor/auth/refresh', { cookie });
    expect(r1.status).toBe(200);
    expect(r1.cookie).toBeTruthy();
    expect(r1.cookie).not.toBe(cookie);

    expect((await call('POST', '/vendor/auth/refresh', { cookie })).status).toBe(401);          // replay → theft assumed
    expect((await call('POST', '/vendor/auth/refresh', { cookie: r1.cookie })).status).toBe(401); // new session killed too
    expect((await call('GET', '/vendor/me', { token: r1.body.data.accessToken })).status).toBe(401);
    expect((await call('GET', '/vendor/me', { token: access })).status).toBe(401);
  });

  it('logout revokes the session cookie', async () => {
    const { cookie } = await activate(`out.${RUN}@vendor.test`);
    expect((await call('POST', '/vendor/auth/logout', { cookie })).status).toBe(200);
    expect((await call('POST', '/vendor/auth/refresh', { cookie })).status).toBe(401);
  });

  // ── Token separation ──────────────────────────────────────────────────────

  it('vendor, merchant and customer tokens are mutually unusable', async () => {
    const { access } = await activate(`sep.${RUN}@vendor.test`);
    // vendor token on merchant APIs
    for (const p of ['/vendors', '/products', '/vendor-notifications', `/vendors/${ids.vendorA}/users`]) {
      expect([p, (await call('GET', p, { token: access, store: ids.storeA })).status]).toEqual([p, 401]);
    }
    // vendor token on a customer-guarded route
    expect((await call('GET', '/it-customer-only', { token: access, store: ids.storeA })).status).toBe(401);
    // merchant and customer tokens on the vendor API
    expect((await call('GET', '/vendor/me', { token: admin.ownerA })).status).toBe(401);
    const customerToken = await jwt.signAsync({ sub: 'c1', storeId: ids.storeA, email: 'c@x.test', type: 'customer' }, { secret: SECRETS.CUSTOMER_JWT_SECRET });
    expect((await call('GET', '/vendor/me', { token: customerToken })).status).toBe(401);
  });

  it('forged vendor tokens are rejected: wrong secret, wrong audience, forged vendor claim, alg none', async () => {
    const { userId } = await activate(`forge.${RUN}@vendor.test`);
    const user = await prisma.vendorUser.findUniqueOrThrow({ where: { id: userId } });
    const claims = { sub: user.id, vid: user.vendorId, sid: user.storeId, tv: user.tokenVersion, typ: 'vendor' };
    const sign = (c: object, secret: string, aud = VENDOR_JWT_AUDIENCE) => jwt.signAsync(c, { secret, issuer: VENDOR_JWT_ISSUER, audience: aud });

    expect((await call('GET', '/vendor/me', { token: await sign(claims, SECRETS.VENDOR_JWT_SECRET) })).status).toBe(200); // control
    expect((await call('GET', '/vendor/me', { token: await sign(claims, SECRETS.JWT_SECRET) })).status).toBe(401);
    expect((await call('GET', '/vendor/me', { token: await sign(claims, SECRETS.VENDOR_JWT_SECRET, 'nexuscart-admin') })).status).toBe(401);
    expect((await call('GET', '/vendor/me', { token: await sign({ ...claims, vid: ids.vendorA2 }, SECRETS.VENDOR_JWT_SECRET) })).status).toBe(401);
    expect((await call('GET', '/vendor/me', { token: await sign({ ...claims, sid: ids.storeB }, SECRETS.VENDOR_JWT_SECRET) })).status).toBe(401);
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ ...claims, iss: VENDOR_JWT_ISSUER, aud: VENDOR_JWT_AUDIENCE })).toString('base64url')}.`;
    expect((await call('GET', '/vendor/me', { token: none })).status).toBe(401);
  });

  it('identity comes only from the token: headers and body cannot change vendor or store', async () => {
    const { access, userId } = await activate(`self.${RUN}@vendor.test`);
    const me = await call('GET', '/vendor/me', { token: access, store: ids.storeB });
    expect(me.status).toBe(200);
    expect(me.body.data.vendor.id).toBe(ids.vendorA);
    expect(me.body.data.store.id).toBe(ids.storeA);

    const upd = await call('PATCH', '/vendor/me', { token: access, body: { name: 'Renamed', vendorId: ids.vendorA2, storeId: ids.storeB, status: 'ACTIVE', email: 'evil@x.test' } });
    expect(upd.status).toBe(200);
    const row = await prisma.vendorUser.findUniqueOrThrow({ where: { id: userId } });
    expect(row).toEqual(expect.objectContaining({ name: 'Renamed', vendorId: ids.vendorA, storeId: ids.storeA, email: `self.${RUN}@vendor.test` }));
  });

  // ── Suspension, revocation, vendor deactivation ───────────────────────────

  it('suspension takes effect on the very next request; reactivation restores login', async () => {
    const email = `susp.${RUN}@vendor.test`;
    const { access, cookie, userId } = await activate(email);
    expect((await call('PATCH', `/vendors/${ids.vendorA}/users/${userId}/status`, { token: admin.ownerA, store: ids.storeA, body: { status: 'SUSPENDED' } })).status).toBe(200);
    expect((await call('GET', '/vendor/me', { token: access })).status).toBe(401);
    expect((await call('POST', '/vendor/auth/refresh', { cookie })).status).toBe(401);
    const login = await call('POST', '/vendor/auth/login', { store: ids.storeA, body: { email, password: PW } });
    expect(login.status).toBe(401);
    expect(login.body.message).toMatch(/not active/);

    expect((await call('PATCH', `/vendors/${ids.vendorA}/users/${userId}/status`, { token: admin.ownerA, store: ids.storeA, body: { status: 'ACTIVE' } })).status).toBe(200);
    expect((await call('POST', '/vendor/auth/login', { store: ids.storeA, body: { email, password: PW } })).status).toBe(200);
  });

  it('revocation removes access and the password; only a new invitation restores the account', async () => {
    const email = `rev.${RUN}@vendor.test`;
    const { access, userId } = await activate(email);
    expect((await call('PATCH', `/vendors/${ids.vendorA}/users/${userId}/status`, { token: admin.ownerA, store: ids.storeA, body: { status: 'REVOKED' } })).status).toBe(200);
    expect((await call('GET', '/vendor/me', { token: access })).status).toBe(401);
    expect((await call('POST', '/vendor/auth/login', { store: ids.storeA, body: { email, password: PW } })).status).toBe(401);
    expect((await call('PATCH', `/vendors/${ids.vendorA}/users/${userId}/status`, { token: admin.ownerA, store: ids.storeA, body: { status: 'ACTIVE' } })).status).toBe(400);
    const again = await invite(email);
    expect(again.status).toBe(201);
    expect(again.body.data.user.status).toBe('INVITED');
  });

  it('deactivating the vendor locks out all of its users immediately', async () => {
    const vendor = await prisma.vendor.create({ data: { storeId: ids.storeA, name: `Vendor Off ${RUN}`, email: `off.${RUN}@it.test` } });
    ids.vendorOff = vendor.id;
    const { access } = await activate(`voff.${RUN}@vendor.test`, 'vendorOff');
    await call('PUT', `/vendors/${vendor.id}`, { token: admin.ownerA, store: ids.storeA, body: { status: 'INACTIVE' } });
    expect((await call('GET', '/vendor/me', { token: access })).status).toBe(401);
    expect((await call('DELETE', `/vendors/${vendor.id}`, { token: admin.ownerA, store: ids.storeA })).status).toBe(409); // has portal users
  });

  // ── Password reset ────────────────────────────────────────────────────────

  it('forgot-password answers identically for known and unknown emails and only emails real accounts', async () => {
    const email = `fp.${RUN}@vendor.test`;
    await activate(email);
    const before = smtp.mails.length;
    const known = await call('POST', '/vendor/auth/forgot-password', { store: ids.storeA, body: { email } });
    const unknown = await call('POST', '/vendor/auth/forgot-password', { store: ids.storeA, body: { email: `nobody.${RUN}@v.test` } });
    expect([known.status, unknown.status]).toEqual([200, 200]);
    expect(known.body.data).toEqual(unknown.body.data);
    await new Promise((r) => setTimeout(r, 500)); // the email is sent without blocking the response
    expect(smtp.mails.length).toBe(before + 1);
    expect(lastLink(email, 'reset-password')).toBeTruthy();
  });

  it('reset: one-time, expiring, revokes existing sessions, old password stops working', async () => {
    const email = `rp.${RUN}@vendor.test`;
    const { access, cookie, userId } = await activate(email);
    await call('POST', '/vendor/auth/forgot-password', { store: ids.storeA, body: { email } });
    await new Promise((r) => setTimeout(r, 500));
    const token = lastLink(email, 'reset-password')!;
    const NEW = 'Brand-New-Pass-2';

    expect((await call('POST', '/vendor/auth/reset-password', { body: { token, password: NEW } })).status).toBe(200);
    expect((await call('POST', '/vendor/auth/reset-password', { body: { token, password: NEW } })).status).toBe(400);   // single use
    expect((await call('GET', '/vendor/me', { token: access })).status).toBe(401);                                       // sessions ended
    expect((await call('POST', '/vendor/auth/refresh', { cookie })).status).toBe(401);
    expect((await call('POST', '/vendor/auth/login', { store: ids.storeA, body: { email, password: PW } })).status).toBe(401);
    expect((await call('POST', '/vendor/auth/login', { store: ids.storeA, body: { email, password: NEW } })).status).toBe(200);

    // owner-triggered reset, then expiry
    expect((await call('POST', `/vendors/${ids.vendorA}/users/${userId}/password-reset`, { token: admin.managerA, store: ids.storeA })).status).toBe(403);
    const sent = await call('POST', `/vendors/${ids.vendorA}/users/${userId}/password-reset`, { token: admin.ownerA, store: ids.storeA });
    expect(sent.status).toBe(200);
    expect(sent.body.data.email).toBe('sent');
    await prisma.vendorAuthToken.updateMany({ where: { vendorUserId: userId, consumedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await call('POST', '/vendor/auth/reset-password', { body: { token: lastLink(email, 'reset-password'), password: 'Another-Pass-3' } })).status).toBe(400);
  });

  it('audit trail records account events without emails, passwords or tokens', async () => {
    const rows = await prisma.auditLog.findMany({ where: { storeId: ids.storeA, action: { startsWith: 'vendor_user.' } } });
    const actions = new Set(rows.map((r) => r.action));
    for (const a of ['vendor_user.invited', 'vendor_user.activated', 'vendor_user.login', 'vendor_user.locked',
      'vendor_user.suspended', 'vendor_user.revoked', 'vendor_user.password_reset', 'vendor_user.refresh_reuse_detected']) {
      expect([a, actions.has(a)]).toEqual([a, true]);
    }
    const dump = JSON.stringify(rows);
    expect(dump).not.toMatch(/@vendor\.test/);
    expect(dump).not.toContain(PW);
  });
});
