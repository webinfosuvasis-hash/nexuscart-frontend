import { Prisma, PrismaClient } from '@prisma/client';
import { STORE_ID } from './constants';
import { BRANDS } from './brands.data';
import { SUBCATEGORIES } from './categories.data';
import { PRODUCTS, ProductSeed } from './products.data';
import { COLLECTIONS } from './collections.data';
import { CUSTOMERS, REVIEW_TEMPLATES } from './reviews.data';
import { seedAttributes } from './attributes.seed';

const TX_OPTS = { timeout: 60_000, maxWait: 60_000 };

async function seedBrands(prisma: PrismaClient): Promise<Map<string, string>> {
  const brandBySlug = new Map<string, string>();
  await prisma.$transaction(async (tx) => {
    for (const b of BRANDS) {
      const brand = await tx.brand.upsert({
        where: { storeId_slug: { storeId: STORE_ID, slug: b.slug } },
        create: {
          storeId: STORE_ID, name: b.name, slug: b.slug, description: b.description,
          logo: b.logo, bannerImage: b.bannerImage, websiteUrl: b.websiteUrl,
          metaTitle: b.metaTitle, metaDescription: b.metaDescription,
          isFeatured: b.isFeatured, isActive: true, sortOrder: b.sortOrder,
        },
        update: {
          name: b.name, description: b.description, logo: b.logo, bannerImage: b.bannerImage,
          websiteUrl: b.websiteUrl, metaTitle: b.metaTitle, metaDescription: b.metaDescription,
          isFeatured: b.isFeatured, sortOrder: b.sortOrder,
        },
      });
      brandBySlug.set(b.slug, brand.id);
    }
  }, TX_OPTS);
  console.log(`✅ ${BRANDS.length} brands seeded`);
  return brandBySlug;
}

async function seedCategories(prisma: PrismaClient): Promise<Map<string, string>> {
  const womenCategory = await prisma.category.findFirst({
    where: { storeId: STORE_ID, name: 'Women', parentId: null },
  });
  if (!womenCategory) {
    throw new Error('Root "Women" category not found for store — cannot seed fashion subcategories.');
  }

  const categoryBySlug = new Map<string, string>();
  await prisma.$transaction(async (tx) => {
    for (const c of SUBCATEGORIES) {
      const category = await tx.category.upsert({
        where: { storeId_slug: { storeId: STORE_ID, slug: c.slug } },
        create: {
          storeId: STORE_ID, parentId: womenCategory.id, name: c.name, slug: c.slug,
          description: c.description, image: c.image, bannerImage: c.bannerImage,
          metaTitle: c.metaTitle, metaDescription: c.metaDescription,
          sortOrder: c.sortOrder, isFeatured: c.isFeatured, showOnHomepage: c.showOnHomepage,
          isActive: true, menuVisibility: 'BOTH',
        },
        update: {
          parentId: womenCategory.id, description: c.description, image: c.image, bannerImage: c.bannerImage,
          metaTitle: c.metaTitle, metaDescription: c.metaDescription,
          sortOrder: c.sortOrder, isFeatured: c.isFeatured, showOnHomepage: c.showOnHomepage,
        },
      });
      categoryBySlug.set(c.slug, category.id);
    }
  }, TX_OPTS);
  console.log(`✅ ${SUBCATEGORIES.length} subcategories seeded under "${womenCategory.name}"`);
  return categoryBySlug;
}

async function seedCustomers(prisma: PrismaClient): Promise<Map<string, string>> {
  const customerByEmail = new Map<string, string>();
  await prisma.$transaction(async (tx) => {
    for (const [i, cust] of CUSTOMERS.entries()) {
      const customer = await tx.customer.upsert({
        where: { storeId_email: { storeId: STORE_ID, email: cust.email } },
        create: {
          storeId: STORE_ID, email: cust.email, name: cust.name, phone: cust.phone,
          segment: cust.segment, isActive: true,
          addresses: {
            create: {
              label: 'Home',
              firstName: cust.name.split(' ')[0],
              lastName: cust.name.split(' ').slice(1).join(' '),
              line1: `${101 + i * 7}, MG Road`,
              city: cust.city, state: cust.state, postalCode: '400001', country: 'IN',
              phone: cust.phone, isDefault: true,
            },
          },
        },
        update: { name: cust.name, phone: cust.phone, segment: cust.segment },
      });
      customerByEmail.set(cust.email, customer.id);
    }
  }, TX_OPTS);
  console.log(`✅ ${CUSTOMERS.length} customers seeded`);
  return customerByEmail;
}

async function seedProducts(
  prisma: PrismaClient,
  brandBySlug: Map<string, string>,
  categoryBySlug: Map<string, string>,
): Promise<Map<string, string>> {
  const productIdBySlug = new Map<string, string>();

  await prisma.$transaction(async (tx) => {
    for (const p of PRODUCTS) {
      const categoryId = categoryBySlug.get(p.categorySlug);
      const brandId = brandBySlug.get(p.brandSlug);
      if (!categoryId || !brandId) {
        throw new Error(`Missing category/brand for product "${p.slug}" (category=${p.categorySlug}, brand=${p.brandSlug})`);
      }

      const tags = [p.fabric, p.color, p.pattern, p.occasion, p.season, p.fit].filter((t) => t && t !== 'N/A');

      const product = await tx.product.upsert({
        where: { storeId_slug: { storeId: STORE_ID, slug: p.slug } },
        create: {
          storeId: STORE_ID, categoryId, brandId, name: p.name, slug: p.slug,
          description: p.description, shortDescription: p.shortDescription,
          price: p.price, comparePrice: p.comparePrice, costPrice: p.costPrice,
          sku: p.sku, barcode: p.barcode, weight: p.weight,
          status: 'ACTIVE', approvalStatus: 'APPROVED',
          isFeatured: p.isFeatured, trackInventory: true, stock: p.stock, lowStockThreshold: p.lowStockThreshold,
          images: JSON.stringify(p.images), thumbnail: p.thumbnail,
          tags: JSON.stringify(tags), badges: JSON.stringify(p.badges),
          seo: p.seo, hsCode: p.hsCode, priceIncludesTax: true, taxCategory: p.taxCategory,
          templateType: 'default', internalNotes: `Seeded — ${p.family} family, brand ${p.brandSlug}`,
          publishAt: new Date(),
        },
        update: {
          categoryId, brandId, name: p.name, description: p.description, shortDescription: p.shortDescription,
          price: p.price, comparePrice: p.comparePrice, costPrice: p.costPrice, weight: p.weight,
          status: 'ACTIVE', approvalStatus: 'APPROVED', isFeatured: p.isFeatured,
          stock: p.stock, lowStockThreshold: p.lowStockThreshold,
          images: JSON.stringify(p.images), thumbnail: p.thumbnail,
          tags: JSON.stringify(tags), badges: JSON.stringify(p.badges),
          seo: p.seo, hsCode: p.hsCode, taxCategory: p.taxCategory,
        },
      });
      productIdBySlug.set(p.slug, product.id);
    }
  }, TX_OPTS);

  console.log(`✅ ${PRODUCTS.length} products seeded`);
  return productIdBySlug;
}

async function seedVariantsAndReviews(
  prisma: PrismaClient,
  productIdBySlug: Map<string, string>,
  customerByEmail: Map<string, string>,
) {
  let variantCount = 0;
  let reviewCount = 0;
  let reviewTemplateCursor = 0;
  let customerCursor = 0;

  await prisma.$transaction(async (tx) => {
    for (const [index, p] of PRODUCTS.entries()) {
      const productId = productIdBySlug.get(p.slug)!;

      // SKUs are deterministic per (product, color, size), so they double as
      // the idempotency key — find-by-sku then update-or-create, rather than
      // skip-if-any-exist, so re-running the seed refreshes variant content
      // (e.g. images) instead of freezing it at whatever the first run wrote.
      let vi = 0;
      for (const color of p.variantColors) {
        for (const size of p.variantSizes) {
          vi++;
          const sku = `${p.sku}-${color.slice(0, 3).toUpperCase()}-${size}`;
          const data = {
            name: `${color} / ${size}`,
            price: p.price,
            comparePrice: p.comparePrice,
            stock: Math.max(3, Math.floor(p.stock / (p.variantColors.length * p.variantSizes.length))),
            image: p.images[vi % p.images.length],
            options: JSON.stringify({ size, color }),
          };
          const existing = await tx.productVariant.findFirst({ where: { productId, sku } });
          if (existing) {
            await tx.productVariant.update({ where: { id: existing.id }, data });
          } else {
            await tx.productVariant.create({ data: { productId, sku, ...data } });
            variantCount += 1;
          }
        }
      }

      const existingReviews = await tx.productReview.count({ where: { productId } });
      if (existingReviews === 0) {
        const numReviews = 2 + (index % 4); // 2-5 reviews per product
        const reviewsData: Prisma.ProductReviewCreateManyInput[] = [];
        for (let i = 0; i < numReviews; i++) {
          const template = REVIEW_TEMPLATES[reviewTemplateCursor % REVIEW_TEMPLATES.length];
          const cust = CUSTOMERS[customerCursor % CUSTOMERS.length];
          reviewTemplateCursor++;
          customerCursor++;
          const customerId = customerByEmail.get(cust.email)!;
          reviewsData.push({
            productId,
            customerId,
            rating: template.rating,
            title: template.title,
            body: template.body,
            isVerified: template.isVerified,
            isVisible: true,
            createdAt: new Date(Date.now() - (i + 1) * 1000 * 60 * 60 * 24 * (3 + index)),
          });
        }
        await tx.productReview.createMany({ data: reviewsData });
        reviewCount += reviewsData.length;
      }
    }
  }, TX_OPTS);

  console.log(`✅ ${variantCount} product variants seeded (skipped products that already had variants)`);
  console.log(`✅ ${reviewCount} product reviews seeded (skipped products that already had reviews)`);
}

async function seedInventory(prisma: PrismaClient, productIdBySlug: Map<string, string>) {
  let warehouse = await prisma.warehouse.findFirst({
    where: { storeId: STORE_ID, name: 'Mumbai Fulfillment Center' },
  });
  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: {
        storeId: STORE_ID, name: 'Mumbai Fulfillment Center', location: 'Bhiwandi, Maharashtra',
        address: 'Plot 12, MIDC Industrial Area, Bhiwandi, Thane, Maharashtra 421302',
        manager: 'Rahul Deshmukh', phone: '+91 98200 12345', status: 'ACTIVE', capacity: 50_000,
      },
    });
  }

  await prisma.$transaction(async (tx) => {
    for (const p of PRODUCTS) {
      const productId = productIdBySlug.get(p.slug)!;
      await tx.warehouseStock.upsert({
        where: { warehouseId_productId: { warehouseId: warehouse!.id, productId } },
        create: { warehouseId: warehouse!.id, productId, stock: p.stock, reserved: Math.min(5, Math.floor(p.stock * 0.05)) },
        update: { stock: p.stock, reserved: Math.min(5, Math.floor(p.stock * 0.05)) },
      });
    }
  }, TX_OPTS);
  console.log(`✅ Warehouse inventory seeded for ${PRODUCTS.length} products at "${warehouse.name}"`);
}

async function seedCollections(prisma: PrismaClient, productIdBySlug: Map<string, string>) {
  const collectionIdBySlug = new Map<string, string>();

  await prisma.$transaction(async (tx) => {
    for (const c of COLLECTIONS) {
      const collection = await tx.collection.upsert({
        where: { storeId_slug: { storeId: STORE_ID, slug: c.slug } },
        create: {
          storeId: STORE_ID, name: c.name, slug: c.slug, description: c.description,
          image: c.image, type: 'MANUAL', sortBy: 'MANUAL', isFeatured: c.isFeatured, isActive: true,
        },
        update: { description: c.description, image: c.image, isFeatured: c.isFeatured },
      });
      collectionIdBySlug.set(c.slug, collection.id);
    }
  }, TX_OPTS);
  console.log(`✅ ${COLLECTIONS.length} collections seeded`);

  let membershipCount = 0;
  await prisma.$transaction(async (tx) => {
    for (const c of COLLECTIONS) {
      const collectionId = collectionIdBySlug.get(c.slug)!;
      const matched = PRODUCTS.filter(c.matches);
      for (const [i, mp] of matched.entries()) {
        const productId = productIdBySlug.get(mp.slug)!;
        await tx.productCollection.upsert({
          where: { productId_collectionId: { productId, collectionId } },
          create: { productId, collectionId, sortOrder: i, isPinned: i === 0 },
          update: { sortOrder: i },
        });
        membershipCount++;
      }
    }
  }, TX_OPTS);
  console.log(`✅ ${membershipCount} product-collection memberships seeded`);
}

/** Cross-sell / upsell / related products — computed from sibling category/family after all products exist. */
async function seedCrossReferences(prisma: PrismaClient, productIdBySlug: Map<string, string>) {
  await prisma.$transaction(async (tx) => {
    for (const p of PRODUCTS) {
      const productId = productIdBySlug.get(p.slug)!;
      const related = PRODUCTS
        .filter((x) => x.categorySlug === p.categorySlug && x.slug !== p.slug)
        .slice(0, 4)
        .map((x) => productIdBySlug.get(x.slug));
      const crossFamily = PRODUCTS
        .filter((x) => x.family !== p.family)
        .slice(0, 4)
        .map((x) => productIdBySlug.get(x.slug));

      await tx.product.update({
        where: { id: productId },
        data: {
          relatedProductIds: JSON.stringify(related),
          crossSellIds: JSON.stringify(crossFamily.slice(0, 2)),
          upsellIds: JSON.stringify(related.slice(0, 2)),
        },
      });
    }
  }, TX_OPTS);
  console.log(`✅ Related/cross-sell/upsell product references resolved for ${PRODUCTS.length} products`);
}

export async function seedFashionCatalog(prisma: PrismaClient): Promise<{ productIdBySlug: Map<string, string> }> {
  const brandBySlug = await seedBrands(prisma);
  const categoryBySlug = await seedCategories(prisma);
  const customerByEmail = await seedCustomers(prisma);
  const productIdBySlug = await seedProducts(prisma, brandBySlug, categoryBySlug);
  await seedVariantsAndReviews(prisma, productIdBySlug, customerByEmail);
  await seedAttributes(prisma, productIdBySlug);
  await seedInventory(prisma, productIdBySlug);
  await seedCollections(prisma, productIdBySlug);
  await seedCrossReferences(prisma, productIdBySlug);
  return { productIdBySlug };
}

export type { ProductSeed };
