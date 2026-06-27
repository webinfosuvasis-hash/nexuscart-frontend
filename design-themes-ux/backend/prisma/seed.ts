import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import slugify from 'slugify';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Plans ─────────────────────────────────────────────────────────────────
  const plans = await Promise.all([
    prisma.plan.upsert({
      where: { tier: 'STARTER' },
      create: {
        name: 'Starter', tier: 'STARTER',
        price: 499, yearlyPrice: 4990,
        maxProducts: 100, maxStaff: 2, maxOrders: 500,
        features: JSON.stringify(['Basic themes', 'Email support', 'Analytics dashboard']),
      },
      update: {},
    }),
    prisma.plan.upsert({
      where: { tier: 'GROWTH' },
      create: {
        name: 'Growth', tier: 'GROWTH',
        price: 1499, yearlyPrice: 14990,
        maxProducts: 1000, maxStaff: 5, maxOrders: 5000,
        isPopular: true,
        features: JSON.stringify(['Premium themes', 'Priority support', 'Advanced analytics', 'Marketing tools']),
      },
      update: {},
    }),
    prisma.plan.upsert({
      where: { tier: 'PRO' },
      create: {
        name: 'Pro', tier: 'PRO',
        price: 3499, yearlyPrice: 34990,
        maxProducts: 10000, maxStaff: 20, maxOrders: null,
        features: JSON.stringify(['All themes', '24/7 support', 'API access', 'Multi-warehouse', 'Custom domain']),
      },
      update: {},
    }),
    prisma.plan.upsert({
      where: { tier: 'ENTERPRISE' },
      create: {
        name: 'Enterprise', tier: 'ENTERPRISE',
        price: 9999, yearlyPrice: 99990,
        maxProducts: null, maxStaff: null, maxOrders: null,
        features: JSON.stringify(['Unlimited everything', 'Dedicated support', 'SLA', 'White label']),
      },
      update: {},
    }),
  ]);
  console.log(`✅ ${plans.length} plans seeded`);

  // ─── Super Admin ──────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@123456', 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@nexuscart.com' },
    create: {
      name: 'Super Admin',
      email: 'admin@nexuscart.com',
      password: adminPassword,
      role: 'SUPER_ADMIN',
    },
    update: {},
  });
  console.log(`✅ Super admin: ${superAdmin.email}`);

  // ─── Demo Store Owner ─────────────────────────────────────────────────────
  const ownerPassword = await bcrypt.hash('Owner@123456', 12);
  const owner = await prisma.user.upsert({
    where: { email: 'owner@fashionstore.com' },
    create: {
      name: 'Priya Sharma',
      email: 'owner@fashionstore.com',
      password: ownerPassword,
      role: 'STORE_OWNER',
    },
    update: {},
  });

  const store = await prisma.store.upsert({
    where: { slug: 'fashion-by-priya' },
    create: {
      name: 'Fashion by Priya',
      slug: 'fashion-by-priya',
      domain: 'fashion-by-priya.nexuscart.com',
      businessType: 'FASHION',
      status: 'ACTIVE',
      ownerId: owner.id,
      staff: { create: { userId: owner.id, role: 'OWNER' } },
      settings: {
        create: {
          currency: 'INR',
          language: 'en',
          timezone: 'Asia/Kolkata',
          primaryColor: '#7c3aed',
        },
      },
    },
    update: {},
  });

  // Subscription for demo store
  const growthPlan = plans[1];
  await prisma.subscription.upsert({
    where: { storeId: store.id },
    create: {
      storeId: store.id,
      planId: growthPlan.id,
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    },
    update: {},
  });
  console.log(`✅ Demo store: ${store.name} (${store.domain})`);

  // ─── Sample Categories ────────────────────────────────────────────────────
  const catNames = ['Women', 'Men', 'Kids', 'Accessories'];
  for (const name of catNames) {
    const slug = slugify(name, { lower: true });
    await prisma.category.upsert({
      where: { storeId_slug: { storeId: store.id, slug } },
      create: { storeId: store.id, name, slug },
      update: {},
    });
  }
  console.log(`✅ ${catNames.length} categories seeded`);

  // ─── Sample Products ──────────────────────────────────────────────────────
  const categories = await prisma.category.findMany({ where: { storeId: store.id } });
  const products = [
    { name: 'Floral Kurta Set', price: 1299, sku: 'KUR-001', stock: 45, status: 'ACTIVE' },
    { name: 'Embroidered Dupatta', price: 599, sku: 'DUP-001', stock: 30, status: 'ACTIVE' },
    { name: 'Cotton Salwar Suit', price: 1899, sku: 'SAL-001', stock: 8, status: 'ACTIVE' },
    { name: 'Silk Saree', price: 3499, sku: 'SAR-001', stock: 15, status: 'ACTIVE' },
    { name: 'Casual Kurti', price: 799, sku: 'KUR-002', stock: 0, status: 'DRAFT' },
  ];

  for (const p of products) {
    const slug = slugify(p.name, { lower: true, strict: true });
    await prisma.product.upsert({
      where: { storeId_slug: { storeId: store.id, slug } },
      create: {
        storeId: store.id,
        categoryId: categories[0]?.id ?? null,
        ...p,
        slug,
        images: JSON.stringify([]),
        tags: JSON.stringify(['fashion', 'women']),
        trackInventory: true,
        lowStockThreshold: 10,
      } as any,
      update: {},
    });
  }
  console.log(`✅ ${products.length} products seeded`);

  // ─── Sample Themes ────────────────────────────────────────────────────────
  const themes = [
    { name: 'Dawn', author: 'NexusCart', category: 'Fashion', price: 0 },
    { name: 'Impulse', author: 'NexusCart', category: 'General', price: 1499 },
    { name: 'Prestige', author: 'NexusCart', category: 'Luxury', price: 2999 },
    { name: 'Fresh', author: 'NexusCart', category: 'Grocery', price: 0 },
  ];

  for (const theme of themes) {
    await prisma.theme.upsert({
      where: { id: `theme-${theme.name.toLowerCase()}` },
      create: { id: `theme-${theme.name.toLowerCase()}`, ...theme, isMarketplace: true },
      update: {},
    });
  }
  console.log(`✅ ${themes.length} themes seeded`);

  console.log('\n✨ Database seeded successfully!');
  console.log('📧 Super Admin: admin@nexuscart.com / Admin@123456');
  console.log('📧 Store Owner: owner@fashionstore.com / Owner@123456');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
