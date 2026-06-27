import api from '@/lib/api';

// ─── Shape types ──────────────────────────────────────────────────────────────

export interface ThemeColors {
  primary:    string;
  secondary:  string;
  accent:     string;
  background: string;
  text:       string;
  surface:    string;
}

export interface ThemeTypography {
  headingFont: string;
  bodyFont:    string;
  baseSizeRem: number;
  lineHeight:  number;
}

export interface ThemeLayout {
  stickyHeader:  boolean;
  sidebarCart:   boolean;
  megaMenu:      boolean;
  backToTop:     boolean;
  cookieConsent: boolean;
}

export interface ThemeConfigData {
  colors:     ThemeColors;
  typography: ThemeTypography;
  layout:     ThemeLayout;
}

// ─── PageDocument types (Phase 6) ────────────────────────────────────────────

/**
 * Shape returned by the /content/{storeId}/{themeId}/{ownerKey} endpoint.
 * Mirrors backend/src/modules/content/transforms/types.ts :: PageDocumentData.
 */
export interface PageDocumentData {
  id?:           string;
  storeId:       string;
  themeId:       string;
  scope:         string;                         // 'PAGE' | 'SYMBOL' | ...
  ownerKey:      string;                         // same as pageId ('home', 'product', …)
  status:        'DRAFT' | 'PUBLISHED';
  version:       number;                         // optimistic concurrency token
  schemaVersion: number;
  tree:          Record<string, unknown>;         // root ContentNode
  seo?:          Record<string, unknown> | null;
  settings?:     Record<string, unknown> | null;
  publishedAt?:  string | null;
}

/**
 * Thrown by savePageDocument() when the server's stored version does not
 * match the version the client submitted.
 * Callers should:
 *   1. Call loadPageDocument() to get the current server version.
 *   2. Dispatch SET_NODE_DOCUMENT_VERSION with that version.
 *   3. Retry the save (or show a "reload first" message to the merchant).
 */
export class DocumentVersionConflictError extends Error {
  readonly name = 'DocumentVersionConflictError';
  constructor(
    /** Server version at the time of the conflict. -1 if unknown. */
    public readonly serverVersion: number,
  ) {
    super(
      `Document version conflict: client sent version ${serverVersion - 1}, ` +
      `server is at version ${serverVersion}. ` +
      `Call loadPageDocument() and retry with the updated version.`,
    );
  }
}

export interface PublishResult {
  version:     number;
  publishedAt: string;
  snapshotId:  string | null;
  themeId:     string;
}

export interface PreviewLinkResult {
  url:       string;
  expiresAt: string;
  token:     string;
  themeId:   string;
}

// ─── Request helper ───────────────────────────────────────────────────────────

function themeHeaders(themeId?: string): Record<string, string> {
  return themeId ? { 'X-Theme-Id': themeId } : {};
}

// ─── Response unwrapper ───────────────────────────────────────────────────────
//
// NestJS TransformInterceptor wraps every response body as:
//   { success: true, data: <actual payload>, timestamp: "..." }
//
// api.ts interceptor returns res.data (the HTTP body), so every api.* call
// returns the wrapper, NOT the payload. For endpoints whose return values are
// used by callers (publish, generatePreviewLink), we must unwrap explicitly.

function unwrap<T>(res: unknown): T {
  const r = res as Record<string, unknown>;
  if (r && typeof r === 'object' && 'success' in r && 'data' in r) {
    return r.data as T;
  }
  return res as T;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const themeEngineService = {
  // ── Theme Config ────────────────────────────────────────────────────────────

  getConfig: (themeId?: string) =>
    api.get('/theme/config', { headers: themeHeaders(themeId) }) as Promise<{ draft: any; published: any; themeId: string }>,

  updateDraft: (data: Partial<ThemeConfigData>, themeId?: string) =>
    api.put('/theme/config/draft', data, { headers: themeHeaders(themeId) }),

  /** Atomic publish — unwraps wrapper so callers get { version, publishedAt, snapshotId, themeId } */
  publish: async (themeId?: string): Promise<PublishResult> => {
    const res = await api.post('/theme/config/publish', {}, { headers: themeHeaders(themeId) });
    return unwrap<PublishResult>(res);
  },

  discardDraft: (themeId?: string) =>
    api.post('/theme/config/discard-draft', {}, { headers: themeHeaders(themeId) }),

  // ── Header / Footer ─────────────────────────────────────────────────────────

  getHeader: () =>
    api.get('/theme/header') as Promise<{ draft: any; published: any }>,

  updateHeaderDraft: (data: { zones?: any[]; behavior?: any }) =>
    api.put('/theme/header/draft', data),

  getHeaderComponents: () =>
    api.get('/theme/header/components') as Promise<any[]>,

  getFooter: () =>
    api.get('/theme/footer') as Promise<{ draft: any; published: any }>,

  updateFooterDraft: (data: { columns?: any[]; bottomBar?: any; settings?: any }) =>
    api.put('/theme/footer/draft', data),

  // ── Section / Block Definitions ──────────────────────────────────────────────

  listSectionDefinitions: (params?: { category?: string; tier?: string; search?: string }) =>
    api.get('/theme/definitions/sections', { params }),

  getSectionDefinition: (type: string) =>
    api.get(`/theme/definitions/sections/${type}`),

  listBlockDefinitions: (params?: { sectionType?: string }) =>
    api.get('/theme/definitions/blocks', { params }),

  getBlockDefinition: (type: string) =>
    api.get(`/theme/definitions/blocks/${type}`),

  // ── Page sections (Phase 2 + 3) ─────────────────────────────────────────────

  /**
   * Load draft page data — sections for legacy mode, nodeTree for ContentNode mode.
   *
   * Phase 1: EditorContext.loadPage() calls this instead of loadPageSections()
   * so it can detect a nodeTree in the response and activate node mode.
   *
   * When CONTENT_NODE_ENABLED is OFF (the default for all stores), the backend
   * returns the existing sections array and nodeTree is null — no behaviour change.
   * When ON, the backend returns nodeTree and sections may be empty or absent.
   *
   * Response shape handled:
   *   Array (legacy):                 → { sections: array, nodeTree: null }
   *   { sections, nodeTree? } (new):  → { sections, nodeTree }
   */
  getDraftPageData: async (
    pageId:   string,
    themeId?: string,
  ): Promise<{ sections: any[]; nodeTree: Record<string, unknown> | null }> => {
    try {
      const res  = await api.get(
        `/theme/pages/${encodeURIComponent(pageId)}/sections?draft=true`,
        { headers: themeHeaders(themeId) },
      );
      const data = unwrap<any>(res);

      // Legacy: backend returns a plain array
      if (Array.isArray(data)) {
        return { sections: data, nodeTree: null };
      }

      // ContentNode: backend returns an object with sections and optional nodeTree
      if (data && typeof data === 'object') {
        return {
          sections: Array.isArray(data.sections) ? data.sections : [],
          nodeTree: (data.nodeTree ?? null) as Record<string, unknown> | null,
        };
      }

      return { sections: [], nodeTree: null };
    } catch {
      return { sections: [], nodeTree: null };
    }
  },

  /**
   * Load all draft sections (with embedded blocks) for a page.
   * Phase 3: replaces MOCK_PAGE_DOC as the editor's data source.
   * @deprecated prefer getDraftPageData() — kept for callers outside EditorContext.
   */
  loadPageSections: async (pageId: string, themeId?: string): Promise<any[]> => {
    try {
      const res = await api.get(
        `/theme/pages/${encodeURIComponent(pageId)}/sections?draft=true`,
        { headers: themeHeaders(themeId) },
      );
      const data = unwrap<any>(res);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  /**
   * Persist all editor sections + blocks to the database.
   * Phase 2: replaces the setTimeout stub in SaveButton.
   *
   * Sends PUT /theme/pages/:pageId/sections with sections AND their blocks.
   * The backend atomically deletes all existing draft sections and recreates them.
   */
  savePageSections: async (
    pageId:    string,
    sections:  Array<{
      type:      string;
      label?:    string;
      settings:  Record<string, any>;
      isVisible: boolean;
      sortOrder?: number;
      blocks: Array<{
        type:      string;
        settings:  Record<string, any>;
        isVisible: boolean;
        sortOrder: number;
      }>;
    }>,
    themeId?: string,
  ): Promise<void> => {
    const payload = {
      sections: sections.map((s, idx) => ({
        sectionDefId: s.type,              // SectionDoc.type === sectionDefId
        label:        s.label,
        settings:     s.settings,
        sortOrder:    s.sortOrder ?? (idx + 1) * 1.0,
        isVisible:    s.isVisible,
        blocks:       s.blocks.map((b, bi) => ({
          type:      b.type,
          settings:  b.settings,
          sortOrder: b.sortOrder ?? (bi + 1) * 1.0,
          isVisible: b.isVisible,
        })),
      })),
    };
    await api.put(
      `/theme/pages/${encodeURIComponent(pageId)}/sections`,
      payload,
      { headers: themeHeaders(themeId) },
    );
  },

  // ── ContentNode page document (Phase 6 — CONTENT_NODE_ENABLED path) ─────────
  //
  // These three methods are the node-mode equivalents of loadPageSections,
  // savePageSections, and discardDraft for page content.
  //
  // They are NOT called today — EditorContext, EditorTopBar, and the canvas
  // still use the SectionDoc path.  They are stubbed here in Phase 0 so
  // ── ContentNode page document (Phase 6) ──────────────────────────────────────
  //
  // All four methods use the /content/ module routes confirmed in Step 1 audit.
  // Route structure: /api/v1/content/{storeId}/{themeId}/{ownerKey}
  //
  // ownerKey === pageId (e.g. 'home', 'product', 'collection').
  // storeId and themeId are required on every request.

  /**
   * Load the DRAFT PageDocument for a page.
   *
   * Returns null in two cases:
   *   1. No PageDocument row exists (page was never edited in node mode).
   *   2. HTTP 404 from the backend (same semantic as null).
   *
   * The returned `version` must be stored in state.nodeDocumentVersion
   * and passed back on every savePageDocument() call (optimistic concurrency).
   *
   * Called by: EditorContext.loadPage() when CONTENT_NODE_ENABLED is ON.
   *
   * @param storeId  Tenant store ID (from AuthContext user.storeId).
   * @param themeId  Active theme ID (from EditorState.activeTheme).
   * @param pageId   ownerKey — e.g. 'home', 'product', 'collection'.
   */
  loadPageDocument: async (
    storeId: string,
    themeId: string,
    pageId:  string,
  ): Promise<PageDocumentData | null> => {
    try {
      const res = await api.get(
        `/content/${encodeURIComponent(storeId)}` +
        `/${encodeURIComponent(themeId)}` +
        `/${encodeURIComponent(pageId)}?status=DRAFT`,
      );
      const data = unwrap<PageDocumentData | null>(res);
      return data ?? null;
    } catch (err: any) {
      // 404 = document does not exist yet → treat as null (first time in node mode)
      if (err?.response?.status === 404) return null;
      throw err;
    }
  },

  /**
   * Persist the ContentNode tree as a DRAFT PageDocument.
   *
   * Uses optimistic concurrency: `version` must match the server's stored
   * version, otherwise the server returns 409 Conflict and this method
   * throws DocumentVersionConflictError.
   *
   * On success, the returned PageDocumentData.version is the NEW version.
   * Callers must dispatch SET_NODE_DOCUMENT_VERSION with that value.
   *
   * First-time save (document does not exist yet): pass version = 0.
   * The backend creates the row and returns version = 1.
   *
   * Called by: EditorTopBar.performSave() when state.nodeMode === true.
   *
   * @param storeId  Tenant store ID.
   * @param themeId  Active theme ID.
   * @param pageId   ownerKey.
   * @param tree     Root ContentNode (the full page tree).
   * @param version  Current client version (from state.nodeDocumentVersion).
   * @throws DocumentVersionConflictError on HTTP 409.
   */
  savePageDocument: async (
    storeId:   string,
    themeId:   string,
    pageId:    string,
    tree:      Record<string, unknown>,
    version:   number,
    settings?: Record<string, unknown>,   // optional — theme install metadata, SEO, etc.
  ): Promise<PageDocumentData> => {
    try {
      const body: Record<string, unknown> = { tree, version };
      if (settings) body.settings = settings;

      const res = await api.patch(
        `/content/${encodeURIComponent(storeId)}` +
        `/${encodeURIComponent(themeId)}` +
        `/${encodeURIComponent(pageId)}`,
        body,
      );
      return unwrap<PageDocumentData>(res);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        // The server may return the current server version in the error body.
        const serverVersion: number =
          err?.response?.data?.serverVersion ??
          err?.response?.data?.version      ??
          err?.response?.data?.data?.version ??
          -1;
        throw new DocumentVersionConflictError(serverVersion);
      }
      throw err;
    }
  },

  /**
   * Revert the DRAFT PageDocument to the last PUBLISHED version.
   *
   * Gracefully handles the case where no published version exists yet
   * (HTTP 404 from the backend) — new pages that were never published
   * simply have nothing to discard, so this is a no-op.
   *
   * Called by: EditorTopBar.handleDiscard() when state.nodeMode === true,
   * alongside the existing discardDraft() call (which resets theme config).
   *
   * @param storeId  Tenant store ID.
   * @param themeId  Active theme ID.
   * @param pageId   ownerKey.
   */
  discardPageDocument: async (
    storeId: string,
    themeId: string,
    pageId:  string,
  ): Promise<void> => {
    try {
      await api.post(
        `/content/${encodeURIComponent(storeId)}` +
        `/${encodeURIComponent(themeId)}` +
        `/${encodeURIComponent(pageId)}/discard`,
        {},
      );
    } catch (err: any) {
      // 404 = no published version exists (page was never published).
      // This is not an error — nothing to discard for a new page.
      if (err?.response?.status === 404) return;
      throw err;
    }
  },

  /**
   * Promote the DRAFT PageDocument to PUBLISHED.
   *
   * This is separate from themeEngineService.publish() which publishes
   * theme config + ThemePageSection rows.  Both must be called in node
   * mode to fully publish a page.
   *
   * Returns the new version number, publish timestamp, and snapshot ID
   * (for rollback via the rollback endpoint).
   *
   * Called by: EditorTopBar.handleGoLive() when state.nodeMode === true.
   *
   * @param storeId  Tenant store ID.
   * @param themeId  Active theme ID.
   * @param pageId   ownerKey.
   */
  publishPageDocument: async (
    storeId: string,
    themeId: string,
    pageId:  string,
  ): Promise<{ version: number; publishedAt: string; snapshotId: string | null }> => {
    const res = await api.post(
      `/content/${encodeURIComponent(storeId)}` +
      `/${encodeURIComponent(themeId)}` +
      `/${encodeURIComponent(pageId)}/publish`,
      {},
    );
    return unwrap<{ version: number; publishedAt: string; snapshotId: string | null }>(res);
  },

  // ── Preview ─────────────────────────────────────────────────────────────────

  /**
   * Generate a signed 24-hour preview URL.
   * Unwraps TransformInterceptor wrapper so callers get { url, token, expiresAt, themeId } directly.
   *
   * @param pageId   The page to preview (e.g., 'home', 'collection').
   * @param themeId  Optional explicit themeId. Defaults to the store's active theme.
   */
  generatePreviewLink: async (pageId: string, themeId?: string): Promise<PreviewLinkResult> => {
    const res = await api.post('/theme/preview-link', { pageId, themeId });
    return unwrap<PreviewLinkResult>(res);
  },
};
