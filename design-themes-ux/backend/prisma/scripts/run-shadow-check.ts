/**
 * Standalone shadow check runner.
 * Compares ThemePageSection (old model) vs PageDocument (new model) for all stores.
 *
 * Usage: npx ts-node --transpile-only prisma/scripts/run-shadow-check.ts
 */
import { PrismaClient, ConfigStatus } from '@prisma/client';
import {
  transformSectionsToPageDocument,
  transformDocumentToSections,
} from '../../src/modules/content/transforms/page-section-to-document';
import type { RawSection, RawBlock } from '../../src/modules/content/transforms/types';

const prisma = new PrismaClient();

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

async function checkStore(storeId: string, storeName: string) {
  const theme = await prisma.storeTheme.findFirst({
    where: { storeId, isActive: true }, select: { themeId: true },
  });
  const themeId = theme?.themeId ?? 'default';

  for (const isDraft of [true, false]) {
    const status = isDraft ? ConfigStatus.DRAFT : ConfigStatus.PUBLISHED;
    const label  = isDraft ? 'DRAFT' : 'PUBLISHED';

    const oldRows = await prisma.themePageSection.findMany({
      where: { storeId, pageId: 'home', isDraft, OR: [{ themeId }, { themeId: null }, { themeId: 'default' }] },
      include: { blocks: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });

    const docRow = await prisma.pageDocument.findUnique({
      where: { storeId_themeId_ownerKey_status: { storeId, themeId, ownerKey: 'home', status } },
    });

    if (!docRow) {
      console.log(`  ✗ home/${label}: no PageDocument found — run backfill first`);
      continue;
    }

    const oldSections: RawSection[] = oldRows.map(s => ({
      id: s.id, sectionDefId: s.sectionDefId, label: s.label ?? null,
      settings: (s.settings as any) ?? {}, sortOrder: Number(s.sortOrder),
      isVisible: s.isVisible, isDraft: s.isDraft,
      blocks: s.blocks.map((b): RawBlock => ({
        id: b.id, type: b.type, settings: (b.settings as any) ?? {},
        sortOrder: Number(b.sortOrder), isVisible: b.isVisible,
      })),
    }));

    const newSections = transformDocumentToSections({
      id: docRow.id, storeId, themeId, scope: 'PAGE' as any,
      ownerKey: 'home', status: status as any, version: docRow.version,
      schemaVersion: docRow.schemaVersion, tree: docRow.tree as any,
    });

    // Compare
    let diffs = 0;
    if (oldSections.length !== newSections.length) {
      console.log(`  ✗ home/${label}: section count old=${oldSections.length} new=${newSections.length}`);
      diffs++;
    }

    const sorted = [...oldSections].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
    for (let i = 0; i < sorted.length; i++) {
      const os = sorted[i];
      const ns = newSections[i];
      if (!ns) { console.log(`  ✗ home/${label}: missing section ${i} in new`); diffs++; continue; }
      if (os.id !== ns.id) { console.log(`  ✗ home/${label}: id mismatch old=${os.id} new=${ns.id}`); diffs++; }
      if (os.sectionDefId !== ns.sectionDefId) { console.log(`  ✗ home/${label}: type mismatch`); diffs++; }
      if (os.isVisible !== ns.isVisible) { console.log(`  ✗ home/${label}: visibility mismatch`); diffs++; }

      // Settings
      for (const [k, v] of Object.entries(os.settings)) {
        if (!deepEqual(v, ns.settings[k])) {
          console.log(`  ✗ home/${label}: settings.${k} mismatch in ${os.id}`);
          diffs++;
        }
      }

      // Blocks
      if (os.blocks.length !== ns.blocks.length) {
        console.log(`  ✗ home/${label}: block count mismatch in ${os.id}`);
        diffs++;
      }
      for (let j = 0; j < os.blocks.length; j++) {
        const ob = os.blocks[j];
        const nb = ns.blocks[j];
        if (!nb) continue;
        if (ob.id !== nb.id || ob.type !== nb.type) { console.log(`  ✗ home/${label}: block ${j} mismatch`); diffs++; }
        for (const [k, v] of Object.entries(ob.settings)) {
          if (!deepEqual(v, nb.settings[k])) { console.log(`  ✗ home/${label}: block settings.${k} mismatch`); diffs++; }
        }
      }
    }

    if (diffs === 0) {
      console.log(`  ✓ home/${label}: PARITY — ${oldSections.length} sections, ` +
        `${oldSections.reduce((n, s) => n + s.blocks.length, 0)} blocks — zero divergence`);
    } else {
      console.log(`  ✗ home/${label}: ${diffs} diff(s) — store not ready to flip`);
    }
  }
}

async function main() {
  console.log('\nShadow Render Parity Check\n' + '─'.repeat(50));
  const stores = await prisma.store.findMany({
    where: { status: { not: 'SUSPENDED' } },
    select: { id: true, name: true },
  });

  let allPass = true;
  for (const store of stores) {
    console.log(`\n${store.name} (${store.id})`);
    await checkStore(store.id, store.name);
  }

  console.log('\n' + '─'.repeat(50));
  console.log('Done.\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
