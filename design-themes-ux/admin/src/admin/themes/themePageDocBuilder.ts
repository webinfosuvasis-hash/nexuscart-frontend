/**
 * Theme → PageDoc builder
 *
 * Pure function — no I/O, no React, no side effects.
 * Converts a ThemePage definition into a PageDoc that the Phase 0
 * round-trip adapters can convert to a ContentNode tree.
 *
 * ── Generation flow ───────────────────────────────────────────────────────────
 *
 *   ThemeDefinition.pages['home']
 *       ↓  buildPageDocFromTheme()
 *   PageDoc  (Phase 0 SectionDoc model)
 *       ↓  buildNodeTreeFromPageDoc()          [from pageDocNodeTree.ts]
 *   Node tree  (ContentNode model)
 *       ↓  savePageDocument()                  [via themeEngineService]
 *   PageDocument row in the database
 *
 * ── ID generation strategy ───────────────────────────────────────────────────
 *
 *   Section ID: `${themeId}_${sectionKey}`
 *     e.g. 'kaveri_hero', 'kaveri_new-arrivals'
 *   Block ID:   `${themeId}_${sectionKey}_blk_${blockIndex}`
 *     e.g. 'kaveri_hero_blk_0'
 *
 *   This deterministic scheme ensures:
 *   1. Re-applying the same theme overwrites with stable IDs (no orphan nodes).
 *   2. IDs are human-readable in DevTools.
 *   3. No nanoid dependency — pure function remains testable without mocking.
 */

import type { ThemeDefinition, ThemePage, ThemeSectionSeed } from './types';
import type { PageDoc, SectionDoc, BlockDoc }              from '@/admin/editor/types';
import { MOCK_PAGE_DOC }                                   from '@/admin/editor/editor-mock-data';

// ─── Section ID helper ────────────────────────────────────────────────────────

function sectionId(themeId: string, key: string): string {
  return `${themeId}_${key}`;
}

function blockId(themeId: string, sectionKey: string, index: number): string {
  return `${themeId}_${sectionKey}_blk_${index}`;
}

// ─── buildSectionFromSeed ─────────────────────────────────────────────────────

/**
 * Convert a single ThemeSectionSeed to a SectionDoc.
 * All generated IDs are stable and deterministic.
 */
export function buildSectionFromSeed(
  themeId: string,
  seed:    ThemeSectionSeed,
): SectionDoc {
  const blocks: BlockDoc[] = seed.blocks.map((b, i): BlockDoc => ({
    id:         blockId(themeId, seed.key, i),
    type:       b.type,
    settings:   b.settings as Record<string, any>,
    isVisible:  true,
    isRequired: false,
    sortOrder:  (i + 1) * 1.0,
  }));

  return {
    id:        sectionId(themeId, seed.key),
    type:      seed.type,
    label:     seed.label,
    settings:  seed.settings as Record<string, any>,
    isVisible: true,
    blocks,
  };
}

// ─── buildPageDocFromTheme ────────────────────────────────────────────────────

/**
 * Convert a ThemePage (from a ThemeDefinition) to a PageDoc.
 *
 * The resulting PageDoc is compatible with buildNodeTreeFromPageDoc() —
 * it uses the same SectionDoc / BlockDoc shapes as the editor model.
 *
 * The header and footer groups are inherited from MOCK_PAGE_DOC (the same
 * defaults as a new store's empty page).  Theme definitions only configure
 * the body page sections; system sections are left to HeaderBuilder /
 * FooterBuilder.
 *
 * @param definition  The full ThemeDefinition (for ID namespace + metadata).
 * @param page        The specific page to convert (e.g. definition.pages['home']).
 */
export function buildPageDocFromTheme(
  definition: ThemeDefinition,
  page:       ThemePage,
): PageDoc {
  const themeId = definition.meta.id;

  const sections: SectionDoc[] = page.sections.map((seed) =>
    buildSectionFromSeed(themeId, seed),
  );

  return {
    // Use the MOCK_PAGE_DOC header/footer groups as defaults.
    // These are the standard announcement_bar + header + footer config.
    ...MOCK_PAGE_DOC,
    pageId:    page.pageId,
    pageTitle: page.title,
    themeId:   definition.meta.id,
    sections,
  };
}
