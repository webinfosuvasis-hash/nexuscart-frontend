export const CACHE_TTL = {
  THEME_CONFIG:   300,     // 5 min
  HEADER_CONFIG:  300,
  FOOTER_CONFIG:  300,
  PAGE_SECTIONS:  300,
  MENU:           300,
  FILTER_VALUES:  600,     // 10 min — catalog data changes less often
  PRESET_LIST:     60,     // 1 min  — presets change moderately
  PREVIEW_LINK: 86_400,    // 24 h   — signed preview URL TTL
  DEFINITIONS:   3600,     // 1 h    — block/section definitions are static
  ACTIVE_THEME:   300,     // 5 min  — active theme per store
  STORE_SETTINGS: 600,     // 10 min — store name, currency, logo
} as const;

/** Redis key factories — single authoritative location for all cache key strings */
export const CACHE_KEYS = {
  // ── Theme Config ────────────────────────────────────────────────────────────
  // CHANGED in Sprint 4.5: now scoped by themeId
  themeConfig: (storeId: string, themeId: string, status: 'draft' | 'published') =>
    `theme:${storeId}:${themeId}:${status}`,

  // Backward-compat alias used during migration when themeId is not yet known
  themeConfigLegacy: (storeId: string, status: 'draft' | 'published') =>
    `theme:${storeId}:${status}`,

  // ── Header / Footer ─────────────────────────────────────────────────────────
  // Header and Footer are not yet themeId-scoped (deferred to Sprint 6.5 / M5-M8)
  headerConfig: (storeId: string, status: 'draft' | 'published') =>
    `header:${storeId}:${status}`,

  footerConfig: (storeId: string, status: 'draft' | 'published') =>
    `footer:${storeId}:${status}`,

  // ── Page Sections ────────────────────────────────────────────────────────────
  // CHANGED in Sprint 4.5: now includes themeId
  pageSections: (storeId: string, themeId: string, pageId: string, isDraft: boolean) =>
    `page:${storeId}:${themeId}:${pageId}:sections:${isDraft ? 'draft' : 'published'}`,

  // Backward-compat alias for callers that don't yet have themeId
  pageSectionsLegacy: (storeId: string, pageId: string, isDraft: boolean) =>
    `page:${storeId}:${pageId}:sections:${isDraft ? 'draft' : 'published'}`,

  // ── Presets ─────────────────────────────────────────────────────────────────
  presetList: (storeId: string) => `presets:${storeId}`,

  // ── Section / Block Definitions ──────────────────────────────────────────────
  sectionDefs:        () => `sections:definitions`,
  sectionDefsCustom:  (storeId: string) => `sections:${storeId}:custom`,
  blockDefs:          () => `blocks:definitions`,             // NEW in Sprint 4.5
  blockDef:           (type: string) => `blocks:def:${type}`, // NEW in Sprint 4.5

  // ── Store / Theme Context ────────────────────────────────────────────────────
  activeTheme:    (storeId: string) => `active-theme:${storeId}`,  // NEW in Sprint 4.5
  storeSettings:  (storeId: string) => `store:${storeId}:settings`,// NEW in Sprint 4.5

  // ── Block cache (Sprint 4.5.1) ───────────────────────────────────────────────
  // Blocks are embedded in the page sections cache (pageSections key above).
  // The sectionBlocks key is used by future StorefrontService for direct block access
  // without loading the full page sections payload.
  sectionBlocks: (sectionId: string, isDraft: boolean) =>
    `section:${sectionId}:blocks:${isDraft ? 'draft' : 'published'}`,

  // ── Glob patterns for bulk invalidation ─────────────────────────────────────
  // Invalidate ALL theme-related keys for a store+theme on publish
  storeThemePattern: (storeId: string, themeId: string) => `*:${storeId}:${themeId}:*`,
  // Invalidate ALL store keys (legacy — used before themeId scoping)
  storePattern:      (storeId: string) => `*:${storeId}:*`,
} as const;

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
