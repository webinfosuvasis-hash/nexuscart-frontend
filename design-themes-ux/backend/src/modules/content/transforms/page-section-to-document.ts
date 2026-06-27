import { randomUUID } from 'crypto';
import type { Node, PageDocumentData, RawBlock, RawSection } from './types';

// ─── Block → leaf Node ────────────────────────────────────────────────────────

function transformBlock(block: RawBlock): Node {
  return {
    id:       block.id,
    type:     block.type,
    settings: sanitizeSettings(block.settings),
    visibility: {
      desktop: block.isVisible,
      tablet:  block.isVisible,
      mobile:  block.isVisible,
    },
    children: [],
  };
}

// ─── Section → band Node (with block children) ───────────────────────────────

function transformSection(section: RawSection): Node {
  const blocks = [...section.blocks]
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
    .map(transformBlock);

  // Sections map to their sectionDefId as the componentType.
  // Legacy section types that exist in SectionDefinition are kept as-is:
  // the ComponentDefinition table has matching ids (hero, featured_collection…)
  // for everything that maps 1:1 to a new primitive.
  // Types that have no direct primitive mapping keep their id (treated as
  // LAYOUT kind, rendered by GenericSection fallback until Phase 2 adds them).
  return {
    id:       section.id,
    type:     section.sectionDefId,
    label:    section.label ?? undefined,
    settings: sanitizeSettings(section.settings),
    visibility: {
      desktop: section.isVisible,
      tablet:  section.isVisible,
      mobile:  section.isVisible,
    },
    children: blocks,
  };
}

// ─── Main transform ───────────────────────────────────────────────────────────

/**
 * Transforms an ordered array of ThemePageSection rows (each with their
 * ThemePageBlock children already loaded) into a PageDocument tree.
 *
 * The tree root is a virtual 'root' node containing all sections as children.
 * This matches the ContentNode model where a page IS a tree — not a flat list.
 *
 * Round-trip guarantee:
 *   transformBack(transform(sections)) === sections (settings, order, visibility)
 */
export function transformSectionsToPageDocument(
  storeId:  string,
  themeId:  string,
  ownerKey: string,
  sections: RawSection[],
  status:   'DRAFT' | 'PUBLISHED',
): PageDocumentData {
  const ordered = [...sections].sort(
    (a, b) => Number(a.sortOrder) - Number(b.sortOrder),
  );

  const rootNode: Node = {
    id:       randomUUID(),
    type:     'root',
    settings: {},
    children: ordered.map(transformSection),
  };

  return {
    storeId,
    themeId,
    scope:         'PAGE',
    ownerKey,
    status,
    version:       1,
    schemaVersion: 1,
    tree:          rootNode,
    seo:           null,
    settings:      { contextType: 'none' },
  };
}

// ─── Reverse: PageDocument tree → RawSection[] (for round-trip validation) ───

export function transformDocumentToSections(doc: PageDocumentData): RawSection[] {
  const root = doc.tree;
  if (!root.children?.length) return [];

  return root.children.map((sectionNode, idx): RawSection => ({
    id:           sectionNode.id,
    sectionDefId: sectionNode.type,
    label:        sectionNode.label ?? null,
    settings:     sectionNode.settings as Record<string, unknown>,
    sortOrder:    idx + 1,
    isVisible:    sectionNode.visibility?.desktop ?? true,
    isDraft:      doc.status === 'DRAFT',
    blocks:       (sectionNode.children ?? []).map((blockNode, bi): RawBlock => ({
      id:        blockNode.id,
      type:      blockNode.type,
      settings:  blockNode.settings as Record<string, unknown>,
      sortOrder: bi + 1,
      isVisible: blockNode.visibility?.desktop ?? true,
    })),
  }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeSettings(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}
