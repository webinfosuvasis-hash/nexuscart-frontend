/**
 * Seed: page-sections — convert MOCK_PAGE_DOC structure into real DB records
 *
 * Phase 1 of Preview Fix.
 * Run with: npx ts-node --transpile-only prisma/seeds/page-sections.seed.ts
 *
 * Idempotent: skips stores that already have template sections for 'home'.
 * Creates ThemePageSection + ThemePageBlock rows for:
 *   • hero
 *   • featured_collection
 *   • newsletter
 *
 * Header / Footer are NOT seeded here — they live in header_configs / footer_configs
 * which are auto-created by HeaderConfigService / FooterConfigService on first request.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Page structure mirroring MOCK_PAGE_DOC.sections ──────────────────────────

interface BlockSeed {
  type:      string;
  settings:  Record<string, any>;
  sortOrder: number;
}

interface SectionSeed {
  sectionDefId: string;
  label:        string;
  settings:     Record<string, any>;
  sortOrder:    number;
  blocks:       BlockSeed[];
}

const TEMPLATE_SECTIONS: SectionSeed[] = [
  {
    sectionDefId: 'hero',
    label:        'Hero',
    sortOrder:    1.0,
    settings: {
      backgroundImage:  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1400&q=80',
      backgroundColor:  '#1a1a2e',
      overlayOpacity:   50,
      overlayColor:     '#000000',
      height:           'md',
      contentAlignment: 'center',
      contentWidth:     'normal',
    },
    blocks: [
      {
        type:      'heading',
        sortOrder: 1.0,
        settings:  { text: 'Browse our latest products', typographyPreset: 'h1', textColor: '#ffffff', width: 'fit', maxWidth: 'normal' },
      },
      {
        type:      'button',
        sortOrder: 2.0,
        settings:  { label: 'Shop all', link: '/collections', style: 'outline', size: 'lg', borderRadius: 'rounded' },
      },
    ],
  },
  {
    sectionDefId: 'featured_collection',
    label:        'Featured collection',
    sortOrder:    2.0,
    settings: {
      productsToShow: 4,
      columnsDesktop: '4',
      columnsMobile:  '2',
      showViewAll:    true,
    },
    blocks: [
      {
        type:      'collection_title',
        sortOrder: 1.0,
        settings:  { text: 'Products', alignment: 'left', textColor: '#111827' },
      },
      {
        type:      'view_all_button',
        sortOrder: 2.0,
        settings:  { label: 'View all', link: '/collections', style: 'link' },
      },
      {
        type:      'product_card',
        sortOrder: 3.0,
        settings:  { showVendor: false, showRating: true, showQuickAdd: true, imageRatio: '1/1', hoverEffect: 'zoom' },
      },
    ],
  },
  {
    sectionDefId: 'newsletter',
    label:        'Newsletter',
    sortOrder:    3.0,
    settings: {
      placeholder:  'Email address',
      buttonLabel:  'Subscribe',
      successMsg:   'Thanks for subscribing!',
    },
    blocks: [
      {
        type:      'heading',
        sortOrder: 1.0,
        settings:  { text: 'Subscribe to our emails', typographyPreset: 'h2', textColor: '#111827' },
      },
      {
        type:      'paragraph',
        sortOrder: 2.0,
        settings:  { text: 'Be the first to know about new collections and exclusive offers.', textColor: '#374151' },
      },
    ],
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding page-sections (template sections for "home" page)…\n');

  // Find all active stores
  const stores = await prisma.store.findMany({
    where:   { status: { not: 'SUSPENDED' } },
    select:  { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  if (stores.length === 0) {
    console.log('⚠  No stores found. Register a store first, then re-run this seed.');
    return;
  }

  console.log(`Found ${stores.length} store(s).\n`);

  for (const store of stores) {
    console.log(`  Store: "${store.name}" (${store.id})`);

    // Resolve active theme for this store
    const activeTheme = await prisma.storeTheme.findFirst({
      where:  { storeId: store.id, isActive: true },
      select: { themeId: true },
    });
    const themeId = activeTheme?.themeId ?? 'default';
    console.log(`  Theme: ${themeId}`);

    // Guard: skip if template sections already exist for this store/theme/home
    const existingCount = await prisma.themePageSection.count({
      where: { storeId: store.id, pageId: 'home' },
    });

    if (existingCount > 0) {
      console.log(`  ✓ Already has ${existingCount} section(s) for 'home' — skipped.\n`);
      continue;
    }

    // Create template sections + blocks in a transaction
    let sectionsCreated = 0;
    let blocksCreated   = 0;

    await prisma.$transaction(async (tx) => {
      for (const sectionDef of TEMPLATE_SECTIONS) {
        const section = await tx.themePageSection.create({
          data: {
            storeId:      store.id,
            themeId,
            pageId:       'home',
            sectionDefId: sectionDef.sectionDefId,
            label:        sectionDef.label,
            settings:     sectionDef.settings,
            sortOrder:    sectionDef.sortOrder,
            isVisible:    true,
            isDraft:      true,
          },
        });
        sectionsCreated++;

        // Create blocks for this section
        if (sectionDef.blocks.length > 0) {
          await tx.themePageBlock.createMany({
            data: sectionDef.blocks.map((b) => ({
              storeId:   store.id,
              themeId,
              sectionId: section.id,
              type:      b.type,
              settings:  b.settings,
              sortOrder: b.sortOrder,
              isVisible: true,
              isDraft:   true,
            })),
          });
          blocksCreated += sectionDef.blocks.length;
        }

        console.log(`    + ${sectionDef.sectionDefId} → ${sectionDef.blocks.length} block(s)`);
      }
    });

    // Also ensure isDraft=false (published) copies exist so preview can show published data too
    const draftSections = await prisma.themePageSection.findMany({
      where:   { storeId: store.id, themeId, pageId: 'home', isDraft: true },
      include: { blocks: true },
    });

    for (const ds of draftSections) {
      const { id: _id, isDraft: _d, createdAt: _c, updatedAt: _u, blocks, ...rest } = ds as any;
      const pub = await prisma.themePageSection.upsert({
        where:  { id: `pub_${ds.id}` },
        create: { ...rest, id: `pub_${ds.id}`, isDraft: false },
        update: { settings: rest.settings, isVisible: rest.isVisible },
      }).catch(() => null);  // ignore if upsert fails (duplicate id edge case)
    }

    console.log(`  ✅ Created ${sectionsCreated} sections, ${blocksCreated} blocks for "${store.name}".\n`);
  }

  // Final count
  const total = await prisma.themePageSection.count();
  const totalBlocks = await prisma.themePageBlock.count();
  console.log(`\n✅ Done. theme_page_sections: ${total} rows, theme_page_blocks: ${totalBlocks} rows.`);
}

main()
  .catch((err) => { console.error('\n❌', err.message); process.exit(1); })
  .finally(async () => prisma.$disconnect());
