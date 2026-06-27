/**
 * Backfill: ThemePageSection.themeId
 *
 * Sprint 4.5 — Architecture Remediation
 * Run AFTER prisma migrate dev has added the nullable themeId column.
 * Run with: npx ts-node prisma/scripts/backfill-page-section-theme-id.ts
 *
 * Strategy:
 *   For each ThemePageSection row WHERE themeId IS NULL:
 *     → Resolve storeId's active theme from store_themes
 *     → Set themeId = activeTheme.themeId
 *     → If no active theme: set themeId = 'default'
 *
 * Idempotent — WHERE themeId IS NULL skips already-backfilled rows.
 * Safe to re-run.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Backfilling ThemePageSection.themeId…');

  // 1. Find all rows that still need themeId
  const orphaned = await prisma.themePageSection.findMany({
    where:  { themeId: null },
    select: { id: true, storeId: true },
  });

  if (orphaned.length === 0) {
    console.log('✅ No rows need backfilling — all ThemePageSection rows already have themeId.');
    return;
  }

  console.log(`  Found ${orphaned.length} rows to backfill.`);

  // 2. Build a map storeId → activeThemeId to avoid N+1 per row
  const storeIds  = [...new Set(orphaned.map((r) => r.storeId))];
  const themeMap  = new Map<string, string>();

  for (const storeId of storeIds) {
    const active = await prisma.storeTheme.findFirst({
      where:  { storeId, isActive: true },
      select: { themeId: true },
    });
    themeMap.set(storeId, active?.themeId ?? 'default');
  }

  // 3. Update in batches of 100
  let updated = 0;
  const BATCH_SIZE = 100;

  for (let i = 0; i < orphaned.length; i += BATCH_SIZE) {
    const batch = orphaned.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map((row) =>
        prisma.themePageSection.update({
          where: { id: row.id },
          data:  { themeId: themeMap.get(row.storeId) ?? 'default' },
        }),
      ),
    );

    updated += batch.length;
    console.log(`  Processed ${updated}/${orphaned.length}…`);
  }

  // 4. Verification
  const remaining = await prisma.themePageSection.count({ where: { themeId: null } });
  if (remaining > 0) {
    console.error(`\n⛔ ${remaining} rows still have themeId = null. Manual review required.`);
    process.exit(1);
  }

  console.log(`\n✅ Backfilled ${updated} ThemePageSection rows with themeId.`);
  console.log('   You may now apply migration to set themeId NOT NULL.');
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(async () => prisma.$disconnect());
