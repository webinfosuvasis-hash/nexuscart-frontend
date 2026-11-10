/**
 * storefrontCmsApi.ts — public CMS pages (`GET /storefront/pages/:slug`).
 * The menu resolver emits `/pages/:slug` for CMS_PAGE links; this is what
 * that route loads. Reuses `fetchStorefrontPath` — no duplicated fetch logic.
 */

import { fetchStorefrontPath, ApiError } from './storefrontApi';

/** One admin-authored section. `settings` is free-form JSON from the CMS builder. */
export interface CmsPageSection {
  id:       string;
  type:     string;
  name:     string;
  settings: Record<string, unknown> | null;
  order:    number;
}

export interface CmsPage {
  id:          string;
  title:       string;
  slug:        string;
  seoTitle:    string | null;
  seoDesc:     string | null;
  ogImage:     string | null;
  publishedAt: string | null;
  sections:    CmsPageSection[];
}

export const fetchCmsPage = (slug: string): Promise<CmsPage> =>
  fetchStorefrontPath<CmsPage>(`/storefront/pages/${encodeURIComponent(slug)}`);

export { ApiError };
