/**
 * Theme Installer — type definitions
 *
 * Intentionally separate from the Insert Palette template types
 * (src/admin/editor/templates/index.ts).  Templates define layout structure
 * only (content-free).  Themes define full starter content: colors, copy,
 * collection bindings, product card settings, and brand voice.
 *
 * Relationship to existing types:
 *
 *   ThemeSectionSeed ≈ SectionDoc (same shape, without id + isVisible)
 *   ThemeBlockSeed   ≈ BlockDoc   (same shape, without id + sortOrder)
 *   ThemeDefinition  → buildPageDocFromTheme() → PageDoc (Phase 0 adapter)
 *                    → buildNodeTreeFromPageDoc() → Node tree (Phase 0 adapter)
 */

// ─── Category ─────────────────────────────────────────────────────────────────

export type ThemeCategory =
  | 'fashion'
  | 'jewelry'
  | 'handicraft'
  | 'food'
  | 'electronics'
  | 'lifestyle'
  | 'furniture'
  | 'beauty';

// ─── Theme metadata ───────────────────────────────────────────────────────────

export interface ThemeMeta {
  /** Unique theme identifier — lowercase hyphenated, e.g. 'kaveri' */
  id:           string;
  /** Display name, e.g. 'Kaveri' */
  name:         string;
  /** Semantic version, e.g. '1.0.0' */
  version:      string;
  /** Industry vertical for filtering in the marketplace */
  category:     ThemeCategory;
  /** One-sentence description for the marketplace card */
  description:  string;
  /** URL or import path of the theme preview screenshot */
  previewImage: string;
  /** Merchant-facing tags, e.g. ['mobile-first', 'editorial', 'artisan'] */
  tags:         string[];
  /** Vertical label shown in the marketplace, e.g. 'Saree & Fashion' */
  vertical:     string;
  /** Theme author, e.g. 'NexusCart' or a partner studio name */
  author:       string;
  /** ISO 8601 creation date */
  createdAt:    string;
}

// ─── Theme color system ───────────────────────────────────────────────────────

export interface ThemeColors {
  primary:    string;   // dominant brand color
  secondary:  string;   // light background / contrast
  accent:     string;   // CTA, highlights
  background: string;   // page background
  surface:    string;   // card / section background
  text:       string;   // primary body text
  muted:      string;   // secondary / helper text
}

// ─── Theme typography ─────────────────────────────────────────────────────────

export interface ThemeTypography {
  headingFont: string;   // font-family string
  bodyFont:    string;
  baseSizeRem: number;   // e.g. 1.0
  lineHeight:  number;   // e.g. 1.6
}

// ─── Section / block seeds ────────────────────────────────────────────────────

export interface ThemeBlockSeed {
  /** Block type identifier, e.g. 'heading', 'button', 'product_card' */
  type:     string;
  /** Pre-filled default settings — merchant can override in Inspector */
  settings: Record<string, unknown>;
}

export interface ThemeSectionSeed {
  /**
   * Stable string key used when generating the section ID.
   * E.g. 'hero', 'new-arrivals', 'brand-story'.
   * Must be unique within the page.  ID is generated as `${themeId}_${key}`.
   */
  key:      string;
  /** Section type — must match a registered section type in SECTION_DEFINITIONS */
  type:     string;
  /** Merchant-facing label shown in the Layers panel */
  label:    string;
  /** Pre-filled settings — merchant can override in Inspector */
  settings: Record<string, unknown>;
  /** Pre-filled blocks — merchant can add/remove/reorder */
  blocks:   ThemeBlockSeed[];
}

// ─── Theme page definition ────────────────────────────────────────────────────

export interface ThemePage {
  /** Page identifier, e.g. 'home', 'collection', 'product' */
  pageId:   string;
  /** Human-readable title, e.g. 'Home page' */
  title:    string;
  sections: ThemeSectionSeed[];
}

// ─── Full theme definition ────────────────────────────────────────────────────

export interface ThemeDefinition {
  meta:       ThemeMeta;
  colors:     ThemeColors;
  typography: ThemeTypography;
  /** Page definitions keyed by pageId */
  pages:      Record<string, ThemePage>;
}

// ─── Registry entry ───────────────────────────────────────────────────────────

export interface ThemeRegistryEntry {
  meta:       ThemeMeta;
  definition: ThemeDefinition;
  /** ISO 8601 date when this version was registered */
  registeredAt: string;
}

// ─── Install record (persisted in PageDocument.settings) ─────────────────────

/**
 * Written to PageDocument.settings[THEME_INSTALL_KEY] on every applyTheme()
 * or upgradeTheme() call.  Allows the UI to display "Kaveri 1.0.0 installed"
 * and to detect when an upgrade is available.
 */
export interface ThemeInstallRecord {
  themeId:     string;
  version:     string;
  installedAt: string;   // ISO 8601
  pageId:      string;
}

// ─── Migration ────────────────────────────────────────────────────────────────

import type { PageDoc } from '@/admin/editor/types';

/**
 * A migration transforms a PageDoc from one theme version to another.
 * Migrations MUST be idempotent — applying the same migration twice must
 * produce the same result as applying it once.
 */
export interface ThemeMigration {
  /** Theme this migration applies to */
  themeId:     string;
  fromVersion: string;
  toVersion:   string;
  /** Human-readable changelog entry for this migration */
  description: string;
  /**
   * Pure function: receives the current PageDoc and the target ThemeDefinition;
   * returns a new PageDoc.  Must not mutate inputs.
   */
  migrate: (doc: PageDoc, targetDefinition: ThemeDefinition) => PageDoc;
}

// ─── Upgrade result ───────────────────────────────────────────────────────────

export interface ThemeUpgradeResult {
  themeId:             string;
  pageId:              string;
  fromVersion:         string;
  toVersion:           string;
  migrationsApplied:   number;
  nodeDocumentVersion: number;
  upgradedAt:          string;
}

// ─── Apply result ─────────────────────────────────────────────────────────────

export interface ApplyThemeResult {
  themeId:           string;
  pageId:            string;
  sectionsInstalled: number;
  nodeDocumentVersion: number;
  installedAt:       string;
}

// ─── Apply context ────────────────────────────────────────────────────────────

export interface ApplyThemeContext {
  /** Target store ID (from AuthContext user.storeId) */
  storeId:       string;
  /** Active theme ID (from EditorState.activeTheme) */
  activeThemeId: string;
  /** Page to install the theme on (default: 'home') */
  pageId?:       string;
}
