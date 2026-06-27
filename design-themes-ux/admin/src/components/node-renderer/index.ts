/**
 * NodeRenderer public API — Sprint 10
 *
 * Side-effect import: registers all platform primitives with full metadata.
 *
 *   import '@/components/node-renderer';          // register (once, at app root)
 *   import { TreeRenderer, ... } from '@/...' ;   // use
 */

import { registerAll, setUnknownFallback } from './registry';

// ─── Primitives ───────────────────────────────────────────────────────────────

import Container          from './primitives/Container';
import Stack              from './primitives/Stack';
// ── PDP primitives ────────────────────────────────────────────────────────────
import ProductGallery      from './primitives/ProductGallery';
import ProductTitle        from './primitives/ProductTitle';
import ProductPrice        from './primitives/ProductPrice';
import VariantSelector     from './primitives/VariantSelector';
import QuantitySelector    from './primitives/QuantitySelector';
import AddToCart           from './primitives/AddToCart';
import BuyNow              from './primitives/BuyNow';
import ProductDescription  from './primitives/ProductDescription';
import ProductSpecifications from './primitives/ProductSpecifications';
import Breadcrumb          from './primitives/Breadcrumb';
import TrustBadges         from './primitives/TrustBadges';
import Grid           from './primitives/Grid';
import Columns        from './primitives/Columns';
import Carousel       from './primitives/Carousel';
import Spacer         from './primitives/Spacer';
import Divider        from './primitives/Divider';
import Heading        from './primitives/Heading';
import Text           from './primitives/Text';
import RichText       from './primitives/RichText';
import ImageNode      from './primitives/Image';
import Button         from './primitives/Button';
import ProductGrid    from './primitives/ProductGrid';
import CollectionGrid from './primitives/CollectionGrid';
import Unknown        from './primitives/Unknown';

// ─── Unknown fallback (registered before any other primitive) ─────────────────

setUnknownFallback(Unknown);

// ─── Layout primitives ────────────────────────────────────────────────────────

registerAll(
  { container: Container, stack: Stack, grid: Grid,
    columns: Columns, carousel: Carousel, spacer: Spacer, divider: Divider },
  { source: 'platform', category: 'layout' },
);

// ─── Content primitives ───────────────────────────────────────────────────────

registerAll(
  {
    heading:    Heading,
    text:       Text,
    paragraph:  Text,        // alias — legacy type id
    richtext:   RichText,
    rich_text:  RichText,    // alias — legacy type id
    image:      ImageNode,
    button:     Button,
  },
  { source: 'platform', category: 'content' },
);

// ─── Commerce / data-bound primitives ─────────────────────────────────────────

registerAll(
  {
    product_grid:        ProductGrid,
    featured_collection: ProductGrid,    // alias — legacy type id
    collection_grid:     CollectionGrid,
  },
  { source: 'platform', category: 'commerce' },
);

// ─── PDP primitives ───────────────────────────────────────────────────────────

registerAll(
  {
    product_gallery:          ProductGallery,
    product_title:            ProductTitle,
    product_price:            ProductPrice,
    variant_selector:         VariantSelector,
    quantity_selector:        QuantitySelector,
    add_to_cart:              AddToCart,
    buy_now:                  BuyNow,
    product_description:      ProductDescription,
    product_specifications:   ProductSpecifications,
    breadcrumb:               Breadcrumb,
    trust_badges:             TrustBadges,
  },
  { source: 'platform', category: 'commerce' },
);

// ─── Phase 7: Legacy section primitives ──────────────────────────────────────
// Registers hero, newsletter, announcement_bar, brand_story, editorial_banner,
// collection_circles, product_mosaic, trust_badges_bar, header, footer,
// page_root, page_group, and the rich_text section (overrides 1.0.0 alias).
// Must run AFTER the core registrations above so version-based overrides work.

import { registerLegacySections } from './legacy';
registerLegacySections();

// ─── Public exports ───────────────────────────────────────────────────────────

export { NodeRenderer, TreeRenderer, renderNode, isNodeVisible, MAX_DEPTH } from './NodeRenderer';
export { RenderContextProvider, useRenderContext, bindContext }              from './RenderContext';
export { register, registerAll, unregister, resolve, isRegistered,
         registeredTypes, allEntries, entriesBySource, entriesByCategory,
         registrySize, setUnknownFallback, _resetRegistryForTests }         from './registry';
export { resolveFieldBinding, resolveSettings as resolveBindings,
         isBinding, isListBinding, getContextProvides }                     from './bindingResolver';
export { NodeErrorBoundary }                                                 from './ErrorBoundary';
export type { Node, RenderContext, NodeProps, Breakpoint, PageContext,
              CompiledBinding, SymbolRef }                                   from './types';
export type { RegistryEntry, ComponentSource, RegisterOptions }              from './registry';
export { expandSymbols }                                                     from './symbolExpander';
export { resolveCarouselSettings }                                           from './primitives/Carousel';
export type { CarouselSettings }                                             from './primitives/Carousel';
