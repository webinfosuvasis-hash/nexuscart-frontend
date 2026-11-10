// Phase 9 — Dynamic Storefront Navigation Integration.
// Response shapes produced by StorefrontMenuService — the fully-resolved,
// render-ready twin of the raw Menu/MenuItem rows. Nothing here is persisted;
// it's assembled fresh (then cached) from Menu/MenuItem plus whichever
// Category/Product/Brand/CmsPage/Collection rows a structured link points at.

export type MenuLinkType =
  | 'CATEGORY'
  | 'PRODUCT'
  | 'BRAND'
  | 'CMS_PAGE'
  | 'COLLECTION'
  | 'EXTERNAL_URL';

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

/** Raw shape of MenuItem.megaMenu JSON, as authored by the admin. */
export interface MegaMenuInput {
  image?: string | null;
  icon?: string | null;
  banner?: { image?: string | null; link?: string | null; text?: string | null } | null;
  badge?: MenuBadge | null;
  featuredProductIds?: string[];
  featuredCategoryIds?: string[];
}
