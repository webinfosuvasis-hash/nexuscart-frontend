/**
 * pageBuilderService.ts
 *
 * API client for the Page Builder backend (Phase 1B+).
 * All requests automatically include the Authorization header and
 * X-Store-Id header via the axios interceptors in lib/api.ts.
 */

import api from '@/lib/api';
import type { ApiResponse } from '@/types';

// ─── Response types ───────────────────────────────────────────────────────────
// These match the Prisma BuilderSection / BuilderPage shapes returned by the API.

export interface ApiBuilderSection {
  id: string;
  sectionType: string;
  label: string;
  sortOrder: number;
  isEnabled: boolean;
  isLocked: boolean;
  status: string;
  config: Record<string, unknown>;
  goLiveAt: string | null;
  expireAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiBuilderPage {
  id: string;
  pageType: string;
  slug: string;
  name: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sections: ApiBuilderSection[];
}

export interface PageSummary {
  id: string;
  pageType: string;
  slug: string;
  name: string;
  status: string;
  publishedAt: string | null;
  updatedAt: string;
  _count: { sections: number };
}

export interface ReorderItem {
  id: string;
  sortOrder: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

const BASE = '/page-builder';

export const pageBuilderService = {
  /**
   * GET /page-builder/homepage
   * Returns the homepage page + sections. Auto-seeds on first call.
   */
  getHomepage: (): Promise<ApiResponse<ApiBuilderPage>> =>
    api.get(`${BASE}/homepage`),

  /**
   * POST /page-builder/homepage/seed
   * Re-seeds default Aurus sections (idempotent — skips existing).
   */
  seedHomepage: (): Promise<ApiResponse<ApiBuilderPage>> =>
    api.post(`${BASE}/homepage/seed`),

  /**
   * GET /page-builder/pages
   * List all builder pages for the current store (summary, no sections).
   */
  listPages: (): Promise<ApiResponse<PageSummary[]>> =>
    api.get(`${BASE}/pages`),

  /**
   * GET /page-builder/pages/:pageType/:slug
   * Get a specific page with all sections.
   */
  getPage: (pageType: string, slug: string): Promise<ApiResponse<ApiBuilderPage>> =>
    api.get(`${BASE}/pages/${pageType}/${slug}`),

  /**
   * PATCH /page-builder/sections/:id/toggle
   * Toggle the section's isEnabled flag.
   */
  toggleSection: (id: string): Promise<ApiResponse<ApiBuilderSection>> =>
    api.patch(`${BASE}/sections/${id}/toggle`),

  /**
   * PATCH /page-builder/sections/:id
   * Update a section's label, status, config, goLiveAt, or expireAt.
   */
  updateSection: (
    id: string,
    data: Partial<Pick<ApiBuilderSection, 'label' | 'status' | 'isEnabled' | 'config' | 'goLiveAt' | 'expireAt'>>,
  ): Promise<ApiResponse<ApiBuilderSection>> =>
    api.patch(`${BASE}/sections/${id}`, data),

  /**
   * GET /page-builder/sections/:id
   * Get a single section with its full config — used by section editors.
   */
  getSection: (id: string): Promise<ApiResponse<ApiBuilderSection>> =>
    api.get(`${BASE}/sections/${id}`),

  /**
   * PUT /page-builder/sections/reorder
   * Bulk-update sortOrder for multiple sections.
   */
  reorderSections: (sections: ReorderItem[]): Promise<ApiResponse<{ message: string; count: number }>> =>
    api.put(`${BASE}/sections/reorder`, { sections }),
};
