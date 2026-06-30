import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { STORE_ID } from './constants';
import { HOMEPAGE_SECTIONS } from './homepage-sections.data';

const TX_OPTS = { timeout: 60_000, maxWait: 60_000 };

/**
 * Ensures the Store row, StoreSettings, an "aurus" Theme + active StoreTheme
 * all exist. The Store already exists in every environment this seeder is
 * meant to run against (it's the store VITE_STORE_ID points at) — the
 * create branch only fires on a genuinely fresh database.
 */
async function seedStoreAndTheme(prisma: PrismaClient) {
  let store = await prisma.store.findUnique({ where: { id: STORE_ID } });

  if (!store) {
    const ownerPassword = await bcrypt.hash('Owner@123456', 12);
    const owner = await prisma.user.upsert({
      where: { email: 'owner@nexuscart-fashion.com' },
      create: { name: 'Store Owner', email: 'owner@nexuscart-fashion.com', password: ownerPassword, role: 'STORE_OWNER' },
      update: {},
    });
    store = await prisma.store.create({
      data: {
        id: STORE_ID, name: "Shib's Store", slug: `shibs-store-${STORE_ID.slice(-6)}`,
        domain: `shibs-store-${STORE_ID.slice(-6)}.nexuscart.com`,
        businessType: 'FASHION', status: 'ACTIVE', ownerId: owner.id,
      },
    });
    console.log(`✅ Store created: ${store.name} (${store.id})`);
  }

  await prisma.storeSettings.upsert({
    where: { storeId: store.id },
    create: {
      storeId: store.id, primaryColor: '#7C2D12', currency: 'INR', language: 'en', timezone: 'Asia/Kolkata',
      metaTitle: "Shib's Store — Indian Ladies Fashion Online",
      metaDescription: 'Shop sarees, kurtis, lehengas, co-ord sets and festive wear online with free shipping and easy returns.',
      lowStockThreshold: 10,
    },
    update: {},
  });

  await prisma.theme.upsert({
    where: { id: 'aurus' },
    create: {
      id: 'aurus', name: 'Aurus', author: 'NexusCart', category: 'Fashion', price: 0,
      description: 'A premium, data-driven storefront theme for Indian fashion retailers.',
      isMarketplace: true,
    },
    update: {},
  });

  await prisma.storeTheme.updateMany({
    where: { storeId: store.id, themeId: { not: 'aurus' } },
    data: { isActive: false },
  });
  await prisma.storeTheme.upsert({
    where: { storeId_themeId: { storeId: store.id, themeId: 'aurus' } },
    create: { storeId: store.id, themeId: 'aurus', isActive: true, activatedAt: new Date() },
    update: { isActive: true, activatedAt: new Date() },
  });

  console.log(`✅ Store settings + active "aurus" theme confirmed for ${store.name}`);
  return store;
}

/** Upserts the homepage BuilderPage and rewrites all 17 section configs. */
async function seedBuilderSections(prisma: PrismaClient) {
  const page = await prisma.builderPage.upsert({
    where: { storeId_pageType_slug: { storeId: STORE_ID, pageType: 'home', slug: 'home' } },
    create: { storeId: STORE_ID, pageType: 'home', slug: 'home', name: 'Homepage', status: 'LIVE', version: 1 },
    update: { status: 'LIVE' },
  });

  let updated = 0;
  let created = 0;

  await prisma.$transaction(async (tx) => {
    for (const [i, section] of HOMEPAGE_SECTIONS.entries()) {
      const existing = await tx.builderSection.findFirst({
        where: { storeId: STORE_ID, pageId: page.id, sectionType: section.sectionType },
      });

      const config = section.config as Prisma.InputJsonValue;

      if (existing) {
        await tx.builderSection.update({
          where: { id: existing.id },
          data: { label: section.label, config, sortOrder: i + 1, isEnabled: true, status: 'LIVE' },
        });
        updated++;
      } else {
        await tx.builderSection.create({
          data: {
            storeId: STORE_ID, pageId: page.id, sectionType: section.sectionType, label: section.label,
            sortOrder: i + 1, isEnabled: true, isLocked: false, status: 'LIVE', config,
          },
        });
        created++;
      }
    }
  }, TX_OPTS);

  console.log(`✅ Homepage sections: ${updated} updated, ${created} created (${HOMEPAGE_SECTIONS.length} total)`);
}

export async function seedHomepage(prisma: PrismaClient): Promise<void> {
  await seedStoreAndTheme(prisma);
  await seedBuilderSections(prisma);
}
