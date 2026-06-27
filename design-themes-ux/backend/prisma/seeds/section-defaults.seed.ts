/**
 * Seed: SectionDefinition.allowedBlockTypes + SectionDefinition.defaultBlocks
 *
 * Sprint 4.5 — Architecture Remediation
 * Run AFTER block-definitions.seed.ts
 * Run with: npx ts-node prisma/seeds/section-defaults.seed.ts
 *
 * Idempotent — safe to re-run.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SECTION_DEFAULTS: Array<{
  id:                string;
  allowedBlockTypes: string[];
  defaultBlocks:     Array<{ type: string; settings: Record<string, any>; sortOrder: number }>;
}> = [
  {
    id: 'announcement_bar',
    allowedBlockTypes: ['announcement'],
    defaultBlocks: [
      { type: 'announcement', settings: { text: 'Welcome to our store', font: 'subheading', fontSize: 12, textColor: '#ffffff' }, sortOrder: 1.0 },
    ],
  },
  {
    id: 'header',
    allowedBlockTypes: ['logo', 'menu', 'search', 'cart', 'account', 'spacer', 'custom_liquid'],
    defaultBlocks: [],  // header blocks are user-configured, no auto-seed
  },
  {
    id: 'hero',
    allowedBlockTypes: ['heading', 'paragraph', 'button', 'image', 'video'],
    defaultBlocks: [
      { type: 'heading',   settings: { text: 'Browse our latest products', typographyPreset: 'h1', textColor: '#ffffff' }, sortOrder: 1.0 },
      { type: 'button',    settings: { label: 'Shop all', link: '/collections', style: 'outline', size: 'lg', borderRadius: 'rounded' }, sortOrder: 2.0 },
    ],
  },
  {
    id: 'featured_collection',
    allowedBlockTypes: ['collection_title', 'view_all_button', 'product_card'],
    defaultBlocks: [
      { type: 'collection_title', settings: { text: 'Products' }, sortOrder: 1.0 },
      { type: 'view_all_button',  settings: { label: 'View all' }, sortOrder: 2.0 },
      { type: 'product_card',     settings: { showQuickAdd: true, imageRatio: '1/1', hoverEffect: 'zoom' }, sortOrder: 3.0 },
    ],
  },
  {
    id: 'product_grid',
    allowedBlockTypes: ['collection_title', 'view_all_button', 'product_card'],
    defaultBlocks: [
      { type: 'collection_title', settings: { text: 'Products' }, sortOrder: 1.0 },
      { type: 'product_card',     settings: { showQuickAdd: true, imageRatio: '1/1' }, sortOrder: 2.0 },
    ],
  },
  {
    id: 'collection_grid',
    allowedBlockTypes: ['collection_title', 'view_all_button'],
    defaultBlocks: [
      { type: 'collection_title', settings: { text: 'Shop by collection' }, sortOrder: 1.0 },
    ],
  },
  {
    id: 'footer',
    allowedBlockTypes: ['copyright', 'custom_liquid'],
    defaultBlocks: [
      { type: 'copyright', settings: { text: '© {{year}} {{store_name}}. All rights reserved.', textColor: '#9ca3af' }, sortOrder: 1.0 },
    ],
  },
  {
    id: 'rich_text',
    allowedBlockTypes: ['heading', 'paragraph', 'button'],
    defaultBlocks: [
      { type: 'heading',   settings: { text: 'Heading', typographyPreset: 'h2', textColor: '#111827' }, sortOrder: 1.0 },
      { type: 'paragraph', settings: { text: 'Share information about your brand with your customers.', textColor: '#374151' }, sortOrder: 2.0 },
    ],
  },
  {
    id: 'newsletter',
    allowedBlockTypes: ['heading', 'paragraph'],
    defaultBlocks: [
      { type: 'heading',   settings: { text: 'Subscribe to our emails', typographyPreset: 'h2', textColor: '#111827' }, sortOrder: 1.0 },
      { type: 'paragraph', settings: { text: 'Be the first to know about new collections and exclusive offers.', textColor: '#374151' }, sortOrder: 2.0 },
    ],
  },
];

async function main() {
  console.log('🌱 Updating SectionDefinition.allowedBlockTypes and defaultBlocks…');

  let updated = 0;
  for (const row of SECTION_DEFAULTS) {
    const existing = await prisma.sectionDefinition.findUnique({ where: { id: row.id } });
    if (!existing) {
      console.log(`  ⚠ section "${row.id}" not found in section_definitions — skipped`);
      continue;
    }

    await prisma.sectionDefinition.update({
      where: { id: row.id },
      data: {
        allowedBlockTypes: row.allowedBlockTypes,
        defaultBlocks:     row.defaultBlocks,
      },
    });
    updated++;
    console.log(`  ✓ ${row.id} (${row.allowedBlockTypes.length} allowed block types, ${row.defaultBlocks.length} default blocks)`);
  }

  console.log(`\n✅ Updated ${updated} section definitions.`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(async () => prisma.$disconnect());
