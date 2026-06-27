/**
 * Phase 7 — Legacy section primitive registration
 *
 * Registers all legacy section types in the NodeRenderer registry so they
 * render with real UI instead of the Unknown fallback when nodeMode is active.
 *
 * Called once as a side-effect import from src/components/node-renderer/index.ts.
 *
 * Registered types:
 *
 *   Page structure:
 *     page_root, page_group
 *
 *   Full-section wrappers (use SectionRenderProps with themeConfig):
 *     hero, newsletter, announcement_bar
 *
 *   Simple wrappers ({ section: SectionDoc }):
 *     brand_story, editorial_banner, collection_circles,
 *     product_mosaic, trust_badges_bar
 *
 *   Shell wrappers (semantic containers that pass through children):
 *     header, footer
 *
 *   Content-section override (replaces RichText alias — version 1.1.0):
 *     rich_text
 *
 * Types already registered (not touched here):
 *   featured_collection, product_grid, collection_grid, carousel,
 *   container, stack, grid, columns, spacer, divider,
 *   heading, text, paragraph, richtext, image, button,
 *   and all PDP primitives.
 */

import { registerAll } from '../registry';
import {
  PageRootNode,
  PageGroupNode,
  HeroSectionNode,
  NewsletterSectionNode,
  AnnouncementBarSectionNode,
  BrandStorySectionNode,
  EditorialBannerSectionNode,
  CollectionCirclesSectionNode,
  ProductMosaicSectionNode,
  TrustBadgesBarSectionNode,
  HeaderSectionNode,
  FooterSectionNode,
  RichTextSectionNode,
} from './LegacySectionNodes';

// Phase 8: header/footer child block primitives
import {
  AnnouncementBlock,
  LogoBlock,
  MenuBlock,
  SearchBlock,
  CartIconBlock,
  AccountBlock,
  CopyrightBlock,
  FooterColumnBlock,
  BrandBlock,
  NavColumnBlock,
  NewsletterFormBlock,
  PaymentBadgesBlock,
  SocialLinksBlock,
} from './HeaderFooterBlocks';

export function registerLegacySections(): void {
  // ── Page structure ────────────────────────────────────────────────────────
  registerAll(
    { page_root: PageRootNode, page_group: PageGroupNode },
    { source: 'platform', category: 'layout', version: '1.0.0' },
  );

  // ── Full-section wrappers ─────────────────────────────────────────────────
  registerAll(
    {
      hero:             HeroSectionNode,
      newsletter:       NewsletterSectionNode,
      announcement_bar: AnnouncementBarSectionNode,
    },
    { source: 'platform', category: 'content', version: '1.0.0' },
  );

  // ── Simple wrappers ───────────────────────────────────────────────────────
  registerAll(
    {
      brand_story:        BrandStorySectionNode,
      editorial_banner:   EditorialBannerSectionNode,
      collection_circles: CollectionCirclesSectionNode,
      product_mosaic:     ProductMosaicSectionNode,
      trust_badges_bar:   TrustBadgesBarSectionNode,
    },
    { source: 'platform', category: 'content', version: '1.0.0' },
  );

  // ── Shell wrappers ────────────────────────────────────────────────────────
  registerAll(
    { header: HeaderSectionNode, footer: FooterSectionNode },
    { source: 'platform', category: 'layout', version: '1.0.0' },
  );

  // ── Rich text section — overrides existing RichText content-primitive alias ─
  // Uses version 1.1.0 to replace the 1.0.0 alias registered in the main index.
  registerAll(
    { rich_text: RichTextSectionNode },
    { source: 'platform', category: 'content', version: '1.1.0' },
  );

  // ── Phase 8: Header/Footer child block primitives ─────────────────────────
  // Eliminates Unknown fallback for block nodes inside header and footer trees.

  // Announcement bar
  registerAll(
    { announcement: AnnouncementBlock },
    { source: 'platform', category: 'content', version: '1.0.0' },
  );

  // Header blocks
  registerAll(
    {
      logo:      LogoBlock,
      menu:      MenuBlock,
      search:    SearchBlock,
      cart:      CartIconBlock,
      cart_icon: CartIconBlock,   // alias used in some themes
      account:   AccountBlock,
    },
    { source: 'platform', category: 'content', version: '1.0.0' },
  );

  // Footer blocks
  registerAll(
    {
      copyright:       CopyrightBlock,
      footer_column:   FooterColumnBlock,
      brand_block:     BrandBlock,
      nav_column:      NavColumnBlock,
      newsletter_form: NewsletterFormBlock,
      payment_badges:  PaymentBadgesBlock,
      social_links:    SocialLinksBlock,
    },
    { source: 'platform', category: 'content', version: '1.0.0' },
  );
}
