/**
 * Phase 4 — Node factory functions
 *
 * Pure TypeScript — no React, no DOM.
 * Used by InsertCommandPalette to create ContentNodes in node mode.
 *
 * Three creation paths:
 *
 *   makeNode()                  — bare node with explicit settings/children
 *   createNodeFromDefinition()  — from SECTION_DEFINITIONS entry (default settings + default blocks)
 *   createNodeFromSeed()        — from TemplateSectionSeed (PAGE_TEMPLATES / PDP_TEMPLATES)
 *
 * ── Default settings ──────────────────────────────────────────────────────────
 * createNodeFromDefinition reads each SettingField.default in the definition's
 * settingsSchema and builds a flat settings object.  overrideSettings merge on top.
 *
 * ── Child nodes ───────────────────────────────────────────────────────────────
 * defaultBlocks / seed.blocks become child Node[] using the _nx_sortOrder
 * convention established by the Phase 0 sectionNodeAdapter.  This ensures a
 * node that is later serialised back to SectionDoc via nodeToSectionDoc()
 * produces the correct sortOrder on each BlockDoc.
 *
 * ── Allowed children ──────────────────────────────────────────────────────────
 * SectionDefinition.allowedBlockTypes governs which child block types are legal.
 * An empty array ([]) means "no blocks" — defaultBlocks should also be empty.
 * ['*'] means any block type is allowed.
 * createNodeFromDefinition respects this implicitly: it only populates children
 * from defaultBlocks (which the definition author controls).
 */

import { nanoid } from 'nanoid';
import type { Node } from '@/components/node-renderer/types';
import type { SectionDefinition } from '@/admin/editor/types';

// ─── Minimal seed type ────────────────────────────────────────────────────────
// Mirrors TemplateSectionSeed from templates/index.ts without importing it,
// avoiding a dependency on the templates module inside the adapter layer.

export interface SectionSeed {
  type:     string;
  label:    string;
  settings: Record<string, unknown>;
  blocks:   Array<{
    type:     string;
    settings: Record<string, unknown>;
  }>;
}

// ─── ID helpers ───────────────────────────────────────────────────────────────

const newNodeId  = () => `node-${nanoid(8)}`;

// Pretty-print a snake_case type string as a human label fallback.
function typeToLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── makeNode ─────────────────────────────────────────────────────────────────

/**
 * Create a bare Node with fresh IDs.
 * Used for layout primitives (container, stack, grid, …) that have no
 * SectionDefinition entry and carry only their default settings.
 */
export function makeNode(
  type:     string,
  label:    string,
  settings: Record<string, unknown> = {},
  children: Node[]                  = [],
): Node {
  return {
    id:       newNodeId(),
    type,
    label,
    settings,
    children,
  };
}

// ─── createNodeFromDefinition ─────────────────────────────────────────────────

/**
 * Create a Node from a SectionDefinition (one entry in SECTION_DEFINITIONS).
 *
 * @param def               The SectionDefinition from editor-mock-data.
 * @param overrideSettings  Optional per-insertion overrides applied on top of
 *                          the definition's schema defaults.
 *
 * Default settings are collected from every SettingField that has a `default`
 * value defined.  Fields without a default are omitted — the Inspector will
 * show the field as empty and the merchant can fill it in.
 *
 * Each defaultBlock becomes a child Node.  The _nx_sortOrder key is encoded
 * in the child's settings so a future nodeToSectionDoc() call round-trips
 * correctly (Phase 0 convention).
 */
export function createNodeFromDefinition(
  def:              SectionDefinition,
  overrideSettings: Record<string, unknown> = {},
): Node {
  // Collect schema defaults
  const defaultSettings: Record<string, unknown> = {};
  for (const field of def.settingsSchema) {
    if (field.default !== undefined) {
      defaultSettings[field.key] = field.default;
    }
  }

  // Convert defaultBlocks to child Nodes
  const children: Node[] = (def.defaultBlocks ?? []).map((b, i) => ({
    id:       newNodeId(),
    type:     b.type,
    label:    typeToLabel(b.type),
    settings: {
      ...(b.settings as Record<string, unknown>),
      _nx_sortOrder:  (b.sortOrder ?? i + 1),
      _nx_isRequired: (b as any).isRequired ?? false,
    },
    children: [],
  }));

  return {
    id:       newNodeId(),
    type:     def.type,
    label:    def.name,
    settings: { ...defaultSettings, ...overrideSettings },
    children,
  };
}

// ─── createNodeFromSeed ───────────────────────────────────────────────────────

/**
 * Create a Node from a TemplateSectionSeed (entry in PAGE_TEMPLATES or
 * PDP_TEMPLATES).  Seed blocks carry their own settings, so no schema-default
 * extraction is needed — the template is the source of truth.
 *
 * @param seed  One section entry from a PageTemplate.sections array.
 */
export function createNodeFromSeed(seed: SectionSeed): Node {
  const children: Node[] = seed.blocks.map((b, i) => ({
    id:       newNodeId(),
    type:     b.type,
    label:    typeToLabel(b.type),
    settings: {
      ...(b.settings as Record<string, unknown>),
      _nx_sortOrder: i + 1,
    },
    children: [],
  }));

  return {
    id:       newNodeId(),
    type:     seed.type,
    label:    seed.label,
    settings: seed.settings as Record<string, unknown>,
    children,
  };
}
