/**
 * SectionRegistry.ts
 *
 * Central registry for all page section definitions used by the Page Builder.
 * This file is the single source of truth for:
 *   - Strongly typed section type identifiers (SECTION_TYPE)
 *   - Phase 2 config type documentation (one interface per section)
 *   - Section metadata (label, icon, lock status, supported page types)
 *   - The ordered Aurus homepage section list (AURUS_HOMEPAGE_SECTIONS)
 *
 * As the platform grows, new section types are registered here and become
 * available to any page type (homepage, collection, landing, blog, etc.).
 */

import type { LucideIcon } from 'lucide-react';
import {
  Image, ShoppingBag, Megaphone, Gift, Grid3X3, Shield,
  Layers, Heart, LayoutDashboard, MapPin, Home, Video,
  Package, Tag, HelpCircle, Globe, Mail,
} from 'lucide-react';
import type { BuilderSectionStatus, PageType } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION TYPE — strongly typed constant enum
// Use SECTION_TYPE.HERO_BANNER instead of the raw string 'hero_banner'
// to get compile-time safety across the entire codebase.
// ─────────────────────────────────────────────────────────────────────────────

export const SECTION_TYPE = {
  HERO_BANNER:        'hero_banner',
  FEATURED_PRODUCTS:  'featured_products',
  CAMPAIGN_GRID:      'campaign_grid',
  CATEGORY_DISCOVERY: 'category_discovery',
  CATEGORY_ICONS:     'category_icons',
  TRUST_BADGES:       'trust_badges',
  COLLECTIONS:        'collections',
  BRIDAL_SECTION:     'bridal_section',
  EDITORIAL_BANNERS:  'editorial_banners',
  STORE_LOCATOR:      'store_locator',
  TRY_AT_HOME:        'try_at_home',
  VIDEO_CALL:         'video_call',
  GIFT_REGISTRY:      'gift_registry',
  PROMOTIONAL_CARDS:  'promotional_cards',
  EXPERT_HELP:        'expert_help',
  SOCIAL_UGC:         'social_ugc',
  NEWSLETTER:         'newsletter',
} as const;

/** Union type of all valid section type string values. */
export type SectionType = (typeof SECTION_TYPE)[keyof typeof SECTION_TYPE];

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 CONFIG TYPES
//
// These interfaces document the expected shape of each section's `config`
// JSON field. They are NOT used at runtime in Phase 1A — they exist here
// so that Phase 2 editors and backend validation can reference a single
// authoritative definition.
//
// Each interface is tagged with @phase to indicate when it will be wired up.
// ─────────────────────────────────────────────────────────────────────────────

/** Shared base for all section configs. Phase 2 editors extend this. */
interface BaseSectionConfig {
  /** Optional merchant note — internal only, not rendered on storefront. */
  _note?: string;
}

// ── Section 1 ─────────────────────────────────────────────────────────────────

/** @phase 2 */
export interface HeroSlide {
  id: string;
  type: 'banner' | 'editorial';
  isEnabled: boolean;
  // Banner slide — pre-designed image, text baked in
  src?: string;
  alt?: string;
  linkUrl?: string;
  // Editorial slide — full-bleed photo + gradient overlay + HTML text
  backgroundImage?: string;
  overlayGradient?: { from: string; to: string; direction: string };
  eyebrowText?: string;
  brandName?: string;
  headlineL1?: string;
  headlineL2?: string;
  headlineL2Color?: string;
  disclaimer?: string;
  ctaText?: string;
  ctaUrl?: string;
}

/** @phase 2 */
export interface HeroConfig extends BaseSectionConfig {
  slides: HeroSlide[];
  autoRotate: boolean;
  autoRotateSpeed: number;   // seconds, default 4.5
  indicatorStyle: 'dots' | 'pill-counter';
  cornerRadius: number;      // px, default 16
  sideMargin: number;        // px, default 24
  height: number;            // px desktop, default 500
  mobileHeight: number;      // px mobile, default 300
}

// ── Section 2 ─────────────────────────────────────────────────────────────────

/** @phase 2 */
export interface FeaturedProductsConfig extends BaseSectionConfig {
  leftPanel: {
    image: string;
    alt?: string;
    linkUrl?: string;
    overlayOpacity: number;  // 0–1, default 0.15
  };
  rightPanel: {
    backgroundColor: string;
    heading?: string;
    productSource: 'manual' | 'tag' | 'category' | 'collection';
    productIds?: string[];
    tag?: string;
    categoryId?: string;
    collectionId?: string;
    maxProducts: number;     // default 12
    visibleCount: number;    // default 4
    arrowColor?: string;
    ctaText: string;
    ctaUrl: string;
    ctaStyle: 'filled' | 'outlined' | 'rounded-filled';
  };
}

// ── Section 3 ─────────────────────────────────────────────────────────────────

/** @phase 2 */
export interface CampaignGridConfig extends BaseSectionConfig {
  leftPanel: {
    backgroundColor: string;
    brandLabel1: string;
    brandLabel2?: string;
    craftNote?: string;
    productIds: string[];    // 4 products for 2×2 grid
    saleHeadline: string;
    offerText: string;
    offerSubtitle?: string;
    disclaimer?: string;
  };
  topRightPanel: {
    backgroundGradient: { from: string; to: string; angle: number };
    modelImage?: string;
    brandLabel: string;
    headline: string;
    headlineSuperscript?: string;
    subtitle?: string;
    productIds: string[];    // up to 3 thumbnails
    bodyNote?: string;
    disclaimer?: string;
  };
  bottomRightPanel: {
    backgroundColor: string;
    floatingProductIds: string[];  // up to 2
    subLabel?: string;
    headlinePart1: string;   // bold sans
    headlinePart2: string;   // italic serif
    ctaText: string;
    ctaUrl: string;
  };
}

// ── Section 4 ─────────────────────────────────────────────────────────────────

/** @phase 2 */
export interface CategoryDiscoveryCard {
  id: string;
  categoryId?: string;       // if linked to Categories module
  image: string;
  label: string;
  linkUrl: string;
}

/** @phase 2 */
export interface CategoryDiscoveryConfig extends BaseSectionConfig {
  backgroundColor: string;
  borderColor?: string;
  leftBlock: {
    icon: string;            // emoji e.g. '🎁' or lucide icon name
    iconBgGradient: { from: string; to: string };
    label: string;
  };
  cards: CategoryDiscoveryCard[];
  maxVisible: number;
  cardWidth: number;         // px, default 158
  cardCornerRadius: number;  // px, default 16
}

// ── Section 5 ─────────────────────────────────────────────────────────────────

/** @phase 2 */
export interface CategoryIconEntry {
  id: string;
  categoryId?: string;
  image: string;
  label: string;
  linkUrl: string;
}

/** @phase 2 */
export interface CategoryIconsConfig extends BaseSectionConfig {
  icons: CategoryIconEntry[];
  iconShape: 'circle' | 'rounded-square';
  iconSize: number;          // px, default 64
  borderColor: string;
  hoverBorderColor: string;
  backgroundColor: string;
  labelColor: string;
  labelSize: number;         // px, default 11
}

// ── Section 6 ─────────────────────────────────────────────────────────────────

/**
 * @phase N/A
 * Trust Badge Bar is managed globally from Theme Engine → Trust Badges.
 * This config type is defined for documentation purposes only.
 * The section is rendered read-only in the Homepage Builder.
 */
export interface TrustBadgesConfig {
  _managedBy: 'theme_engine';
}

// ── Section 7 ─────────────────────────────────────────────────────────────────

/** @phase 2 */
export interface CollectionSlot {
  collectionId: string;
  customName?: string;       // overrides collection.name
  customSubLabel?: string;
  customImage?: string;      // overrides collection.image
}

/** @phase 2 */
export interface CollectionsConfig extends BaseSectionConfig {
  backgroundColor: string;
  heading: string;
  ctaText: string;
  ctaUrl: string;
  ctaButtonColor: string;
  slots: CollectionSlot[];   // max 5 for Aurus
}

// ── Section 8 ─────────────────────────────────────────────────────────────────

/** @phase 2 */
export interface BridalSectionConfig extends BaseSectionConfig {
  leftPanel: {
    backgroundImage: string;
    fallbackColor: string;
    warmOverlayColor?: string;
    warmOverlayOpacity?: number;
    bottomGradient?: string;
    headlineL1: string;
    headlineL2?: string;
    headlineFont: 'serif' | 'sans';
    ctaText: string;
    ctaUrl: string;
  };
  rightPanel: {
    backgroundColor: string;
    productSource: 'manual' | 'collection' | 'tag';
    productIds?: string[];
    collectionId?: string;
    tag?: string;
    maxProducts: number;
    visibleCount: number;    // default 4
    arrowColor?: string;
    ctaText: string;
    ctaUrl: string;
  };
}

// ── Section 9 ─────────────────────────────────────────────────────────────────

/** @phase 2 */
export interface EditorialBannerCard {
  id: string;
  isEnabled: boolean;
  backgroundType: 'solid' | 'gradient';
  backgroundColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  gradientAngle?: number;
  categoryLabel?: string;
  headline: string;
  subHeadline?: string;
  ctaText: string;
  ctaUrl: string;
  ctaStyle: 'filled-dark' | 'filled-white' | 'outlined' | 'text';
  disclaimer?: string;
  floatingProductIds?: string[];  // up to 2
  floatingBlendMode?: 'multiply' | 'normal';
  // Phase 4: individual card scheduling
  goLiveAt?: string;
  expireAt?: string;
}

/** @phase 2 */
export interface EditorialBannersConfig extends BaseSectionConfig {
  cards: EditorialBannerCard[];
  cardsPerPage: number;      // always 3 for Aurus
  showDots: boolean;
  showArrows: boolean;
  arrowColor?: string;
}

// ── Section 10 ────────────────────────────────────────────────────────────────

/** @phase 2 */
export interface StoreLocatorConfig extends BaseSectionConfig {
  leftPanel: {
    mediaType: 'image' | 'video';
    image?: string;
    videoUrl?: string;
    showPlayButton?: boolean;
    overlayOpacity?: number;
  };
  rightPanel: {
    backgroundColor: string;
    headlineL1: string;
    headlineL2?: string;
    inputPlaceholder: string;
    ctaLabel: string;
    ctaColor: string;
  };
}

// ── Section 11 ────────────────────────────────────────────────────────────────

/** @phase 2 */
export interface TryAtHomeConfig extends BaseSectionConfig {
  backgroundImage: string;
  gradientOverlay?: string;
  headlineL1: string;
  headlineL2?: string;
  ctaText: string;
  ctaUrl: string;
  ctaStyle: 'dark-glass' | 'filled' | 'outlined';
  minHeight: number;         // px, default 380
}

// ── Section 12 ────────────────────────────────────────────────────────────────

/** @phase 2 */
export interface VideoCallConfig extends BaseSectionConfig {
  backgroundImage: string;
  gradientColor?: string;
  gradientOpacity?: number;
  headlineL1: string;
  headlineL2?: string;
  ctaText: string;
  ctaUrl: string;
  ctaStyle: 'dark-glass' | 'filled' | 'outlined';
}

// ── Section 13 ────────────────────────────────────────────────────────────────

/** @phase 2 */
export interface GiftRegistryStep {
  icon: string;              // emoji
  title: string;
  description: string;
}

/** @phase 2 */
export interface GiftRegistryConfig extends BaseSectionConfig {
  backgroundGradient?: { from: string; mid: string; to: string };
  leftColumn: {
    occasionLabel: string;
    headline: string;
    bodyCopy: string;
    occasionTags: string[];  // e.g. ['🤝 Wedding', '🪔 Puja', '✨ Party']
    ctaText: string;
    ctaUrl: string;
    socialProofText?: string;
    socialProofSub?: string;
  };
  centerColumn: {
    centerIcon: string;      // emoji, e.g. '🎁'
    floatingIcons: Array<{ icon: string; position: string }>;
    showGlow: boolean;
  };
  rightColumn: {
    columnLabel: string;
    steps: GiftRegistryStep[];  // max 5
  };
}

// ── Section 14 ────────────────────────────────────────────────────────────────

/** @phase 2 */
export interface PromotionalCard {
  id: string;
  isEnabled: boolean;
  backgroundType: 'solid' | 'gradient';
  backgroundColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  gradientAngle?: number;
  icon?: string;             // emoji
  categoryLabel?: string;
  headline: string;
  ctaText: string;
  ctaUrl: string;
  ctaStyle: 'filled-white' | 'filled-dark' | 'rounded-white';
  disclaimer?: string;
  campaignId?: string;       // optional link to Marketing → Campaigns
  // Phase 4: per-card scheduling
  goLiveAt?: string;
  expireAt?: string;
}

/** @phase 2 */
export interface PromotionalCardsConfig extends BaseSectionConfig {
  cards: PromotionalCard[];
  cardsPerPage: number;      // always 3 for Aurus
}

// ── Section 15 ────────────────────────────────────────────────────────────────

/** @phase 2 */
export interface ExpertHelpConfig extends BaseSectionConfig {
  backgroundColor?: string;
  storeLocatorCard: {
    storeImage?: string;
    overlayColor?: string;
    overlayOpacity?: number;
    storeCountText: string;
    headline: string;
    headlineL2?: string;
    ctaText: string;
    ctaUrl: string;
  };
  expertHelpCard: {
    backgroundColor: string;
    label: string;
    headline: string;
    ctaText: string;
    ctaUrl: string;
    icon?: string;           // lucide icon name
  };
  videoCallCard: {
    backgroundColor: string;
    label: string;
    headline: string;
    ctaText: string;
    ctaUrl: string;
    icon?: string;           // lucide icon name
  };
}

// ── Section 16 ────────────────────────────────────────────────────────────────

/** @phase 2 */
export interface SocialUGCConfig extends BaseSectionConfig {
  backgroundColor?: string;
  header: {
    label: string;
    headlineL1: string;
    prizeText?: string;
    subText?: string;
  };
  mosaicImages: Array<{
    slot: 1 | 2 | 3 | 4 | 5 | 6 | 7;
    image: string;
    alt?: string;
    linkUrl?: string;
  }>;
  bottomBar: {
    hashtagText: string;
    handle?: string;
    textColor?: string;
  };
}

// ── Section 17 ────────────────────────────────────────────────────────────────

/** @phase 2 */
export interface NewsletterConfig extends BaseSectionConfig {
  backgroundType: 'gradient' | 'solid';
  backgroundGradient?: { from: string; to: string; direction: string };
  backgroundColor?: string;
  label: string;
  headline: string;
  bodyCopy: string;
  inputPlaceholder: string;
  ctaText: string;
  ctaColor?: string;
  ctaTextColor?: string;
  privacyText?: string;
  privacyUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION CONFIG MAP
// Maps each SectionType to its Phase 2 config interface.
// Used for generic typing in Phase 2 editors.
// ─────────────────────────────────────────────────────────────────────────────

export interface SectionConfigMap {
  hero_banner:        HeroConfig;
  featured_products:  FeaturedProductsConfig;
  campaign_grid:      CampaignGridConfig;
  category_discovery: CategoryDiscoveryConfig;
  category_icons:     CategoryIconsConfig;
  trust_badges:       TrustBadgesConfig;
  collections:        CollectionsConfig;
  bridal_section:     BridalSectionConfig;
  editorial_banners:  EditorialBannersConfig;
  store_locator:      StoreLocatorConfig;
  try_at_home:        TryAtHomeConfig;
  video_call:         VideoCallConfig;
  gift_registry:      GiftRegistryConfig;
  promotional_cards:  PromotionalCardsConfig;
  expert_help:        ExpertHelpConfig;
  social_ugc:         SocialUGCConfig;
  newsletter:         NewsletterConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION DEFINITION
// Runtime metadata for each section type.
// ─────────────────────────────────────────────────────────────────────────────

export interface SectionDefinition {
  /** Unique identifier — matches SectionType. */
  type: SectionType;
  /** Display label shown in the admin UI. */
  label: string;
  /** Short description of what this section shows on the storefront. */
  description: string;
  /** Lucide icon for the thumbnail placeholder in the Overview. */
  icon: LucideIcon;
  /** Tailwind classes for the thumbnail background and icon color. */
  iconColor: string;
  /**
   * If true, this section cannot be edited inside the Page Builder.
   * Content is managed from another module (e.g. Theme Engine).
   */
  isLocked: boolean;
  /** Shown when the section row is locked, explaining where to edit it. */
  lockSource?: string;
  /** Default visibility state when the section is first seeded. */
  defaultEnabled: boolean;
  /** Default publish status when the section is first seeded. */
  defaultStatus: BuilderSectionStatus;
  /** Which page types this section can appear on. */
  supportedPageTypes: PageType[];
  /**
   * Which implementation phase wires up this section's configuration screen.
   * 'P1A' = Overview only (Phase 1A)
   * 'P2'  = Full section editor (Phase 2)
   */
  configPhase: 'P1A' | 'P2' | 'P3' | 'P4';
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION REGISTRY — Aurus Homepage
// Ordered list of all sections on the Aurus homepage.
// sortOrder is determined by array index (0-based).
// ─────────────────────────────────────────────────────────────────────────────

export const AURUS_HOMEPAGE_SECTIONS: SectionDefinition[] = [
  {
    type: SECTION_TYPE.HERO_BANNER,
    label: 'Hero Banner Carousel',
    description: 'Full-width rotating banner with editorial and promotional slides',
    icon: Image,
    iconColor: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    isLocked: false,
    defaultEnabled: true,
    defaultStatus: 'LIVE',
    supportedPageTypes: ['home', 'landing'],
    configPhase: 'P2',
  },
  {
    type: SECTION_TYPE.FEATURED_PRODUCTS,
    label: 'Featured Products',
    description: 'Split panel — editorial image on left, product carousel on right',
    icon: ShoppingBag,
    iconColor: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    isLocked: false,
    defaultEnabled: true,
    defaultStatus: 'LIVE',
    supportedPageTypes: ['home', 'collection', 'landing'],
    configPhase: 'P2',
  },
  {
    type: SECTION_TYPE.CAMPAIGN_GRID,
    label: 'Campaign Grid',
    description: '3-panel campaign layout — full-height left + stacked right panels',
    icon: Megaphone,
    iconColor: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
    isLocked: false,
    defaultEnabled: true,
    defaultStatus: 'LIVE',
    supportedPageTypes: ['home', 'landing'],
    configPhase: 'P2',
  },
  {
    type: SECTION_TYPE.CATEGORY_DISCOVERY,
    label: 'Category Discovery',
    description: 'Lavender gift section with horizontally scrollable category cards',
    icon: Gift,
    iconColor: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    isLocked: false,
    defaultEnabled: true,
    defaultStatus: 'LIVE',
    supportedPageTypes: ['home'],
    configPhase: 'P2',
  },
  {
    type: SECTION_TYPE.CATEGORY_ICONS,
    label: 'Category Icons',
    description: 'Horizontal strip of circular category icons with labels',
    icon: Grid3X3,
    iconColor: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
    isLocked: false,
    defaultEnabled: true,
    defaultStatus: 'LIVE',
    supportedPageTypes: ['home'],
    configPhase: 'P2',
  },
  {
    type: SECTION_TYPE.TRUST_BADGES,
    label: 'Trust Badge Bar',
    description: '4 trust badges — Authentic Fabrics, Returns, Shipping, Support',
    icon: Shield,
    iconColor: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
    isLocked: true,
    lockSource: 'Theme Engine → Trust Badges',
    defaultEnabled: true,
    defaultStatus: 'LIVE',
    supportedPageTypes: ['home', 'collection', 'product', 'landing', 'blog', 'checkout', 'custom'],
    configPhase: 'P1A',
  },
  {
    type: SECTION_TYPE.COLLECTIONS,
    label: 'Collections',
    description: '5 portrait editorial collection cards — Dashta, Leher, Adaa, Aneka, Eternity',
    icon: Layers,
    iconColor: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
    isLocked: false,
    defaultEnabled: true,
    defaultStatus: 'LIVE',
    supportedPageTypes: ['home', 'landing'],
    configPhase: 'P2',
  },
  {
    type: SECTION_TYPE.BRIDAL_SECTION,
    label: 'Bridal Section',
    description: 'Split panel — bridal editorial photo + product carousel',
    icon: Heart,
    iconColor: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
    isLocked: false,
    defaultEnabled: true,
    defaultStatus: 'LIVE',
    supportedPageTypes: ['home', 'landing'],
    configPhase: 'P2',
  },
  {
    type: SECTION_TYPE.EDITORIAL_BANNERS,
    label: 'Editorial Banners',
    description: '3-panel editorial banner carousel — 9KT Gold, Golden Hour, Pretty in Purple',
    icon: LayoutDashboard,
    iconColor: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    isLocked: false,
    defaultEnabled: true,
    defaultStatus: 'LIVE',
    supportedPageTypes: ['home', 'landing'],
    configPhase: 'P2',
  },
  {
    type: SECTION_TYPE.STORE_LOCATOR,
    label: 'Store Locator',
    description: 'Split panel — lifestyle image/video + pincode search form',
    icon: MapPin,
    iconColor: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
    isLocked: false,
    defaultEnabled: true,
    defaultStatus: 'LIVE',
    supportedPageTypes: ['home', 'landing'],
    configPhase: 'P2',
  },
  {
    type: SECTION_TYPE.TRY_AT_HOME,
    label: 'Try at Home',
    description: 'Full-height service card — "Book a Trial at Home" CTA',
    icon: Home,
    iconColor: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    isLocked: false,
    defaultEnabled: true,
    defaultStatus: 'LIVE',
    supportedPageTypes: ['home', 'product', 'landing'],
    configPhase: 'P2',
  },
  {
    type: SECTION_TYPE.VIDEO_CALL,
    label: 'Video Call',
    description: 'Full-height service card — "Schedule a Video Call" CTA',
    icon: Video,
    iconColor: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    isLocked: false,
    defaultEnabled: true,
    defaultStatus: 'LIVE',
    supportedPageTypes: ['home', 'product', 'landing'],
    configPhase: 'P2',
  },
  {
    type: SECTION_TYPE.GIFT_REGISTRY,
    label: 'Gift Registry',
    description: '3-column section — copy, illustration, and how-it-works steps',
    icon: Package,
    iconColor: 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-400',
    isLocked: false,
    defaultEnabled: true,
    defaultStatus: 'LIVE',
    supportedPageTypes: ['home', 'landing'],
    configPhase: 'P2',
  },
  {
    type: SECTION_TYPE.PROMOTIONAL_CARDS,
    label: 'Promotional Cards',
    description: '3-card paginated carousel — Treasure Chest, Silver, Gold Exchange',
    icon: Tag,
    iconColor: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    isLocked: false,
    defaultEnabled: true,
    defaultStatus: 'LIVE',
    supportedPageTypes: ['home', 'landing'],
    configPhase: 'P2',
  },
  {
    type: SECTION_TYPE.EXPERT_HELP,
    label: 'Expert Help',
    description: 'Dark panel — store locator + expert help + video call service cards',
    icon: HelpCircle,
    iconColor: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
    isLocked: false,
    defaultEnabled: true,
    defaultStatus: 'LIVE',
    supportedPageTypes: ['home', 'landing'],
    configPhase: 'P2',
  },
  {
    type: SECTION_TYPE.SOCIAL_UGC,
    label: 'Social / UGC',
    description: 'Dark mosaic grid — #MyAurusStory Instagram UGC showcase',
    icon: Globe,
    iconColor: 'bg-lime-100 text-lime-600 dark:bg-lime-900/30 dark:text-lime-400',
    isLocked: false,
    defaultEnabled: true,
    defaultStatus: 'LIVE',
    supportedPageTypes: ['home', 'landing'],
    configPhase: 'P2',
  },
  {
    type: SECTION_TYPE.NEWSLETTER,
    label: 'Newsletter',
    description: 'Purple gradient section — "Join Aurus Insider" email subscription',
    icon: Mail,
    iconColor: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    isLocked: false,
    defaultEnabled: true,
    defaultStatus: 'LIVE',
    supportedPageTypes: ['home', 'collection', 'landing', 'blog'],
    configPhase: 'P2',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Look up a section definition by its type string. Returns undefined if not found. */
export function getSectionDefinition(type: SectionType): SectionDefinition | undefined {
  return AURUS_HOMEPAGE_SECTIONS.find((s) => s.type === type);
}

/** Returns true if the given string is a valid SectionType. */
export function isSectionType(value: string): value is SectionType {
  return Object.values(SECTION_TYPE).includes(value as SectionType);
}
