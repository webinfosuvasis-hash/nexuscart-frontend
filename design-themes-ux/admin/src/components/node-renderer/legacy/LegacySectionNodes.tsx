/**
 * Phase 7 — Legacy section node primitives
 *
 * Node-compatible wrappers that bridge the gap between the ContentNode model
 * and the existing storefront section components.  Each wrapper:
 *
 *   1. Accepts NodeProps  (the ContentNode contract)
 *   2. Converts `node → SectionDoc` via nodeToSectionDoc() (Phase 0 adapter)
 *   3. Renders the corresponding storefront section component
 *
 * This eliminates the Unknown fallback for legacy section types in node mode
 * without touching SimulatedCanvas.tsx or the legacy rendering path.
 *
 * Groups:
 *
 *   PAGE STRUCTURE — page_root, page_group
 *     Render their NodeRenderer-recursed children in a semantic container.
 *
 *   FULL-SECTION WRAPPERS (SectionRenderProps)
 *     hero, newsletter, announcement_bar
 *     themeConfig is derived from ctx.themeTokens (editor injects these).
 *
 *   SIMPLE WRAPPERS ({ section: SectionDoc })
 *     brand_story, editorial_banner, collection_circles,
 *     product_mosaic, trust_badges_bar
 *
 *   SHELL WRAPPERS (header, footer)
 *     header and footer nodes contain block children (logo, menu, copyright).
 *     In node mode the editor already shows them via SystemSectionShell, so
 *     these primitives only need to exist for the public preview TreeRenderer.
 *     They render a semantic element and pass through their recursed children.
 *
 *   RICH TEXT SECTION (rich_text)
 *     Overrides the existing RichText content-primitive alias (version 1.1.0)
 *     so the section type renders a centered text container with its block
 *     children (heading, paragraph, button) instead of raw HTML.
 */

import React from 'react';
import type { NodeProps, RenderContext } from '../types';

// ─── Phase 0 adapter ──────────────────────────────────────────────────────────

import { nodeToSectionDoc } from '@/admin/editor/adapters/sectionNodeAdapter';

// ─── Storefront section components ───────────────────────────────────────────

// Group A: take SectionRenderProps { section, themeConfig, storeName }
import HeroSection                    from '@/components/storefront/sections/HeroSection';
import NewsletterSection              from '@/components/storefront/sections/NewsletterSection';
import TemplateAnnouncementBarSection from '@/components/storefront/sections/TemplateAnnouncementBarSection';

// Group B: take { section: SectionDoc }
import CollectionCirclesSection from '@/components/storefront/sections/CollectionCirclesSection';
import ProductMosaicSection     from '@/components/storefront/sections/ProductMosaicSection';
import EditorialBannerSection   from '@/components/storefront/sections/EditorialBannerSection';
import TrustBadgesBarSection    from '@/components/storefront/sections/TrustBadgesBarSection';
import BrandStorySection        from '@/components/storefront/sections/BrandStorySection';

// ─── themeConfig builder ──────────────────────────────────────────────────────
// Storefront SectionRenderProps components expect a themeConfig object.
// We derive it from ctx.themeTokens (provided by RenderContextProvider).

const DEFAULT_COLORS = {
  primary:    '#4f46e5',
  secondary:  '#f5f5f5',
  accent:     '#f59e0b',
  background: '#ffffff',
  text:       '#1a1a1a',
  surface:    '#f9fafb',
};

const DEFAULT_TYPOGRAPHY = {
  headingFont: 'Plus Jakarta Sans',
  bodyFont:    'Inter',
  baseSizeRem: 1,
  lineHeight:  1.5,
};

const DEFAULT_LAYOUT = {
  stickyHeader:  true,
  sidebarCart:   false,
  megaMenu:      false,
  backToTop:     false,
  cookieConsent: false,
};

function buildThemeConfig(ctx: RenderContext) {
  return {
    colors:     { ...DEFAULT_COLORS,     ...ctx.themeTokens },
    typography: DEFAULT_TYPOGRAPHY,
    layout:     DEFAULT_LAYOUT,
  };
}

// ─── PAGE STRUCTURE ───────────────────────────────────────────────────────────

/**
 * Renders the root page document node.
 *
 * Uses display:contents so this element generates NO layout box — its children
 * lay out exactly as if this wrapper did not exist.  This prevents margin
 * collapsing changes, extra stacking context, or whitespace shifts that would
 * cause pixel differences between the legacy path (no wrapper) and the node
 * path (wraps everything in page_root).
 *
 * data-node-id / data-node-type are kept for DevTools inspection; they do not
 * affect layout with display:contents.
 */
export const PageRootNode: React.FC<NodeProps> = ({ node, children }) => (
  <div
    data-node-id={node.id}
    data-node-type="page_root"
    style={{ display: 'contents' }}
  >
    {children}
  </div>
);

/**
 * Renders a page group (header / body / footer logical container).
 *
 * Same display:contents rationale as PageRootNode — the group node must not
 * add any visible box to the layout.  The group handle is kept as a data
 * attribute for debugging and selector-based region captures.
 */
export const PageGroupNode: React.FC<NodeProps> = ({ node, children }) => (
  <div
    data-node-id={node.id}
    data-node-type="page_group"
    data-group-handle={String(node.settings.handle ?? '')}
    style={{ display: 'contents' }}
  >
    {children}
  </div>
);

// ─── FULL-SECTION WRAPPERS ────────────────────────────────────────────────────

export const HeroSectionNode: React.FC<NodeProps> = ({ node, ctx }) => {
  const section     = nodeToSectionDoc(node) as any;
  const themeConfig = buildThemeConfig(ctx);
  return (
    <HeroSection
      section={section}
      themeConfig={themeConfig}
      storeName={ctx.storeId || 'Store'}
    />
  );
};

export const NewsletterSectionNode: React.FC<NodeProps> = ({ node, ctx }) => {
  const section     = nodeToSectionDoc(node) as any;
  const themeConfig = buildThemeConfig(ctx);
  return (
    <NewsletterSection
      section={section}
      themeConfig={themeConfig}
      storeName={ctx.storeId || 'Store'}
    />
  );
};

export const AnnouncementBarSectionNode: React.FC<NodeProps> = ({ node, ctx }) => {
  const section     = nodeToSectionDoc(node) as any;
  const themeConfig = buildThemeConfig(ctx);
  return (
    <TemplateAnnouncementBarSection
      section={section}
      themeConfig={themeConfig}
      storeName={ctx.storeId || 'Store'}
    />
  );
};

// ─── SIMPLE WRAPPERS ──────────────────────────────────────────────────────────

export const BrandStorySectionNode: React.FC<NodeProps> = ({ node }) => {
  const section = nodeToSectionDoc(node);
  return <BrandStorySection section={section} />;
};

export const EditorialBannerSectionNode: React.FC<NodeProps> = ({ node }) => {
  const section = nodeToSectionDoc(node);
  return <EditorialBannerSection section={section} />;
};

export const CollectionCirclesSectionNode: React.FC<NodeProps> = ({ node }) => {
  const section = nodeToSectionDoc(node);
  return <CollectionCirclesSection section={section} />;
};

export const ProductMosaicSectionNode: React.FC<NodeProps> = ({ node }) => {
  const section = nodeToSectionDoc(node);
  return <ProductMosaicSection section={section} />;
};

export const TrustBadgesBarSectionNode: React.FC<NodeProps> = ({ node }) => {
  const section = nodeToSectionDoc(node);
  return <TrustBadgesBarSection section={section} />;
};

// ─── SHELL WRAPPERS ───────────────────────────────────────────────────────────
// In the page builder canvas, header/footer use SystemSectionShell (Phase 2).
// These wrappers exist for the public preview TreeRenderer path.

export const HeaderSectionNode: React.FC<NodeProps> = ({ node, style, children }) => (
  <header
    data-node-id={node.id}
    data-node-type="header"
    style={{
      background:   String(node.settings.background ?? '#ffffff'),
      borderBottom: '1px solid #e5e7eb',
      ...style,
    }}
  >
    {children}
  </header>
);

export const FooterSectionNode: React.FC<NodeProps> = ({ node, style, children }) => (
  <footer
    data-node-id={node.id}
    data-node-type="footer"
    style={{
      background: String(node.settings.background ?? '#111827'),
      color:      '#ffffff',
      ...style,
    }}
  >
    {children}
  </footer>
);

// ─── RICH TEXT SECTION ────────────────────────────────────────────────────────
// Overrides the existing rich_text → RichText content-primitive alias.
// The section type uses heading/paragraph/button children (already recursed
// by NodeRenderer and passed as `children`).

const CONTENT_WIDTHS: Record<string, number> = {
  narrow: 480,
  normal: 720,
  wide:   960,
};

export const RichTextSectionNode: React.FC<NodeProps> = ({ node, style, children }) => {
  const alignment  = String(node.settings.alignment  ?? 'center') as React.CSSProperties['textAlign'];
  const maxWidth   = CONTENT_WIDTHS[String(node.settings.contentWidth ?? 'narrow')] ?? 480;
  const pt         = Number(node.settings['spacing.top']    ?? 40);
  const pb         = Number(node.settings['spacing.bottom'] ?? 40);

  return (
    <div
      data-node-id={node.id}
      data-node-type="rich_text"
      style={{
        paddingTop:    pt,
        paddingBottom: pb,
        paddingLeft:   24,
        paddingRight:  24,
        background:    '#ffffff',
        ...style,
      }}
    >
      <div style={{ maxWidth, margin: '0 auto', textAlign: alignment }}>
        {children}
      </div>
    </div>
  );
};
