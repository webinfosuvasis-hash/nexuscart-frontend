/**
 * Backfill: ThemePageSection + ThemePageBlock → PageDocument (v2 architecture)
 *
 * Phase 0 → Phase 1 transition script.
 * Run after `phase0_universal_architecture_v2` migration is applied.
 *
 * What it does (idempotent — safe to re-run):
 *   For every (store, activeTheme, pageId, isDraft) combination:
 *     1. Load ThemePageSection rows + embedded ThemePageBlock rows
 *     2. Transform to PageDocument via the golden-fixture-tested transform
 *     3. Upsert into page_documents table
 *     4. Rebuild node_refs for each document
 *
 * What it does NOT do:
 *   - Modify any existing ThemePageSection or ThemePageBlock rows
 *   - Change any existing app behaviour (feature flag still off)
 *   - Drop any tables
 *
 * Usage:
 *   npx ts-node --transpile-only prisma/scripts/backfill-sections-to-documents.ts
 *
 * Options (env vars):
 *   BACKFILL_STORE_ID=xxx  — limit to a single store (for testing)
 *   BACKFILL_DRY_RUN=true  — log what would be done, write nothing
 */

import { PrismaClient, ConfigStatus, DocScope, RefType } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  transformSectionsToPageDocument,
} from '../../src/modules/content/transforms/page-section-to-document';
import type { RawSection, RawBlock, Node } from '../../src/modules/content/transforms/types';

const prisma   = new PrismaClient();
const DRY_RUN  = process.env.BACKFILL_DRY_RUN === 'true';
const STORE_ID = process.env.BACKFILL_STORE_ID;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toRawBlock(b: any): RawBlock {
  return {
    id:        b.id,
    type:      b.type,
    settings:  (b.settings as Record<string, unknown>) ?? {},
    sortOrder: Number(b.sortOrder ?? 0),
    isVisible: b.isVisible ?? true,
  };
}

function toRawSection(s: any): RawSection {
  return {
    id:           s.id,
    sectionDefId: s.sectionDefId,
    label:        s.label ?? null,
    settings:     (s.settings as Record<string, unknown>) ?? {},
    sortOrder:    Number(s.sortOrder ?? 0),
    isVisible:    s.isVisible ?? true,
    isDraft:      s.isDraft ?? true,
    blocks:       (s.blocks ?? []).map(toRawBlock),
  };
}

// ─── Node-ref collector (same logic as NodeRefService, standalone for script) ──

const COLLECTION_KEYS = ['collectionId', 'collection', 'collectionHandle'];
const PRODUCT_KEYS    = ['productId', 'product'];
const MENU_KEYS       = ['menuHandle', 'menu', 'menuId'];

function collectRefs(
  node:         Node,
  path:         string,
  storeId:      string,
  documentId:   string,
  documentType: DocScope,
  ownerKey:     string,
  status:       ConfigStatus,
): object[] {
  const rows: object[] = [];
  const currentPath = path ? `${path}/${node.id}` : node.id;
  const makeRef = (refType: RefType, refId: string) => ({
    storeId, documentId, documentType, ownerKey, status, refType, refId, nodePath: currentPath,
  });

  rows.push(makeRef(RefType.COMPONENT, node.type));

  if (node.symbolRef?.handle) rows.push(makeRef(RefType.SYMBOL, node.symbolRef.handle));

  const s = node.settings;
  if (s && typeof s === 'object') {
    for (const k of COLLECTION_KEYS) if (s[k] && typeof s[k] === 'string') rows.push(makeRef(RefType.COLLECTION, s[k] as string));
    for (const k of PRODUCT_KEYS)    if (s[k] && typeof s[k] === 'string') rows.push(makeRef(RefType.PRODUCT,    s[k] as string));
    for (const k of MENU_KEYS)       if (s[k] && typeof s[k] === 'string') rows.push(makeRef(RefType.MENU,       s[k] as string));
  }

  for (const child of node.children ?? []) {
    rows.push(...collectRefs(child, currentPath, storeId, documentId, documentType, ownerKey, status));
  }
  return rows;
}

// ─── Per-page backfill ────────────────────────────────────────────────────────

async function backfillPage(
  storeId:  string,
  themeId:  string,
  pageId:   string,
  isDraft:  boolean,
): Promise<{ created: boolean; sections: number }> {
  // Load sections with blocks for this store+theme+page+status
  const rawSections = await prisma.themePageSection.findMany({
    where: {
      storeId,
      pageId,
      isDraft,
      OR: [{ themeId }, { themeId: null }, { themeId: 'default' }],
    },
    include: {
      blocks: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { sortOrder: 'asc' },
  });

  if (rawSections.length === 0) return { created: false, sections: 0 };

  const sections = rawSections.map(toRawSection);
  const status   = isDraft ? ConfigStatus.DRAFT : ConfigStatus.PUBLISHED;
  const docData  = transformSectionsToPageDocument(storeId, themeId, pageId, sections, status);

  if (DRY_RUN) {
    console.log(`    [DRY RUN] Would upsert PageDocument (${status}) with ${sections.length} sections`);
    return { created: true, sections: sections.length };
  }

  // Upsert the PageDocument
  const doc = await prisma.pageDocument.upsert({
    where: {
      storeId_themeId_ownerKey_status: { storeId, themeId, ownerKey: pageId, status },
    },
    create: {
      storeId,
      themeId,
      scope:         DocScope.PAGE,
      ownerKey:      pageId,
      status,
      version:       1,
      schemaVersion: 1,
      tree:          docData.tree as any,
      seo:           null,
      settings:      { contextType: 'none' } as any,
    },
    update: {
      // Re-run = update tree (idempotent)
      tree:    docData.tree as any,
      version: { increment: 1 },
    },
  });

  // Rebuild node_refs for this document
  await prisma.nodeRef.deleteMany({ where: { documentId: doc.id, status } });

  const refs = collectRefs(docData.tree, '', storeId, doc.id, DocScope.PAGE, pageId, status);
  if (refs.length > 0) {
    await prisma.nodeRef.createMany({ data: refs as any[], skipDuplicates: true });
  }

  return { created: true, sections: sections.length };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  Backfill: ThemePageSection → PageDocument');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`${'═'.repeat(60)}\n`);

  // Find all stores to process
  const stores = await prisma.store.findMany({
    where:  STORE_ID ? { id: STORE_ID } : { status: { not: 'SUSPENDED' } },
    select: { id: true, name: true },
    orderBy:{ createdAt: 'asc' },
  });

  if (stores.length === 0) {
    console.log('No stores found. Done.');
    return;
  }

  console.log(`Found ${stores.length} store(s) to process.\n`);

  let totalDocs    = 0;
  let totalSections = 0;

  for (const store of stores) {
    console.log(`Store: "${store.name}" (${store.id})`);

    // Resolve active theme
    const activeTheme = await prisma.storeTheme.findFirst({
      where:   { storeId: store.id, isActive: true },
      select:  { themeId: true },
    });

    const themeId = activeTheme?.themeId ?? 'default';
    console.log(`  Theme: ${themeId}`);

    // Find all distinct pageIds for this store
    const pageRows = await prisma.themePageSection.findMany({
      where:   {
        storeId: store.id,
        OR: [{ themeId }, { themeId: null }, { themeId: 'default' }],
      },
      select:  { pageId: true, isDraft: true },
      distinct: ['pageId', 'isDraft'],
    });

    if (pageRows.length === 0) {
      console.log(`  No sections found — skipping.\n`);
      continue;
    }

    // Group by (pageId, isDraft) uniquely
    const combos = new Map<string, { pageId: string; isDraft: boolean }>();
    for (const row of pageRows) {
      const key = `${row.pageId}:${row.isDraft}`;
      if (!combos.has(key)) combos.set(key, { pageId: row.pageId, isDraft: row.isDraft });
    }

    console.log(`  Pages to backfill: ${[...new Set(pageRows.map(r => r.pageId))].join(', ')}`);

    for (const { pageId, isDraft } of combos.values()) {
      const statusLabel = isDraft ? 'DRAFT' : 'PUBLISHED';
      const result = await backfillPage(store.id, themeId, pageId, isDraft);

      if (result.created) {
        console.log(`  ✓ ${pageId} (${statusLabel}): ${result.sections} sections → PageDocument`);
        totalDocs++;
        totalSections += result.sections;
      }
    }
    console.log('');
  }

  console.log(`${'─'.repeat(60)}`);
  console.log(`Backfill complete.`);
  console.log(`  Documents created/updated: ${totalDocs}`);
  console.log(`  Total sections migrated:   ${totalSections}`);
  if (DRY_RUN) console.log(`  (Dry run — nothing was written to DB)`);
  console.log('');
}

main()
  .catch((err) => { console.error('Backfill failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
