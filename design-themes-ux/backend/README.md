# NexusCart Backend

NestJS + Prisma + MySQL backend for the NexusCart Multi-Tenant SaaS E-Commerce Platform.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file and configure
cp .env.example .env
# Edit DATABASE_URL, JWT_SECRET, etc.

# 3. Generate Prisma client
npm run prisma:generate

# 4. Run migrations
npm run prisma:migrate

# 5. Seed database (plans, demo store, products)
npm run prisma:seed

# 6. Start development server
npm run start:dev
```

API: http://localhost:3000/api/v1  
Swagger: http://localhost:3000/api/docs

## Architecture

### Multi-Tenant Design
Every request to a store-scoped endpoint must include `X-Store-Id` header:
```
X-Store-Id: clx1y2z3...
Authorization: Bearer <jwt>
```

The `StoreContextMiddleware` extracts and validates the store, then the `StoreContextGuard` enforces it where required.

### Auth Flow
1. `POST /api/v1/auth/register` — creates user + store, returns tokens
2. `POST /api/v1/auth/login` — returns `{ accessToken, refreshToken, user }`
3. `POST /api/v1/auth/refresh` — exchanges refresh token for new access token
4. Access token expires in 15m, refresh token in 7d

### RBAC
```
SUPER_ADMIN  → full platform access
STORE_OWNER  → full store access
STORE_MANAGER → products, orders, CMS
STORE_STAFF  → read orders, read products
CUSTOMER     → own profile, own orders
```

Use `@Permissions('resource:action')` on controllers, e.g. `@Permissions('products:create')`.

## Modules

| Module | Prefix | Description |
|--------|--------|-------------|
| Auth | `/auth` | JWT login, register, refresh |
| Products | `/products` | CRUD, bulk ops, variants |
| Categories | `/categories` | Tree structure, reorder |
| Orders | `/orders` | Status machine, timeline, refunds |
| Customers | `/customers` | Segments, loyalty points |
| Inventory | `/inventory` | Warehouses, suppliers, POs, movements |
| Marketing | `/marketing` | Coupons, campaigns, email templates |
| CMS | `/cms` | Pages, sections, menus, blog |
| Themes | `/themes` | Marketplace, install, activate, customize |
| Search | `/search` | Full-text, autocomplete, synonyms, merchandising |
| Analytics | `/analytics` | Summary, revenue trend, funnel, top products |
| Stores | `/stores` | Multi-tenant store management (super admin) |
| Subscriptions | `/subscriptions` | Plans, billing, usage |
| Users | `/users` | Staff management, invite |

## Response Format

All responses are wrapped:
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-06-17T..."
}
```

Errors:
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "timestamp": "...",
  "path": "/api/v1/products"
}
```

## Database

MySQL with Prisma ORM. Schema at `prisma/schema.prisma`.

```bash
npx prisma studio    # Visual DB browser
npx prisma migrate dev --name <name>   # Create migration
```
