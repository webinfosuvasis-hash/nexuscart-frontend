/**
 * Storefront Service — Sprint 5
 *
 * Fetches DraftPageData from the NestJS backend for the preview renderer.
 * Uses native fetch (not the admin api.ts axios instance) so it works
 * without an active admin session — preview links are sharable.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BlockInstance {
  id:        string;
  type:      string;
  settings:  Record<string, any>;
  isVisible: boolean;
  sortOrder: number;
}

export interface SectionWithBlocks {
  id:        string;
  type:      string;
  label:     string;
  settings:  Record<string, any>;
  isVisible: boolean;
  blocks:    BlockInstance[];
}

export interface DraftPageData {
  storeId:   string;
  themeId:   string;
  pageId:    string;
  pageTitle: string;
  store: {
    name:     string;
    currency: string;
    logo:     string | null;
  };
  themeConfig: {
    colors:     Record<string, string>;
    typography: Record<string, any>;
    layout:     Record<string, any>;
  };
  /** Zone-based header (Option A — pre-section-group migration) */
  headerConfig: {
    zones:    any[];
    behavior: any;
  } | null;
  /** Column-based footer (Option A — pre-section-group migration) */
  footerConfig: {
    columns:   any[];
    bottomBar: any;
    settings:  any;
  } | null;
  sections:           SectionWithBlocks[];
  sectionDefinitions: Record<string, { name: string; icon: string; category: string }>;
  blockDefinitions:   Record<string, { name: string; icon: string }>;
  menus:              Record<string, Array<{ id: string; label: string; url: string }>>;
  generatedAt:        string;
  /**
   * ContentNode tree — present when CONTENT_NODE_ENABLED flag is ON for this store.
   * When present, PreviewRenderer uses TreeRenderer instead of SectionRenderer.
   * When absent (undefined/null), existing SectionRenderer path is used unchanged.
   */
  nodeTree?: Record<string, unknown> | null;
}

// ─── Error types ──────────────────────────────────────────────────────────────

export class PreviewExpiredError    extends Error { constructor() { super('Preview link has expired'); } }
export class PreviewInvalidError    extends Error { constructor(msg?: string) { super(msg ?? 'Invalid preview link'); } }
export class PreviewForbiddenError  extends Error { constructor() { super('Preview token does not match this store'); } }
export class PreviewNetworkError    extends Error { constructor() { super('Unable to load preview — check your connection'); } }

// ─── Service ─────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export const storefrontService = {
  /**
   * Fetch all draft data for preview rendering.
   *
   * @param storeId — from preview URL param
   * @param pageId  — from preview URL param
   * @param token   — JWT from ?token= query param (never stored in localStorage)
   */
  async getDraftPageData(
    storeId: string,
    pageId:  string,
    token:   string,
  ): Promise<DraftPageData> {
    let response: Response;

    try {
      response = await fetch(
        `${API_BASE}/storefront/${encodeURIComponent(storeId)}/draft/${encodeURIComponent(pageId)}`,
        {
          method:  'GET',
          headers: {
            // Cache-Control omitted — it is a non-simple CORS header that triggers preflight
            // failures. The server's response already sets Cache-Control: no-store.
            'Authorization': `Bearer ${token}`,
            'Accept':        'application/json',
          },
        },
      );
    } catch {
      throw new PreviewNetworkError();
    }

    if (response.status === 401) throw new PreviewExpiredError();
    if (response.status === 403) throw new PreviewForbiddenError();

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new PreviewInvalidError((body as any)?.message);
    }

    const body = await response.json();
    // Backend wraps in { success, data, timestamp } via TransformInterceptor
    return (body.data ?? body) as DraftPageData;
  },
};
