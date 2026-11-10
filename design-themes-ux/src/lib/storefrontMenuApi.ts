/**
 * storefrontMenuApi.ts — Phase 9 (Dynamic Storefront Navigation).
 * Talks to the new public StorefrontMenuController
 * (`/storefront/menu`, `/storefront/menus/:handle`). Reuses
 * `fetchStorefrontPath` from storefrontApi.ts — no fetch/header/error-
 * handling logic is duplicated here.
 */

import { fetchStorefrontPath, ApiError } from './storefrontApi';

export type MenuLinkType = 'CATEGORY' | 'PRODUCT' | 'BRAND' | 'CMS_PAGE' | 'COLLECTION' | 'EXTERNAL_URL';
export type MenuBadge = 'NEW' | 'SALE';

export interface MegaMenuFeaturedProduct {
  id: string;
  name: string;
  slug: string;
  thumbnail: string | null;
  price: number;
  comparePrice: number | null;
}

export interface MegaMenuFeaturedCategory {
  id: string;
  name: string;
  slug: string;
  image: string | null;
}

export interface ResolvedMegaMenu {
  image: string | null;
  icon: string | null;
  banner: { image: string | null; link: string | null; text: string | null } | null;
  badge: MenuBadge | null;
  featuredProducts: MegaMenuFeaturedProduct[];
  featuredCategories: MegaMenuFeaturedCategory[];
}

export interface ResolvedMenuItem {
  id: string;
  label: string;
  url: string;
  linkType: MenuLinkType;
  megaMenu: ResolvedMegaMenu | null;
  children: ResolvedMenuItem[];
}

export interface ResolvedMenu {
  id: string;
  handle: string;
  name: string;
  items: ResolvedMenuItem[];
}

export const fetchDefaultMenu = (): Promise<ResolvedMenu | null> =>
  fetchStorefrontPath<ResolvedMenu | null>('/storefront/menu');

export const fetchMenuByHandle = (handle: string): Promise<ResolvedMenu | null> =>
  fetchStorefrontPath<ResolvedMenu | null>(`/storefront/menus/${encodeURIComponent(handle)}`);

export { ApiError };
