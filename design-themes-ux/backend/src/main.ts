import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as express from 'express';
import { join } from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  // Ensure uploads directory exists
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
    bodyParser: false, // we set a size-limited parser below
  });

  const config = app.get(ConfigService);

  // Validate critical secrets at startup — fail fast rather than silently running insecure
  const jwtSecret = config.get<string>('JWT_SECRET') ?? '';
  const jwtRefresh = config.get<string>('JWT_REFRESH_SECRET') ?? '';
  const WEAK_DEFAULTS = new Set([
    'super-secret-jwt-key-change-in-production',
    'super-secret-refresh-key-change-in-production',
    'secret', 'changeme', 'password',
  ]);
  if (!jwtSecret || jwtSecret.length < 32 || WEAK_DEFAULTS.has(jwtSecret)) {
    throw new Error('JWT_SECRET is missing, too short (<32 chars), or is a default placeholder. Set a strong secret.');
  }
  if (!jwtRefresh || jwtRefresh.length < 32 || WEAK_DEFAULTS.has(jwtRefresh)) {
    throw new Error('JWT_REFRESH_SECRET is missing, too short (<32 chars), or is a default placeholder. Set a strong secret.');
  }

  // Security
  app.use(helmet());

  // Limit JSON and URL-encoded body size to prevent payload flooding
  app.use(express.json({ limit: '50kb' }));
  app.use(express.urlencoded({ extended: true, limit: '50kb' }));

  // CORS — always allow any localhost port in dev; production restricts via CORS_ORIGIN
  const corsOriginEnv = config.get<string>('CORS_ORIGIN');
  const allowedOrigins = corsOriginEnv
    ? corsOriginEnv.split(',').map((o) => o.trim())
    : [];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      // Allow localhost on any port in non-production environments only
      if (
        config.get<string>('NODE_ENV') !== 'production' &&
        /^https?:\/\/localhost(:\d+)?$/.test(origin)
      ) return callback(null, true);
      // Allow explicitly configured origins
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Store-Id', 'X-Theme-Id'],
  });

  // Serve uploaded files.
  //
  // Security model:
  //   - Images: displayed inline, cross-origin permitted so the admin panel
  //     (port 5174) and storefront can render them. CSP blocks script execution
  //     even for SVG uploads. nosniff prevents MIME-type confusion.
  //   - Non-images (HTML, JS, etc.): forced download + same-origin to prevent
  //     any executable content from running in the browser.
  //
  // Cross-Origin-Resource-Policy is set per-file here to override Helmet's
  // global `same-origin` default, which would otherwise block cross-origin
  // image loading between the dev frontend (5174) and the API (3000).
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
    setHeaders: (res, filePath) => {
      const isImage = /\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(filePath);
      res.setHeader('Cross-Origin-Resource-Policy', isImage ? 'cross-origin' : 'same-origin');
      res.setHeader('Content-Disposition', isImage ? 'inline' : 'attachment');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'");
    },
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,         // Strip unknown properties
      forbidNonWhitelisted: false,
      transform: true,         // Auto-transform types (string → number)
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger API docs — development/local only
  const swaggerEnvs = new Set(['development', 'local', undefined]);
  if (swaggerEnvs.has(config.get<string>('NODE_ENV'))) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NexusCart API')
      .setDescription('Multi-Tenant SaaS E-Commerce Platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .addGlobalParameters({
        in: 'header',
        required: false,
        name: 'X-Store-Id',
        description: 'Store ID for multi-tenant context',
        schema: { type: 'string' },
      })
      .addTag('Auth')
      .addTag('Products')
      .addTag('Categories')
      .addTag('Orders')
      .addTag('Customers')
      .addTag('Inventory')
      .addTag('Marketing')
      .addTag('CMS')
      .addTag('Themes')
      .addTag('Search')
      .addTag('Analytics')
      .addTag('Stores')
      .addTag('Subscriptions')
      .addTag('Users')
      .addTag('Theme Engine')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = config.get<number>('PORT') ?? 3000;
  const server = await app.listen(port);

  // Close idle connections before they can be used for slow-loris attacks
  server.setTimeout(30000); // 30 s request timeout

  const isDev = config.get<string>('NODE_ENV') !== 'production';
  console.log(`NexusCart API running on http://localhost:${port}/api/v1`);
  if (isDev) console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
