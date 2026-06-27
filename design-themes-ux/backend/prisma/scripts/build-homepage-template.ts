/**
 * build-homepage-template.ts
 *
 * Universal ecommerce homepage template builder.
 *
 * ARCHITECTURAL RULES:
 *   - NO hardcoded collection names, product names, or brand names
 *   - NO industry-specific categories (no "Sarees", "Electronics", "Fashion")
 *   - NO site-specific section labels
 *   - ONLY generic section types with {{placeholder}} settings
 *   - Merchant fills ALL content through the admin panel
 *
 * This script places structure only. Content = merchant's job.
 *
 * Works for: Fashion, Furniture, Electronics, Grocery, Jewelry,
 *            Cosmetics, Books, Pet Store, or any future vertical.
 *
 * Usage:
 *   npx ts-node --transpile-only prisma/scripts/build-homepage-template.ts
 *
 * Options:
 *   STORE_ID=xxx    target store (default: first store)
 *   DRY_RUN=true    log sections without writing
 *   WIPE=true       delete existing sections first (default: true)
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const DRY_RUN  = process.env.DRY_RUN  === 'true';
const WIPE     = process.env.WIPE     !== 'false';
const STORE_ID = process.env.STORE_ID ?? '';
const PAGE_ID  = 'home';

// ─── Section builder ──────────────────────────────────────────────────────────

let sortIdx = 0;
const next = () => ++sortIdx * 10.0;

function section(
  type:     string,
  name:     string,
  settings: Record<string, unknown>,
  blocks:   { type: string; settings: Record<string, unknown> }[] = [],
) {
  return { sectionDefId: type, label: name, settings, blocks, sortOrder: next(), isVisible: true };
}

// ─── Universal homepage sections ─────────────────────────────────────────────
//
// Every section uses {{placeholder}} values.
// The merchant selects real content in the Theme Editor.

function buildUniversalHomepage() {
  return [

    // ── 1. Announcement Bar ────────────────────────────────────────────────────
    // Merchant sets: promotional text, link, background color
    section('announcement_bar', 'Announcement Bar', {
      text:            '',   // ← merchant fills: "Free shipping on orders over $50"
      linkLabel:       '',   // ← merchant fills: "Shop Now"
      linkUrl:         '',   // ← merchant fills: "/collections/all"
      background:      '#000000',
      textColor:       '#ffffff',
      showOnMobile:    true,
      paddingVertical: 8,
    }, [
      {
        type:     'announcement',
        settings: {
          text:     '',    // ← merchant fills via Content tab
          fontSize: 13,
        },
      },
    ]),

    // ── 2. Hero Image Banner ───────────────────────────────────────────────────
    // Merchant sets: image, heading, subheading, CTA label + URL
    section('image_banner', 'Hero Banner', {
      heading:          '',        // ← merchant fills: their brand headline
      subheading:       '',        // ← merchant fills: their brand tagline
      ctaLabel:         '',        // ← merchant fills: "Shop Now" / "Explore" / etc.
      ctaUrl:           '/collections/all',
      image:            '',        // ← merchant uploads hero image
      mobileImage:      '',        // ← merchant uploads mobile crop
      overlayOpacity:   30,
      contentAlign:     'center',  // ← merchant sets: left/center/right
      height:           'large',   // ← merchant sets: small/medium/large/full
      backgroundColor:  '#f5f5f5',
    }, [
      { type: 'heading',   settings: { text: '' } },
      { type: 'paragraph', settings: { text: '' } },
      { type: 'button',    settings: { label: '', link: '/collections/all', style: 'primary' } },
    ]),

    // ── 3. Collection Circles — Row 1 ─────────────────────────────────────────
    // Merchant selects: which collections to show, their images
    // Scrollable horizontal row of circular thumbnails
    section('collection_circles', 'Category Navigation', {
      circleSize:    100,
      showLabels:    true,
      paddingTop:    32,
      paddingBottom: 32,
      items: [],   // ← merchant adds items via Binding tab: each item = { collectionId, label }
    }),

    // ── 4. Product Mosaic Grid ─────────────────────────────────────────────────
    // Merchant selects: collections/products to feature in asymmetric grid
    section('product_mosaic', 'Featured Categories', {
      paddingTop:    16,
      paddingBottom: 24,
      items: [],   // ← merchant adds: [{ collectionId, label, featured: bool }]
    }),

    // ── 5. Editorial Banner ────────────────────────────────────────────────────
    // Decorative section divider with configurable text
    section('editorial_banner', 'Editorial Banner', {
      scriptText:    '',   // ← merchant fills: "New Arrivals" / "Trending Now" / etc.
      subtitle:      '',   // ← merchant fills: "Browse the latest additions"
      paddingTop:    20,
      paddingBottom: 20,
    }),

    // ── 6. Featured Collection — Slot A ───────────────────────────────────────
    // Merchant selects: collection to feature, number of products, columns
    section('featured_collection', 'Featured Collection', {
      title:          '',   // ← merchant fills: section heading (or leave blank to use collection name)
      collectionId:   '',   // ← merchant selects from collection picker
      productsToShow: 5,
      columnsDesktop: '5',
      columnsMobile:  '2',
      showViewAll:    true,
      viewAllLabel:   'View All',
      showAddToCart:  true,
    }, [
      { type: 'collection_title', settings: { text: '' } },          // ← merchant fills
      { type: 'view_all_button',  settings: { label: 'View All', link: '' } },
      { type: 'product_card',     settings: { showRating: true, showQuickAdd: true, imageRatio: '1/1' } },
    ]),

    // ── 7. Featured Collection — Slot B ───────────────────────────────────────
    // Second independent collection slot
    section('featured_collection', 'Featured Collection', {
      title:          '',
      collectionId:   '',
      productsToShow: 5,
      columnsDesktop: '5',
      columnsMobile:  '2',
      showViewAll:    true,
      viewAllLabel:   'View All',
      showAddToCart:  true,
    }, [
      { type: 'collection_title', settings: { text: '' } },
      { type: 'view_all_button',  settings: { label: 'View All', link: '' } },
      { type: 'product_card',     settings: { showRating: true, showQuickAdd: true, imageRatio: '1/1' } },
    ]),

    // ── 8. Collection Circles — Row 2 ─────────────────────────────────────────
    // Second navigation row (different categories from Row 1)
    section('collection_circles', 'Category Navigation 2', {
      circleSize:    100,
      showLabels:    true,
      paddingTop:    24,
      paddingBottom: 24,
      items: [],   // ← merchant adds items
    }),

    // ── 9. Featured Product Mosaic (Showcase) ──────────────────────────────────
    // Editorial large-format product showcase
    section('product_mosaic', 'Product Showcase', {
      paddingTop:    16,
      paddingBottom: 24,
      items: [],
    }),

    // ── 10. Featured Collection — Slot C ──────────────────────────────────────
    // Third collection slot (2×2 or 4-col grid)
    section('featured_collection', 'Featured Collection', {
      title:          '',
      collectionId:   '',
      productsToShow: 4,
      columnsDesktop: '4',
      columnsMobile:  '2',
      showViewAll:    true,
    }, [
      { type: 'collection_title', settings: { text: '' } },
      { type: 'view_all_button',  settings: { label: 'View All', link: '' } },
      { type: 'product_card',     settings: { showRating: false, showQuickAdd: false, imageRatio: '1/1' } },
    ]),

    // ── 11. Rich Text / Brand Story ────────────────────────────────────────────
    // Merchant writes: brand narrative, mission statement, or promotional copy
    section('brand_story', 'Brand Story', {
      title: '',   // ← merchant fills: "About [Brand Name]"
      body:  '',   // ← merchant fills: brand description
      paddingTop:    32,
      paddingBottom: 32,
    }),

    // ── 12. Trust Badges ──────────────────────────────────────────────────────
    // Merchant configures: icon, title, description per badge
    // Default icons are generic — merchant customises text
    section('trust_badges_bar', 'Trust Badges', {
      paddingTop:    20,
      paddingBottom: 20,
      columns: 4,
      badges: [
        { icon: 'shield',   title: '', description: '' },  // ← e.g. "Secure Checkout"
        { icon: 'returns',  title: '', description: '' },  // ← e.g. "Easy Returns"
        { icon: 'shipping', title: '', description: '' },  // ← e.g. "Free Shipping"
        { icon: 'check',    title: '', description: '' },  // ← e.g. "Authentic Products"
      ],
    }),

    // ── 13. Newsletter ────────────────────────────────────────────────────────
    // Merchant sets: heading, subheading, button label, incentive text
    section('newsletter', 'Newsletter Signup', {
      paddingTop:    48,
      paddingBottom: 48,
    }, [
      { type: 'heading',   settings: { text: '' } },   // ← merchant fills
      { type: 'paragraph', settings: { text: '' } },   // ← merchant fills
    ]),

  ]; // end sections
}

// ─── Ensure SectionDefinitions exist ─────────────────────────────────────────

const GENERIC_DEFS = [
  'announcement_bar', 'image_banner', 'collection_circles',
  'product_mosaic', 'editorial_banner', 'featured_collection',
  'brand_story', 'trust_badges_bar', 'newsletter', 'countdown_timer',
  'rich_text', 'image_with_text', 'multicolumn', 'testimonials',
  'logo_list', 'faq', 'video', 'contact_form', 'image_gallery',
];

async function ensureSectionDefs(): Promise<void> {
  for (const id of GENERIC_DEFS) {
    await prisma.sectionDefinition.upsert({
      where:  { id },
      create: {
        id,
        name:             id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        category:         'CUSTOM',
        tier:             'FREE',
        settingsSchema:   [],
        compatibleThemes: ['*'],
        allowedBlockTypes:['*'],
        isBuiltIn:        false,
        isActive:         true,
        version:          '1.0.0',
      },
      update: { isActive: true },
    });
  }
}

// ─── Write sections to DB ─────────────────────────────────────────────────────

async function saveSections(
  storeId:  string,
  sections: ReturnType<typeof buildUniversalHomepage>,
): Promise<void> {
  if (WIPE && !DRY_RUN) {
    const del = await prisma.themePageSection.deleteMany({
      where: { storeId, pageId: PAGE_ID },
    });
    console.log(`  ✓ Wiped ${del.count} existing home sections`);
  }

  for (const sec of sections) {
    if (DRY_RUN) {
      console.log(`  [DRY] ${sec.sectionDefId} — "${sec.label}"`);
      continue;
    }

    const created = await prisma.themePageSection.create({
      data: {
        storeId,
        themeId:      null,           // null = works with any theme
        pageId:       PAGE_ID,
        sectionDefId: sec.sectionDefId,
        label:        sec.label,
        settings:     sec.settings as any,
        sortOrder:    sec.sortOrder,
        isVisible:    sec.isVisible,
        isDraft:      true,
      },
    });

    for (const [bi, blk] of sec.blocks.entries()) {
      await prisma.themePageBlock.create({
        data: {
          storeId,
          themeId:   null,
          sectionId: created.id,
          type:      blk.type,
          settings:  blk.settings as any,
          sortOrder: (bi + 1) * 1.0,
          isVisible: true,
          isDraft:   true,
        },
      });
    }

    console.log(`  ✓ ${sec.sectionDefId.padEnd(22)} — "${sec.label}"`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(62));
  console.log('  Universal Ecommerce Homepage Builder');
  console.log('  Works for: any vertical, any industry, any brand');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log('═'.repeat(62) + '\n');

  const store = STORE_ID
    ? await prisma.store.findUnique({ where: { id: STORE_ID } })
    : await prisma.store.findFirst({ orderBy: { createdAt: 'asc' } });

  if (!store) { console.error('No store found.'); return; }
  console.log(`Store: "${store.name}" (${store.id})\n`);

  console.log('Step 1: Ensuring generic section definitions…');
  await ensureSectionDefs();
  console.log(`  ✓ ${GENERIC_DEFS.length} section types registered\n`);

  console.log('Step 2: Building universal homepage template…');
  const sections = buildUniversalHomepage();
  await saveSections(store.id, sections);

  console.log('\n' + '─'.repeat(62));
  console.log(`✅ Done — ${sections.length} generic sections created.`);
  console.log(`\nAll sections have empty content.`);
  console.log(`Merchant fills content in the Theme Editor:`);
  console.log(`  • Announcement Bar  — add promo text`);
  console.log(`  • Hero Banner       — upload image + write headline`);
  console.log(`  • Category Circles  — bind to your collections`);
  console.log(`  • Featured Cols A/B/C — select collection from picker`);
  console.log(`  • Trust Badges      — add your return/shipping policy`);
  console.log(`  • Newsletter        — write your email capture copy`);
  console.log('');
}

main()
  .catch(e => { console.error('Failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
