import React from 'react';
import type { SectionWithBlocks } from '@/services/storefrontService';
import type { BlockRenderProps }  from './BlockRenderer';

import HeroSection                    from './sections/HeroSection';
import FeaturedCollectionSection      from './sections/FeaturedCollectionSection';
import NewsletterSection              from './sections/NewsletterSection';
import TemplateAnnouncementBarSection from './sections/TemplateAnnouncementBarSection';
import CollectionCirclesSection  from './sections/CollectionCirclesSection';
import ProductMosaicSection      from './sections/ProductMosaicSection';
import EditorialBannerSection    from './sections/EditorialBannerSection';
import TrustBadgesBarSection     from './sections/TrustBadgesBarSection';
import BrandStorySection         from './sections/BrandStorySection';
import GenericSection            from './sections/GenericSection';

// ─── Section component interface ──────────────────────────────────────────────

export interface SectionRenderProps {
  section:    SectionWithBlocks;
  themeConfig: BlockRenderProps['themeConfig'];
  storeName:  string;
}

// ─── Section registry (template sections only — header/footer handled separately) ──

const SECTION_REGISTRY: Record<string, React.ComponentType<SectionRenderProps>> = {
  announcement_bar:     TemplateAnnouncementBarSection,  // template version
  hero:                 HeroSection,
  featured_collection:  FeaturedCollectionSection,
  product_grid:         FeaturedCollectionSection,
  newsletter:           NewsletterSection,
  // eCraftIndia / Indian ecommerce sections
  collection_circles:   CollectionCirclesSection,
  product_mosaic:       ProductMosaicSection,
  editorial_banner:     EditorialBannerSection,
  trust_badges_bar:     TrustBadgesBarSection,
  brand_story:          BrandStorySection,
};

// ─── SectionRenderer ──────────────────────────────────────────────────────────

interface SectionRendererProps extends SectionRenderProps {}

/**
 * SectionRenderer — Sprint 5
 *
 * Looks up the correct section component from SECTION_REGISTRY and renders it
 * wrapped with `data-nexuscart-section` and related attributes.
 *
 * These attributes are required for:
 *   1. PreviewEditorBridge: bounding box calculation for canvas overlay
 *   2. Future inline editing: identifying which section was clicked
 *
 * `position: relative` on the wrapper ensures absolute-positioned editor
 * overlays (selection chip, action bar) are positioned correctly.
 *
 * Invisible sections are excluded from the DOM entirely (not `display:none`)
 * to avoid affecting layout and bounding boxes of surrounding sections.
 */
const SectionRenderer: React.FC<SectionRendererProps> = ({ section, themeConfig, storeName }) => {
  if (!section.isVisible) return null;

  const SectionComponent = SECTION_REGISTRY[section.type] ?? GenericSection;

  return (
    <div
      data-nexuscart-section={section.id}
      data-section-type={section.type}
      data-section-label={section.label}
      style={{ position: 'relative' }}
    >
      <SectionComponent section={section} themeConfig={themeConfig} storeName={storeName} />
    </div>
  );
};

export { SECTION_REGISTRY };
export default SectionRenderer;
