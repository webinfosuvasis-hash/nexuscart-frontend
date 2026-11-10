/**
 * S1 / S2 regression tests over real HTTP, real JWT login and a REAL database:
 * the production guard chain (JwtAuthGuard → StoreContextGuard →
 * PermissionsGuard), StoreContextMiddleware, ValidationPipe, exception filter
 * and response interceptor, exactly as registered in AppModule / main.ts.
 *
 * Skipped unless IT_DATABASE_URL (or VENDOR_IT_DATABASE_URL) points at a LOCAL,
 * disposable MySQL/MariaDB database that already has the schema; any non-local
 * host is refused.
 *
 *   IT_DATABASE_URL=mysql://root@127.0.0.1:3399/nexus_it npx jest tenant-isolation.integration
 */
import * as bcrypt from 'bcryptjs';
import { Global, MiddlewareConsumer, Module, NestModule, RequestMethod, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaService } from '@/prisma/prisma.service';
import { CacheService } from '@/shared/cache/cache.service';
import { EmailModule } from '@/shared/email/email.module';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { StoreContextGuard } from '@/common/guards/store-context.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { StoreContextMiddleware } from '@/common/middleware/store-context.middleware';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { AuthModule } from '@/modules/auth/auth.module';
import { ProductsModule } from '@/modules/products/products.module';
import { VendorsModule } from '@/modules/vendors/vendors.module';
import { HealthController } from '@/modules/health/health.controller';
import { DocumentController } from '@/modules/content/document.controller';
import { FeatureFlagController } from '@/modules/content/feature-flag.controller';
import { DocumentService } from '@/modules/content/document.service';
import { ShadowRenderService } from '@/modules/content/shadow-render.service';
import { FeatureFlagService } from '@/modules/content/feature-flag.service';

const DB_URL = process.env.IT_DATABASE_URL ?? process.env.VENDOR_IT_DATABASE_URL ?? '';
const isLocal = /^mysql:\/\/[^@]*@(127\.0\.0\.1|localhost)(:\d+)?\//.test(DB_URL);
if (DB_URL && !isLocal) throw new Error('IT_DATABASE_URL must point at 127.0.0.1/localhost');
const describeIt = isLocal ? describe : describe.skip;

describeIt('Tenant isolation (S1) and theme content roles (S2) — real HTTP + DB', () => {
  jest.setTimeout(90_000);

  const RUN = `ti${Date.now()}`;
  const PASSWORD = 'Correct-Horse-9';
  const ids: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  const contentCalls: string[] = [];
  let app: any;
  let base: string;
  let prisma: PrismaService;

  const call = (method: string, path: string, who: string | null, storeHeader?: string, body?: unknown) =>
    fetch(`${base}/api/v1${path}`, {
      method,
      headers: {
        'content-type': 'application/json', connection: 'close',
        ...(who ? { authorization: `Bearer ${tokens[who]}` } : {}),
        ...(storeHeader ? { 'x-store-id': storeHeader } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

  beforeAll(async () => {
    @Global()
    @Module({
      providers: [
        { provide: PrismaService, useFactory: () => new PrismaService({ datasourceUrl: DB_URL }) },
        // No Redis in tests: the middleware falls back to the DB, as CacheService does when Redis is down.
        { provide: CacheService, useValue: { get: async () => null, set: async () => undefined, del: async () => undefined } },
      ],
      exports: [PrismaService, CacheService],
    })
    class TestInfraModule {}

    const record = (name: string) => async () => { contentCalls.push(name); return { ok: true }; };
    @Module({
      controllers: [DocumentController, FeatureFlagController],
      providers: [
        { provide: DocumentService, useValue: {
          getDocument: record('getDocument'), saveDraft: record('saveDraft'), publish: record('publish'),
          discardDraft: record('discardDraft'), rollback: record('rollback'), listVersions: record('listVersions'),
        } },
        { provide: ShadowRenderService, useValue: { check: record('shadow'), checkAll: record('shadowAll') } },
        { provide: FeatureFlagService, useValue: {
          validateFlag: () => undefined, enable: record('flagEnable'), disable: record('flagDisable'),
          getAll: record('flagsGetAll'), getAuditLog: record('flagsAudit'),
        } },
      ],
    })
    class ContentRoutesUnderTest {}

    @Module({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true, ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET: `test-secret-${RUN}-0123456789abcdef`, JWT_EXPIRES_IN: '15m', JWT_REFRESH_EXPIRES_IN: '7d' })],
        }),
        EventEmitterModule.forRoot(), TestInfraModule, EmailModule,
        AuthModule, ProductsModule, VendorsModule, ContentRoutesUnderTest,
      ],
      controllers: [HealthController],
      providers: [
        // Same order as AppModule.
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: StoreContextGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
      ],
    })
    class TestRoot implements NestModule {
      configure(consumer: MiddlewareConsumer) {
        consumer.apply(StoreContextMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
      }
    }

    const moduleRef = await Test.createTestingModule({ imports: [TestRoot] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true, forbidNonWhitelisted: false, transform: true, transformOptions: { enableImplicitConversion: true },
    }));
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}`;
    prisma = moduleRef.get(PrismaService);

    // Three stores with owners. Staff/manager of B are invited the way UsersService.inviteStaff does
    // (StoreStaff row, user.storeId left null). Owner C is additionally invited to B as STAFF.
    // Owner A has no relation to B at all.
    const hash = await bcrypt.hash(PASSWORD, 4);
    const user = (key: string, role: string) =>
      prisma.user.create({ data: { email: `${key}.${RUN}@it.test`, name: key, password: hash, role: role as any } });
    for (const s of ['A', 'B', 'C']) {
      const owner = await user(`owner${s}`, 'STORE_OWNER');
      const store = await prisma.store.create({
        data: { name: `Store ${s} ${RUN}`, slug: `s${s.toLowerCase()}-${RUN}`, domain: `s${s.toLowerCase()}-${RUN}.test`, ownerId: owner.id, status: 'ACTIVE' },
      });
      await prisma.user.update({ where: { id: owner.id }, data: { storeId: store.id } });
      await prisma.storeStaff.create({ data: { storeId: store.id, userId: owner.id, role: 'OWNER' } });
      ids[`owner${s}`] = owner.id;
      ids[`store${s}`] = store.id;
      ids[`product${s}`] = (await prisma.product.create({
        data: { storeId: store.id, name: `P${s} ${RUN}`, slug: `p${s}-${RUN}`, sku: `SKU-${s}-${RUN}`, price: 10, images: '[]', tags: '[]' },
      })).id;
      ids[`vendor${s}`] = (await prisma.vendor.create({ data: { storeId: store.id, name: `V${s} ${RUN}`, email: `v${s}.${RUN}@it.test` } })).id;
    }
    for (const [key, role] of [['staffB', 'STAFF'], ['managerB', 'MANAGER']] as const) {
      const u = await user(key, role === 'STAFF' ? 'STORE_STAFF' : 'STORE_MANAGER');
      await prisma.storeStaff.create({ data: { storeId: ids.storeB, userId: u.id, role } });
    }
    await prisma.storeStaff.create({ data: { storeId: ids.storeB, userId: ids.ownerC, role: 'STAFF' } });

    for (const key of ['ownerA', 'ownerB', 'ownerC', 'staffB', 'managerB']) {
      const res = await call('POST', '/auth/login', null, undefined, { email: `${key}.${RUN}@it.test`, password: PASSWORD });
      expect(res.status).toBe(200);
      tokens[key] = res.body.data.accessToken ?? res.body.data.access_token;
      expect(tokens[key]).toBeTruthy();
    }
  });

  afterAll(async () => { await app?.close(); });

  // ── S1: cross-store access ────────────────────────────────────────────────

  it('an owner cannot read another store\'s products by sending its X-Store-Id', async () => {
    const res = await call('GET', '/products', 'ownerA', ids.storeB);
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain(ids.productB);
  });

  it('an owner still works on their own store, with or without the header', async () => {
    for (const header of [ids.storeB, undefined]) {
      const res = await call('GET', '/products', 'ownerB', header);
      expect(res.status).toBe(200);
      const idsSeen = res.body.data.items.map((p: any) => p.id);
      expect(idsSeen).toContain(ids.productB);
      expect(idsSeen).not.toContain(ids.productA);
    }
  });

  it('an owner cannot read or modify another store\'s vendor', async () => {
    expect((await call('GET', `/vendors/${ids.vendorB}`, 'ownerA', ids.storeB)).status).toBe(403);
    expect((await call('PUT', `/vendors/${ids.vendorB}`, 'ownerA', ids.storeB, { status: 'INACTIVE' })).status).toBe(403);
    expect((await prisma.vendor.findUnique({ where: { id: ids.vendorB } }))!.status).toBe('ACTIVE');
    // Without the header the request is scoped to the caller's own store: B's vendor is simply not found.
    expect((await call('GET', `/vendors/${ids.vendorB}`, 'ownerA')).status).toBe(404);
  });

  it('invited staff (no user.storeId) reach their store through membership, and only that store', async () => {
    expect((await call('GET', '/products', 'staffB', ids.storeB)).status).toBe(200);
    expect((await call('GET', '/products', 'staffB', ids.storeA)).status).toBe(403);
  });

  it('acting through a membership uses that membership\'s role: owner C is only STAFF in B', async () => {
    expect((await call('GET', '/products', 'ownerC', ids.storeB)).status).toBe(200);          // STAFF may read
    const create = (store: string) => call('POST', '/products', 'ownerC', store, { name: `X ${RUN} ${store}`, price: 5 });
    expect((await create(ids.storeB)).status).toBe(403);                                        // STAFF may not create
    expect(await prisma.product.count({ where: { storeId: ids.storeB, name: { startsWith: `X ${RUN}` } } })).toBe(0);
    expect((await create(ids.storeC)).status).toBe(201);                                        // still owner of C
  });

  it('an unknown store id is rejected; public routes ignore the merchant check', async () => {
    expect((await call('GET', '/products', 'ownerA', 'does-not-exist')).status).toBe(400);
    expect((await call('GET', '/health', 'ownerA', ids.storeB)).status).toBe(200);
    expect((await call('GET', '/products', null, ids.storeB)).status).toBe(401);
  });

  // ── S2: theme content roles ───────────────────────────────────────────────

  const content = (store: string) => `/content/${store}/theme1/home`;

  it('staff cannot read or modify theme content', async () => {
    contentCalls.length = 0;
    expect((await call('GET', content(ids.storeB), 'staffB', ids.storeB)).status).toBe(403);
    expect((await call('PATCH', content(ids.storeB), 'staffB', ids.storeB, {})).status).toBe(403);
    expect((await call('POST', `${content(ids.storeB)}/publish`, 'staffB', ids.storeB)).status).toBe(403);
    expect(contentCalls).toEqual([]);
  });

  it('a manager may edit drafts but not publish, roll back or toggle flags', async () => {
    contentCalls.length = 0;
    expect((await call('PATCH', content(ids.storeB), 'managerB', ids.storeB, {})).status).toBe(200);
    expect((await call('POST', `${content(ids.storeB)}/discard`, 'managerB', ids.storeB)).status).toBe(200);
    expect((await call('POST', `${content(ids.storeB)}/publish`, 'managerB', ids.storeB)).status).toBe(403);
    expect((await call('POST', `${content(ids.storeB)}/rollback/snap1`, 'managerB', ids.storeB)).status).toBe(403);
    expect((await call('POST', `/content/flags/${ids.storeB}/enable`, 'managerB', ids.storeB, { flag: 'X' })).status).toBe(403);
    expect(contentCalls).toEqual(['saveDraft', 'discardDraft']);
  });

  it('the owner may publish and toggle flags in their own store only', async () => {
    contentCalls.length = 0;
    expect((await call('POST', `${content(ids.storeB)}/publish`, 'ownerB')).status).toBe(200);
    expect((await call('POST', `/content/flags/${ids.storeB}/enable`, 'ownerB', undefined, { flag: 'X', actorId: 'forged' })).status).toBe(201);
    expect((await call('POST', `${content(ids.storeA)}/publish`, 'ownerB')).status).toBe(403);
    expect(contentCalls).toEqual(['publish', 'flagEnable']);
  });

  it('other stores\' owners cannot publish B\'s content — neither by path nor through a STAFF membership', async () => {
    contentCalls.length = 0;
    expect((await call('POST', `${content(ids.storeB)}/publish`, 'ownerA')).status).toBe(403);             // path is not own store
    expect((await call('POST', `${content(ids.storeB)}/publish`, 'ownerA', ids.storeB)).status).toBe(403); // not a member
    expect((await call('POST', `${content(ids.storeB)}/publish`, 'ownerC', ids.storeB)).status).toBe(403); // member, but STAFF
    expect(contentCalls).toEqual([]);
  });

  it('GET /content/flags/known is reachable', async () => {
    expect((await call('GET', '/content/flags/known', 'ownerB')).status).toBe(200);
  });
});
