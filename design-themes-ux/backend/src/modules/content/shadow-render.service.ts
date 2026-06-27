import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigStatus }  from '@prisma/client';
import {
  transformSectionsToPageDocument,
  transformDocumentToSections,
} from './transforms/page-section-to-document';
import type { RawSection, RawBlock } from './transforms/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FieldDiff {
  field:    string;
  nodeId:   string;
  nodeType: string;
  old:      unknown;
  new:      unknown;
}

export interface ShadowRenderResult {
  storeId:      string;
  themeId:      string;
  ownerKey:     string;
  status:       'DRAFT' | 'PUBLISHED';
  checkedAt:    string;
  diverged:     boolean;
  // Counts
  oldSections:  number;
  newSections:  number;
  // Zero = parity; non-zero = migration flip must wait
  sectionCountDiff:  number;
  blockCountDiffs:   { sectionId: string; old: number; new: number }[];
  settingsDiffs:     FieldDiff[];
  missingInNew:      string[];   // sectionIds present in old, absent in new
  missingInOld:      string[];   // sectionIds present in new, absent in old (should be 0)
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * ShadowRenderService — Sprint 7 / Phase 1
 *
 * Compares the "old" model (ThemePageSection rows) against the "new" model
 * (PageDocument tree) for a given store+theme+page combination.
 *
 * At this stage the comparison is DATA-level (not visual). Visual comparison
 * (Playwright screenshot diff) is added in Sprint 10 after the NodeRenderer
 * is implemented (Sprint 11).
 *
 * Called:
 *   - Directly in backfill (post-check after writing a PageDocument)
 *   - Via /content/:storeId/:themeId/:ownerKey/shadow-check endpoint
 *   - Via a nightly batch job (Sprint 10) to check all stores before flip
 *
 * The parity gate: a store may only flip to ContentNode when
 *   shadowCheck returns diverged=false for BOTH its DRAFT and PUBLISHED pages.
 */
@Injectable()
export class ShadowRenderService {
  private readonly logger = new Logger(ShadowRenderService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(
    storeId:  string,
    themeId:  string,
    ownerKey: string,
    isDraft:  boolean,
  ): Promise<ShadowRenderResult> {
    const status = isDraft ? 'DRAFT' : 'PUBLISHED';
    const statusEnum = isDraft ? ConfigStatus.DRAFT : ConfigStatus.PUBLISHED;

    // ── Load OLD model (ThemePageSection + blocks) ──────────────────────────
    const oldSectionRows = await this.prisma.themePageSection.findMany({
      where: {
        storeId,
        pageId: ownerKey,
        isDraft,
        OR: [{ themeId }, { themeId: null }, { themeId: 'default' }],
      },
      include: { blocks: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });

    const oldSections: RawSection[] = oldSectionRows.map((s) => ({
      id:           s.id,
      sectionDefId: s.sectionDefId,
      label:        s.label ?? null,
      settings:     (s.settings as Record<string, unknown>) ?? {},
      sortOrder:    Number(s.sortOrder),
      isVisible:    s.isVisible,
      isDraft:      s.isDraft,
      blocks:       (s.blocks ?? []).map((b): RawBlock => ({
        id:        b.id,
        type:      b.type,
        settings:  (b.settings as Record<string, unknown>) ?? {},
        sortOrder: Number(b.sortOrder),
        isVisible: b.isVisible,
      })),
    }));

    // ── Load NEW model (PageDocument) ───────────────────────────────────────
    const docRow = await this.prisma.pageDocument.findUnique({
      where: {
        storeId_themeId_ownerKey_status: { storeId, themeId, ownerKey, status: statusEnum },
      },
    });

    // If no PageDocument exists yet, report it as diverged (backfill not run)
    if (!docRow) {
      return {
        storeId, themeId, ownerKey, status,
        checkedAt:    new Date().toISOString(),
        diverged:     true,
        oldSections:  oldSections.length,
        newSections:  0,
        sectionCountDiff:  oldSections.length,
        blockCountDiffs:   [],
        settingsDiffs:     [],
        missingInNew:  oldSections.map(s => s.id),
        missingInOld:  [],
      };
    }

    // Reverse-transform new model → sections for field-level comparison
    const docData = {
      id: docRow.id,
      storeId: docRow.storeId,
      themeId: docRow.themeId,
      scope: docRow.scope as any,
      ownerKey: docRow.ownerKey,
      status: docRow.status as any,
      version: docRow.version,
      schemaVersion: docRow.schemaVersion,
      tree: docRow.tree as any,
    };

    const newSections = transformDocumentToSections(docData);

    // ── Compare ──────────────────────────────────────────────────────────────
    const result = this.compareSections(
      storeId, themeId, ownerKey, status, oldSections, newSections,
    );

    // Log divergence
    if (result.diverged) {
      this.logger.warn(
        `Shadow check DIVERGED: ${storeId}/${themeId}/${ownerKey} (${status}) — ` +
        `sections: ${result.sectionCountDiff} diff, ` +
        `settings diffs: ${result.settingsDiffs.length}, ` +
        `missing in new: ${result.missingInNew.length}`,
      );
    } else {
      this.logger.debug(
        `Shadow check PASSED: ${storeId}/${themeId}/${ownerKey} (${status})`,
      );
    }

    return result;
  }

  /**
   * Batch check — all pages for all stores.
   * Returns summary: how many stores/pages are parity-ready vs diverged.
   */
  async checkAll(): Promise<{
    total: number;
    passed: number;
    diverged: number;
    results: ShadowRenderResult[];
  }> {
    const stores = await this.prisma.store.findMany({
      where:  { status: { not: 'SUSPENDED' } },
      select: { id: true },
    });

    const results: ShadowRenderResult[] = [];

    for (const store of stores) {
      const activeTheme = await this.prisma.storeTheme.findFirst({
        where:  { storeId: store.id, isActive: true },
        select: { themeId: true },
      });
      const themeId = activeTheme?.themeId ?? 'default';

      const pages = await this.prisma.themePageSection.findMany({
        where:   {
          storeId:  store.id,
          OR: [{ themeId }, { themeId: null }, { themeId: 'default' }],
        },
        select:  { pageId: true, isDraft: true },
        distinct: ['pageId', 'isDraft'],
      });

      for (const { pageId, isDraft } of pages) {
        const r = await this.check(store.id, themeId, pageId, isDraft);
        results.push(r);
      }
    }

    const passed  = results.filter(r => !r.diverged).length;
    const diverged = results.filter(r => r.diverged).length;

    this.logger.log(
      `Shadow check batch: ${results.length} pages — ` +
      `${passed} passed, ${diverged} diverged`,
    );

    return { total: results.length, passed, diverged, results };
  }

  // ── Field-level comparison ────────────────────────────────────────────────

  private compareSections(
    storeId:     string,
    themeId:     string,
    ownerKey:    string,
    status:      string,
    old:         RawSection[],
    newSections: RawSection[],
  ): ShadowRenderResult {
    const base = { storeId, themeId, ownerKey, status: status as any, checkedAt: new Date().toISOString() };

    const oldMap = new Map(old.map(s => [s.id, s]));
    const newMap = new Map(newSections.map(s => [s.id, s]));

    const missingInNew = old.filter(s => !newMap.has(s.id)).map(s => s.id);
    const missingInOld = newSections.filter(s => !oldMap.has(s.id)).map(s => s.id);

    const blockCountDiffs: ShadowRenderResult['blockCountDiffs'] = [];
    const settingsDiffs:   FieldDiff[] = [];

    for (const oldSec of old) {
      const newSec = newMap.get(oldSec.id);
      if (!newSec) continue;

      // Section type
      if (oldSec.sectionDefId !== newSec.sectionDefId) {
        settingsDiffs.push({
          field: '__type__', nodeId: oldSec.id, nodeType: oldSec.sectionDefId,
          old: oldSec.sectionDefId, new: newSec.sectionDefId,
        });
      }

      // Section visibility
      if (oldSec.isVisible !== newSec.isVisible) {
        settingsDiffs.push({
          field: '__isVisible__', nodeId: oldSec.id, nodeType: oldSec.sectionDefId,
          old: oldSec.isVisible, new: newSec.isVisible,
        });
      }

      // Section settings (field by field)
      const allKeys = new Set([
        ...Object.keys(oldSec.settings),
        ...Object.keys(newSec.settings),
      ]);
      for (const key of allKeys) {
        if (key === 'responsive') continue;  // responsive is new — expected to be absent in old
        const ov = oldSec.settings[key];
        const nv = newSec.settings[key];
        if (!deepEqual(ov, nv)) {
          settingsDiffs.push({ field: key, nodeId: oldSec.id, nodeType: oldSec.sectionDefId, old: ov, new: nv });
        }
      }

      // Block count
      if (oldSec.blocks.length !== newSec.blocks.length) {
        blockCountDiffs.push({ sectionId: oldSec.id, old: oldSec.blocks.length, new: newSec.blocks.length });
      }

      // Block settings
      const oldBlockMap = new Map(oldSec.blocks.map(b => [b.id, b]));
      const newBlockMap = new Map(newSec.blocks.map(b => [b.id, b]));

      for (const ob of oldSec.blocks) {
        const nb = newBlockMap.get(ob.id);
        if (!nb) {
          settingsDiffs.push({ field: '__missing_block__', nodeId: ob.id, nodeType: ob.type, old: ob.id, new: null });
          continue;
        }
        if (ob.type !== nb.type) {
          settingsDiffs.push({ field: '__type__', nodeId: ob.id, nodeType: ob.type, old: ob.type, new: nb.type });
        }
        if (ob.isVisible !== nb.isVisible) {
          settingsDiffs.push({ field: '__isVisible__', nodeId: ob.id, nodeType: ob.type, old: ob.isVisible, new: nb.isVisible });
        }
        const blockKeys = new Set([...Object.keys(ob.settings), ...Object.keys(nb.settings)]);
        for (const key of blockKeys) {
          if (!deepEqual(ob.settings[key], nb.settings[key])) {
            settingsDiffs.push({ field: key, nodeId: ob.id, nodeType: ob.type, old: ob.settings[key], new: nb.settings[key] });
          }
        }
      }
    }

    const diverged =
      missingInNew.length > 0 ||
      missingInOld.length > 0 ||
      blockCountDiffs.length > 0 ||
      settingsDiffs.length > 0 ||
      old.length !== newSections.length;

    return {
      ...base,
      diverged,
      oldSections:       old.length,
      newSections:       newSections.length,
      sectionCountDiff:  Math.abs(old.length - newSections.length),
      blockCountDiffs,
      settingsDiffs,
      missingInNew,
      missingInOld,
    };
  }
}

// ─── Deep equality (handles JSON values from Prisma) ─────────────────────────

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return false;
}
