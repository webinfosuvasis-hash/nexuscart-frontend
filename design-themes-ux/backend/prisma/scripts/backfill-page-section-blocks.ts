/**
 * Backfill: ThemePageBlock default blocks for existing ThemePageSection rows
 *
 * Sprint 4.5.1
 * Run AFTER schema migration and block-definitions + section-defaults seeds.
 * Run with: npx ts-node prisma/scripts/backfill-page-section-blocks.ts
 *
 * Strategy:
 *   For each ThemePageSection that has zero ThemePageBlock rows:
 *     1. Load SectionDefinition.defaultBlocks JSON
 *     2. Create ThemePageBlock rows matching the section's isDraft and themeId
 *
 * Idempotent — sections that already have blocks are skipped.
 * Safe to re-run at any time.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface DefaultBlock {
  type:      string;
  settings:  Record<string, any>;
  sortOrder: number;
}

async function main() {
  console.log('🔄 Backfilling ThemePageBlock default blocks for existing sections…\n');

  // 1. Find all sections with zero blocks
  const sections = await prisma.themePageSection.findMany({
    where:   {},   // all sections
    select:  { id: true, storeId: true, themeId: true, sectionDefId: true, isDraft: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`  Found ${sections.length} total sections to inspect.`);

  // 2. Filter to those with no existing blocks
  const sectionIds     = sections.map((s) => s.id);
  const blockCounts    = await prisma.themePageBlock.groupBy({
    by:     ['sectionId'],
    where:  { sectionId: { in: sectionIds } },
    _count: { id: true },
  });

  const withBlocks = new Set(blockCounts.map((b) => b.sectionId));
  const needsBlocks = sections.filter((s) => !withBlocks.has(s.id));

  console.log(`  ${withBlocks.size} sections already have blocks — skipped.`);
  console.log(`  ${needsBlocks.length} sections need default blocks.\n`);

  if (needsBlocks.length === 0) {
    console.log('✅ No sections need block backfilling.');
    return;
  }

  // 3. Load SectionDefinition.defaultBlocks for unique sectionDefIds
  const uniqueDefIds = [...new Set(needsBlocks.map((s) => s.sectionDefId))];
  const defs = await prisma.sectionDefinition.findMany({
    where:  { id: { in: uniqueDefIds } },
    select: { id: true, defaultBlocks: true },
  });
  const defMap = new Map<string, DefaultBlock[]>(
    defs.map((d) => [d.id, ((d.defaultBlocks as unknown) as DefaultBlock[]) ?? []]),
  );

  // 4. Create blocks in batches
  let seeded   = 0;
  let skipped  = 0;
  const BATCH  = 50;

  for (let i = 0; i < needsBlocks.length; i += BATCH) {
    const batch = needsBlocks.slice(i, i + BATCH);

    for (const section of batch) {
      const defaultBlocks = defMap.get(section.sectionDefId) ?? [];
      if (defaultBlocks.length === 0) {
        skipped++;
        continue;
      }

      await prisma.themePageBlock.createMany({
        data: defaultBlocks.map((b) => ({
          storeId:   section.storeId,
          themeId:   section.themeId,
          sectionId: section.id,
          type:      b.type,
          settings:  (b.settings ?? {}) as any,
          sortOrder: b.sortOrder ?? 1.0,
          isVisible: true,
          isDraft:   section.isDraft,
        })),
        skipDuplicates: true,
      });
      seeded++;
    }

    const processed = Math.min(i + BATCH, needsBlocks.length);
    console.log(`  Processed ${processed}/${needsBlocks.length} sections…`);
  }

  // 5. Verify
  const totalBlocks = await prisma.themePageBlock.count();
  console.log(`\n✅ Backfill complete.`);
  console.log(`   Sections seeded:  ${seeded}`);
  console.log(`   Sections skipped (no defaultBlocks): ${skipped}`);
  console.log(`   Total ThemePageBlock rows now: ${totalBlocks}`);
}

main()
  .catch((err) => { console.error('\n❌ Backfill failed:', err); process.exit(1); })
  .finally(async () => prisma.$disconnect());
