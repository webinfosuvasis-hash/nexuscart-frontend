/**
 * build-ecraftindia-homepage.ts
 *
 * Builds a complete eCraftIndia-style handicraft ecommerce homepage.
 * Matches the screenshot: 15 sections including circular categories,
 * product carousels, mosaic grid, editorial banner, trust badges.
 *
 * Usage:
 *   npx ts-node --transpile-only prisma/scripts/build-ecraftindia-homepage.ts
 *
 * Options:
 *   STORE_ID=xxx   target store (default: first active store)
 *   DRY_RUN=true   log sections without writing
 *   WIPE=true      delete existing home sections first
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const DRY_RUN  = process.env.DRY_RUN  === 'true';
const WIPE     = process.env.WIPE     !== 'false'; // default true
const STORE_ID = process.env.STORE_ID ?? '';

// ─── Brand constants ──────────────────────────────────────────────────────────
const BRAND_RED      = '#cc3300';
const BRAND_ORANGE   = '#e05828';
const PAGE_ID        = 'home';
const THEME_ID       = 'default';
const OFF_WHITE      = '#fdf8f3';

// ─── Section factory ──────────────────────────────────────────────────────────
let sortIdx = 0;
function next() { return ++sortIdx * 10.0; }

function section(
  sectionDefId: string,
  label:        string,
  settings:     Record<string, unknown>,
  blocks:       { type: string; settings: Record<string, unknown> }[] = [],
) {
  return { sectionDefId, label, settings, blocks, sortOrder: next(), isVisible: true };
}

// ─── Homepage sections ────────────────────────────────────────────────────────

function buildSections(collections: Record<string, string>) {
  const col = (name: string) => collections[name] ?? '';  // collection ID by name

  return [

    // ── 1. Announcement bar ────────────────────────────────────────────────────
    section('announcement_bar', 'Announcement Bar', {
      background:      BRAND_ORANGE,
      textColor:       '#ffffff',
      paddingVertical: 7,
    }, [
      { type: 'announcement', settings: {
        text:     'Free shipping on all India order · 10% off on your purchase above ₹1499. Use code: FIRST10 to get discount',
        fontSize: 12,
      }},
    ]),

    // ── 2. Hero — Iron Wall Hanging ────────────────────────────────────────────
    section('hero', 'Hero — Iron Wall Hanging', {
      backgroundColor:  '#f5ece0',
      height:           'md',
      contentAlignment: 'left',
      overlayOpacity:   0,
    }, [
      { type: 'heading', settings: {
        text:              'IRON WALL HANGING',
        typographyPreset:  'h1',
        textColor:         '#1a1a1a',
        width:             'fit',
      }},
      { type: 'paragraph', settings: {
        text:      'Adorn your wall and let it\nreflect your amazing choice',
        textColor: '#555555',
      }},
      { type: 'button', settings: {
        label: 'Shop Now',
        link:  '/collections/wall-hangings',
        style: 'outline',
        size:  'md',
      }},
    ]),

    // ── 3. Category circles — row 1 (8 categories) ───────────────────────────
    section('collection_circles', 'Category Circles', {
      bg:            '#ffffff',
      paddingTop:    28,
      paddingBottom: 28,
      circleSize:    100,
      items: [
        { label: 'Handicraft Home',  link: '/collections/handicraft-home',  color: '#fef3c7' },
        { label: 'Water Fountains',  link: '/collections/water-fountains',  color: '#dbeafe' },
        { label: 'Buddha Idols',     link: '/collections/buddha-idols',     color: '#f3e8ff' },
        { label: 'Pendulum Clocks',  link: '/collections/pendulum-clocks',  color: '#dcfce7' },
        { label: 'Wall Hangings',    link: '/collections/wall-hangings',    color: '#fee2e2' },
        { label: 'Couple Statues',   link: '/collections/couple-statues',   color: '#fdf2f8' },
        { label: 'Buddha Paintings', link: '/collections/buddha-paintings', color: '#fffbeb' },
        { label: 'Brass Idols',      link: '/collections/brass-idols',      color: '#f0fdf4' },
      ],
    }),

    // ── 4. Product mosaic grid ────────────────────────────────────────────────
    section('product_mosaic', 'Product Showcase Grid', {
      bg:            '#ffffff',
      paddingTop:    16,
      paddingBottom: 24,
      items: [
        { label: 'Bird Figurines',              link: '/collections/bird-figurines',              color: '#fef9e7' },
        { label: 'Tea Light Holders',           link: '/collections/tea-light-holders',           color: '#fdf2e9' },
        { label: 'Lamps And Lightings',         link: '/collections/lamps-lightings',             color: '#f9f2f4' },
        { label: 'Owl Figurines',               link: '/collections/owl-figurines',               color: '#eaf4fb' },
        { label: 'Radha Krishna',               link: '/collections/radha-krishna',   featured: true, color: '#fdf5e6' },
        { label: 'Ganesha Car Dashboard',       link: '/collections/ganesha-car',                 color: '#f0f3ff' },
        { label: 'Goddess Idols',               link: '/collections/goddess-idols',               color: '#fff0f5' },
        { label: 'Scented Candles',             link: '/collections/scented-candles',             color: '#f5f0ff' },
        { label: 'Brass Diyas',                 link: '/collections/brass-diyas',                 color: '#fffde7' },
      ],
    }),

    // ── 5. New Arrival editorial banner ──────────────────────────────────────
    section('editorial_banner', 'New Arrival Banner', {
      bg:           OFF_WHITE,
      scriptText:   'New Arrival',
      subtitle:     'Select from the latest collection',
      accentColor:  BRAND_RED,
      paddingTop:   20,
      paddingBottom:20,
    }),

    // ── 6. Product carousel — Shri Ram Mandir ────────────────────────────────
    section('featured_collection', 'Shri Ram Mandir Collection', {
      sectionTitle:        'SHRI RAM MANDIR',
      titleColor:          BRAND_RED,
      titleAlign:          'center',
      titleSize:           22,
      productsToShow:      5,
      columnsDesktop:      '5',
      columnsMobile:       '2',
      showViewAll:         true,
      viewAllLabel:        'View All',
      bg:                  '#ffffff',
      paddingTop:          32,
      paddingBottom:       32,
      collection:          col('Shri Ram Mandir'),
    }, [
      { type: 'collection_title', settings: { text: 'SHRI RAM MANDIR', textColor: BRAND_RED, alignment: 'center' } },
      { type: 'view_all_button',  settings: { label: 'View All', link: '/collections/shri-ram-mandir' } },
      { type: 'product_card',     settings: { showRating: true, showQuickAdd: true, imageRatio: '1/1', showAddToCart: true, addToCartLabel: 'ADD TO CART', addToCartBg: BRAND_RED } },
    ]),

    // ── 7. Product carousel — Lord Shiva Idols ───────────────────────────────
    section('featured_collection', 'Lord Shiva Idols', {
      sectionTitle:   'LORD SHIVA IDOLS',
      titleColor:     BRAND_RED,
      titleAlign:     'center',
      titleSize:      22,
      productsToShow: 5,
      columnsDesktop: '5',
      columnsMobile:  '2',
      showViewAll:    true,
      bg:             '#ffffff',
      paddingTop:     32,
      paddingBottom:  32,
      collection:     col('Lord Shiva Idols'),
    }, [
      { type: 'collection_title', settings: { text: 'LORD SHIVA IDOLS', textColor: BRAND_RED, alignment: 'center' } },
      { type: 'view_all_button',  settings: { label: 'View All', link: '/collections/lord-shiva-idols' } },
      { type: 'product_card',     settings: { showRating: true, showQuickAdd: true, imageRatio: '1/1', showAddToCart: true, addToCartLabel: 'ADD TO CART', addToCartBg: BRAND_RED } },
    ]),

    // ── 8. Category circles — row 2 (6 categories) ──────────────────────────
    section('collection_circles', 'Category Circles 2', {
      bg:            '#ffffff',
      paddingTop:    24,
      paddingBottom: 24,
      circleSize:    100,
      items: [
        { label: 'Radha Krishna Paintings', link: '/collections/radha-krishna-paintings', color: '#fdf5e6' },
        { label: 'Stone Decor',             link: '/collections/stone-decor',             color: '#f2f2f2' },
        { label: 'Ganesha Paintings',       link: '/collections/ganesha-paintings',       color: '#fff8e1' },
        { label: 'Animal Figurines',        link: '/collections/animal-figurines',        color: '#e8f5e9' },
        { label: 'Paper Mache Clocks',      link: '/collections/paper-mache-clocks',      color: '#fce4ec' },
        { label: 'Kitchen and Dining',      link: '/collections/kitchen-dining',          color: '#e3f2fd' },
      ],
    }),

    // ── 9. Utkkal Lalit / Featured Product Showcase ──────────────────────────
    section('product_mosaic', 'Featured Product Showcase', {
      bg:            '#fdf8f3',
      paddingTop:    16,
      paddingBottom: 24,
      items: [
        { label: 'Goddess Lakshmi', link: '/collections/goddess-idols',  featured: true, color: '#fdf5e6' },
        { label: 'Shiva Statue',    link: '/collections/shiva-idols',                     color: '#f0f0f0' },
        { label: 'Wall Art',        link: '/collections/wall-art',                        color: '#e8f4f8' },
        { label: 'Silver Figurines',link: '/collections/silver-figurines',                color: '#f5f5f5' },
        { label: 'Lion Sculpture',  link: '/collections/sculptures',                      color: '#3d3d3d' },
        { label: 'Turtle Figurine', link: '/collections/animal-figurines',                color: '#e8f5e9' },
      ],
    }),

    // ── 10. Popular in Gifting ────────────────────────────────────────────────
    section('featured_collection', 'Popular in Gifting', {
      sectionTitle:   'POPULAR IN GIFTING',
      titleColor:     BRAND_RED,
      titleAlign:     'center',
      titleSize:      22,
      productsToShow: 4,
      columnsDesktop: '4',
      columnsMobile:  '2',
      showViewAll:    true,
      bg:             '#ffffff',
      paddingTop:     32,
      paddingBottom:  32,
      collection:     col('Popular in Gifting'),
    }, [
      { type: 'collection_title', settings: { text: 'POPULAR IN GIFTING', textColor: BRAND_RED, alignment: 'center' } },
      { type: 'view_all_button',  settings: { label: 'View All', link: '/collections/gifting' } },
      { type: 'product_card',     settings: { showRating: false, showQuickAdd: false, imageRatio: '1/1' } },
    ]),

    // ── 11. Brand story text ──────────────────────────────────────────────────
    section('brand_story', 'eCraftIndia Brand Story', {
      bg:           '#ffffff',
      paddingTop:   32,
      paddingBottom:32,
      title:        'eCraftIndia: A Home For All Handcrafted Items',
      body:         'eCraftIndia brings you a wide range of handcrafted products sourced directly from Indian artisans. We support the art of handicrafts and aim to keep the tradition alive. All our products are 100% handmade and support local artisans. Each product comes with a certificate of authenticity. Shop now and get free shipping on orders above ₹499.',
    }),

    // ── 12. Trust badges bar ─────────────────────────────────────────────────
    section('trust_badges_bar', 'Trust Badges', {
      bg:          '#ffffff',
      borderColor: '#e5e7eb',
      paddingTop:  20,
      paddingBottom:20,
      badges: [
        { icon: '🔒', title: '100% Safe & Secure Payments', description: 'All transactions encrypted & protected' },
        { icon: '↩️', title: '7 Days Return',               description: 'Easy hassle-free returns' },
        { icon: '🚚', title: 'Free Shipping',                description: 'On all orders above ₹499 across India' },
        { icon: '🎧', title: 'Help Centre',                  description: 'Mon–Sat 10am–6pm | 1800-123-0000' },
      ],
    }),

    // ── 13. Newsletter ────────────────────────────────────────────────────────
    section('newsletter', 'Newsletter Signup', {
      background:  '#f8f4f0',
      paddingTop:  40,
      paddingBottom:40,
    }, [
      { type: 'heading',   settings: { text: 'Newsletter Signup', typographyPreset: 'h2', textColor: '#1a1a1a' } },
      { type: 'paragraph', settings: { text: 'Subscribe to get special offers, free giveaways, and once-in-a-lifetime deals.', textColor: '#6b7280' } },
    ]),

  ]; // end sections array
}

// ─── Create collections ───────────────────────────────────────────────────────

async function ensureCollections(storeId: string): Promise<Record<string, string>> {
  const needed = [
    { name: 'Shri Ram Mandir',       slug: 'shri-ram-mandir' },
    { name: 'Lord Shiva Idols',      slug: 'lord-shiva-idols' },
    { name: 'Popular in Gifting',    slug: 'popular-in-gifting' },
    { name: 'Wall Hangings',         slug: 'wall-hangings' },
    { name: 'Buddha Idols',          slug: 'buddha-idols' },
    { name: 'Radha Krishna',         slug: 'radha-krishna' },
    { name: 'Goddess Idols',         slug: 'goddess-idols' },
    { name: 'Brass Idols',           slug: 'brass-idols' },
    { name: 'Animal Figurines',      slug: 'animal-figurines' },
    { name: 'Ganesha Idols',         slug: 'ganesha-idols' },
  ];

  const result: Record<string, string> = {};

  for (const col of needed) {
    let existing = await prisma.collection.findFirst({ where: { storeId, slug: col.slug } });
    if (!existing) {
      existing = await prisma.collection.create({
        data: {
          storeId,
          name:      col.name,
          slug:      col.slug,
          type:      'MANUAL',
          isActive:  true,
          isFeatured:false,
          sortBy:    'MANUAL',
        },
      });
      if (!DRY_RUN) console.log(`  ✓ Created collection: ${col.name}`);
    }
    result[col.name] = existing.id;
  }

  return result;
}

// ─── Create handicraft products ───────────────────────────────────────────────

async function ensureProducts(storeId: string, colIds: Record<string, string>): Promise<void> {
  const existing = await prisma.product.count({ where: { storeId } });
  if (existing >= 10) {
    console.log(`  → ${existing} products already exist, skipping product creation`);
    return;
  }

  const PRODUCTS = [
    // Shri Ram Mandir
    { name: 'Ram Mandir Wooden Miniature', sku: 'RM001', price: 1299, comparePrice: 1599, colKey: 'Shri Ram Mandir', images: [], badges: ['NEW'] },
    { name: 'Ayodhya Ram Mandir Model Gold Plated', sku: 'RM002', price: 1499, comparePrice: 1999, colKey: 'Shri Ram Mandir', images: [], badges: ['BEST_SELLER'] },
    { name: 'Ram Darbar Brass Idol Set', sku: 'RM003', price: 2199, comparePrice: 2999, colKey: 'Shri Ram Mandir', images: [], badges: [] },
    { name: 'Ram Lalla Idol Marble Look', sku: 'RM004', price: 899, comparePrice: 1199, colKey: 'Shri Ram Mandir', images: [], badges: ['NEW'] },
    { name: 'Ram Mandir Canvas Wall Art', sku: 'RM005', price: 1599, comparePrice: 1999, colKey: 'Shri Ram Mandir', images: [], badges: [] },
    // Lord Shiva
    { name: 'Gold & Black Shiva Dancing Statue', sku: 'SV001', price: 2499, comparePrice: 3499, colKey: 'Lord Shiva Idols', images: [], badges: ['BEST_SELLER'] },
    { name: 'Fiber Resin Shiva Meditating Statue', sku: 'SV002', price: 1899, comparePrice: 2499, colKey: 'Lord Shiva Idols', images: [], badges: [] },
    { name: 'White Marble Shiva Lingam', sku: 'SV003', price: 3299, comparePrice: 4499, colKey: 'Lord Shiva Idols', images: [], badges: ['NEW'] },
    { name: 'Lord Shiva Adiyogi Brass Idol', sku: 'SV004', price: 1299, comparePrice: 1799, colKey: 'Lord Shiva Idols', images: [], badges: [] },
    { name: 'Black Stone Shiva Nataraj', sku: 'SV005', price: 4599, comparePrice: 5999, colKey: 'Lord Shiva Idols', images: [], badges: [] },
    // Gifting
    { name: 'Sun Mirror Wall Decor', sku: 'GFT001', price: 1199, comparePrice: 1499, colKey: 'Popular in Gifting', images: [], badges: [] },
    { name: 'Crown Showpiece Gold Finish', sku: 'GFT002', price: 1499, comparePrice: 1999, colKey: 'Popular in Gifting', images: [], badges: ['BEST_SELLER'] },
    { name: 'Motivational Wall Art Canvas', sku: 'GFT003', price: 799, comparePrice: 999, colKey: 'Popular in Gifting', images: [], badges: [] },
    { name: 'Brass Elephant Lucky Charm', sku: 'GFT004', price: 1099, comparePrice: 1399, colKey: 'Popular in Gifting', images: [], badges: ['NEW'] },
    // Misc
    { name: 'Radha Krishna Brass Idol', sku: 'RK001', price: 3499, comparePrice: 4999, colKey: 'Radha Krishna', images: [], badges: ['BEST_SELLER'] },
    { name: 'Goddess Lakshmi Brass Idol', sku: 'LK001', price: 2299, comparePrice: 2999, colKey: 'Goddess Idols', images: [], badges: [] },
    { name: 'Wall Hanging Tribal Art', sku: 'WH001', price: 899, comparePrice: 1199, colKey: 'Wall Hangings', images: [], badges: ['NEW'] },
    { name: 'Buddha Meditation Statue', sku: 'BD001', price: 1599, comparePrice: 1999, colKey: 'Buddha Idols', images: [], badges: [] },
    { name: 'Iron Horse Wall Hanging Set', sku: 'IH001', price: 1299, comparePrice: 1699, colKey: 'Wall Hangings', images: [], badges: ['NEW'] },
    { name: 'Brass Ganesha Car Dashboard', sku: 'GN001', price: 299, comparePrice: 399, colKey: 'Ganesha Idols', images: [], badges: ['BEST_SELLER'] },
  ];

  let created = 0;
  for (const p of PRODUCTS) {
    const colId = colIds[p.colKey];

    const prod = await prisma.product.create({
      data: {
        storeId,
        name:         p.name,
        slug:         p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
        sku:          p.sku,
        price:        p.price,
        comparePrice: p.comparePrice,
        stock:        Math.floor(Math.random() * 50) + 5,
        status:       'ACTIVE',
        images:       [] as any,
        tags:         [] as any,
        badges:     p.badges as any,
        isFeatured: p.badges.includes('BEST_SELLER'),
      },
    });

    if (colId) {
      await prisma.productCollection.upsert({
        where: { productId_collectionId: { productId: prod.id, collectionId: colId } },
        update: {},
        create: { productId: prod.id, collectionId: colId, sortOrder: created },
      });
    }
    created++;
  }
  console.log(`  ✓ Created ${created} handicraft products`);
}

// ─── Save sections to DB ──────────────────────────────────────────────────────

async function saveSections(
  storeId:   string,
  sections:  ReturnType<typeof buildSections>,
): Promise<void> {
  if (WIPE && !DRY_RUN) {
    const deleted = await prisma.themePageSection.deleteMany({
      where: { storeId, pageId: PAGE_ID },
    });
    console.log(`  ✓ Wiped ${deleted.count} existing home sections`);
  }

  for (const sec of sections) {
    if (DRY_RUN) {
      console.log(`  [DRY] Would create: ${sec.sectionDefId} (${sec.label})`);
      continue;
    }

    // Check if section definition exists, create minimal one if not
    let def = await prisma.sectionDefinition.findUnique({ where: { id: sec.sectionDefId } });
    if (!def) {
      def = await prisma.sectionDefinition.create({
        data: {
          id:               sec.sectionDefId,
          name:             sec.label,
          category:         'CUSTOM',
          tier:             'FREE',
          settingsSchema:   [],
          compatibleThemes: ['*'],
          allowedBlockTypes:['*'],
          isBuiltIn:        false,
          isActive:         true,
          version:          '1.0.0',
        },
      });
    }

    const created = await prisma.themePageSection.create({
      data: {
        storeId,
        themeId:      THEME_ID,
        pageId:       PAGE_ID,
        sectionDefId: sec.sectionDefId,
        label:        sec.label,
        settings:     sec.settings as any,
        sortOrder:    sec.sortOrder,
        isVisible:    sec.isVisible,
        isDraft:      true,
      },
    });

    // Create blocks
    for (const [bi, blk] of sec.blocks.entries()) {
      await prisma.themePageBlock.create({
        data: {
          storeId,
          themeId:   THEME_ID,
          sectionId: created.id,
          type:      blk.type,
          settings:  blk.settings as any,
          sortOrder: (bi + 1) * 1.0,
          isVisible: true,
          isDraft:   true,
        },
      });
    }

    console.log(`  ✓ Created: ${sec.sectionDefId} — "${sec.label}"`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  eCraftIndia Homepage Builder');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('═'.repeat(60) + '\n');

  // Find target store
  const store = STORE_ID
    ? await prisma.store.findUnique({ where: { id: STORE_ID } })
    : await prisma.store.findFirst({ orderBy: { createdAt: 'asc' } });

  if (!store) { console.error('No store found. Create a store first.'); return; }
  console.log(`Store: "${store.name}" (${store.id})\n`);

  console.log('Step 1: Creating collections…');
  const colIds = await ensureCollections(store.id);
  console.log(`  → ${Object.keys(colIds).length} collections ready\n`);

  console.log('Step 2: Creating products…');
  await ensureProducts(store.id, colIds);
  console.log('');

  console.log('Step 3: Building homepage sections…');
  const sections = buildSections(colIds);
  await saveSections(store.id, sections);
  console.log('');

  console.log('─'.repeat(60));
  console.log(`✅ Done! ${sections.length} sections created.`);
  console.log('');
  console.log('To view:');
  console.log('  1. Open the editor: http://localhost:8080/admin');
  console.log('  2. Click "Theme Editor"');
  console.log('  3. The homepage should show the eCraftIndia layout');
  console.log('  4. Click "Preview" to open in a new tab');
  console.log('');
  if (DRY_RUN) console.log('  (Dry run — nothing was written to DB)');
}

main()
  .catch((e) => { console.error('Build failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
