/**
 * Universal Product Detail Page (PDP) Templates
 *
 * RULES:
 *   - No industry-specific labels ("Saree PDP", "Electronics PDP")
 *   - No vertical-specific variant names ("Fabric", "Karat", "RAM")
 *   - All content empty — merchant fills via inspector
 *   - Templates differ ONLY in layout structure, not content
 *
 * A merchant building a saree store and a merchant building an
 * electronics store use the same template types. Their CONTENT differs.
 * The platform doesn't know or care which vertical they are.
 */

import type { PageTemplate } from './index';

// ─── Shared PDP section factories ────────────────────────────────────────────

const breadcrumb = (): PageTemplate['sections'][0] => ({
  type: 'breadcrumb', label: 'Breadcrumb',
  settings: { separator: '/' },
  blocks: [],
});

const productGallery = (ratio = '1/1', thumbPos = 'bottom'): PageTemplate['sections'][0] => ({
  type: 'product_gallery', label: 'Product Gallery',
  settings: { showZoom: true, imageRatio: ratio, thumbPosition: thumbPos },
  blocks: [],
});

const productTitle = (): PageTemplate['sections'][0] => ({
  type: 'product_title', label: 'Product Title',
  settings: { level: 'h1' },
  blocks: [],
});

const productPrice = (): PageTemplate['sections'][0] => ({
  type: 'product_price', label: 'Product Price',
  settings: { showDiscountBadge: true },
  blocks: [],
});

const variantSelector = (swatchType: 'pill' | 'swatch' = 'pill'): PageTemplate['sections'][0] => ({
  type: 'variant_selector', label: 'Variant Selector',
  settings: { swatchType },  // merchant configures which options show as pills vs swatches
  blocks: [],
});

const quantitySelector = (): PageTemplate['sections'][0] => ({
  type: 'quantity_selector', label: 'Quantity',
  settings: { min: 1, max: 99 },
  blocks: [],
});

const ctaRow = (): PageTemplate['sections'][0] => ({
  type: 'stack', label: 'CTA Buttons',
  settings: { flexDir: 'row', gap: 12 },
  blocks: [],
});

const addToCart = (): PageTemplate['sections'][0] => ({
  type: 'add_to_cart', label: 'Add to Cart',
  settings: { label: '', radius: 8, variant: 'filled' },  // ← merchant fills label
  blocks: [],
});

const buyNow = (): PageTemplate['sections'][0] => ({
  type: 'buy_now', label: 'Buy Now',
  settings: { label: '', radius: 8 },   // ← merchant fills label
  blocks: [],
});

const trustBadges = (): PageTemplate['sections'][0] => ({
  type: 'trust_badges', label: 'Trust Badges',
  settings: {
    columns: 2,
    badges: [
      { icon: 'shield',   title: '', description: '' },   // ← merchant fills
      { icon: 'shipping', title: '', description: '' },   // ← merchant fills
      { icon: 'returns',  title: '', description: '' },   // ← merchant fills
      { icon: 'check',    title: '', description: '' },   // ← merchant fills
    ],
  },
  blocks: [],
});

const productDescription = (collapsible = false): PageTemplate['sections'][0] => ({
  type: 'product_description', label: 'Product Description',
  settings: { collapsible, label: 'Description' },
  blocks: [],
});

const productSpecifications = (): PageTemplate['sections'][0] => ({
  type: 'product_specifications', label: 'Specifications',
  settings: { layout: 'table', label: 'Specifications' },
  blocks: [],
});

const relatedProducts = (): PageTemplate['sections'][0] => ({
  type: 'featured_collection', label: 'Related Products',
  settings: {
    title: '',         // ← merchant fills: "You May Also Like"
    collectionId: '',  // ← merchant selects related collection
    productsToShow: 4,
    columnsDesktop: '4',
    columnsMobile: '2',
    showViewAll: false,
  },
  blocks: [
    { type: 'collection_title', settings: { text: '' } },
    { type: 'product_card',     settings: { showRating: true, showQuickAdd: false, imageRatio: '1/1' } },
  ],
});

const divider = (): PageTemplate['sections'][0] => ({
  type: 'divider', label: 'Divider',
  settings: { bw: 1, bs: 'solid', bc: '#e5e7eb', mt: 0, mb: 0 },
  blocks: [],
});

// ─── PDP Template 1: Standard 2-Column ───────────────────────────────────────
// Gallery left · Details right · Description below
// Works for: any product with image + variants

const STANDARD_PDP: PageTemplate = {
  id: 'pdp-standard',
  name: 'Product Page — Standard',
  vertical: 'Universal',
  description: '2-column layout. Gallery left, details right. Description and related products below.',
  thumbnail: '⊡',
  tags: ['pdp', 'standard', '2-column'],
  sections: [
    breadcrumb(),
    {
      type: 'columns', label: 'PDP Layout',
      settings: { ratios: '1,1', gap: 48, stackOn: 'mobile' },
      blocks: [],
    },
    productGallery('1/1', 'bottom'),
    {
      type: 'stack', label: 'Product Details',
      settings: { flexDir: 'column', gap: 16 },
      blocks: [],
    },
    productTitle(),
    productPrice(),
    variantSelector('pill'),
    quantitySelector(),
    ctaRow(),
    addToCart(),
    buyNow(),
    trustBadges(),
    divider(),
    productDescription(),
    relatedProducts(),
  ],
};

// ─── PDP Template 2: Gallery-First ───────────────────────────────────────────
// Large gallery (3:4 portrait) left · Compact details right
// Works for: apparel, fashion, wearables, art

const GALLERY_FIRST_PDP: PageTemplate = {
  id: 'pdp-gallery-first',
  name: 'Product Page — Gallery First',
  vertical: 'Universal',
  description: 'Portrait gallery with thumbnail sidebar. Ideal for visual products.',
  thumbnail: '⊟',
  tags: ['pdp', 'gallery', 'visual', 'fashion'],
  sections: [
    breadcrumb(),
    {
      type: 'columns', label: 'PDP Layout',
      settings: { ratios: '3,2', gap: 48, stackOn: 'mobile' },
      blocks: [],
    },
    productGallery('3/4', 'left'),    // portrait + left thumbnails
    {
      type: 'stack', label: 'Product Details',
      settings: { flexDir: 'column', gap: 14 },
      blocks: [],
    },
    productTitle(),
    productPrice(),
    variantSelector('swatch'),        // swatch style for color-dominant products
    quantitySelector(),
    ctaRow(),
    addToCart(),
    buyNow(),
    trustBadges(),
    divider(),
    productDescription(true),         // collapsible accordion
    relatedProducts(),
  ],
};

// ─── PDP Template 3: Specification-Heavy ──────────────────────────────────────
// Standard gallery · Specs table prominently placed
// Works for: electronics, appliances, tools, technical products

const SPECS_PDP: PageTemplate = {
  id: 'pdp-specs',
  name: 'Product Page — Specification Heavy',
  vertical: 'Universal',
  description: 'Specs table prominently placed. Ideal for technical or feature-driven products.',
  thumbnail: '≡',
  tags: ['pdp', 'specs', 'technical', 'electronics'],
  sections: [
    breadcrumb(),
    {
      type: 'columns', label: 'PDP Layout',
      settings: { ratios: '1,1', gap: 40, stackOn: 'mobile' },
      blocks: [],
    },
    productGallery('1/1', 'bottom'),
    {
      type: 'stack', label: 'Product Details',
      settings: { flexDir: 'column', gap: 14 },
      blocks: [],
    },
    productTitle(),
    productPrice(),
    variantSelector('pill'),
    quantitySelector(),
    ctaRow(),
    addToCart(),
    buyNow(),
    trustBadges(),
    divider(),
    productSpecifications(),          // specs BEFORE description
    productDescription(true),
    relatedProducts(),
  ],
};

// ─── PDP Template 4: Minimal ─────────────────────────────────────────────────
// Single column, large image, clean
// Works for: luxury, single-SKU, art, collectibles

const MINIMAL_PDP: PageTemplate = {
  id: 'pdp-minimal',
  name: 'Product Page — Minimal',
  vertical: 'Universal',
  description: 'Single-column clean layout. Best for luxury, single-SKU, or art products.',
  thumbnail: '○',
  tags: ['pdp', 'minimal', 'luxury', 'clean'],
  sections: [
    breadcrumb(),
    productGallery('1/1', 'bottom'),
    productTitle(),
    productPrice(),
    variantSelector('pill'),
    quantitySelector(),
    ctaRow(),
    addToCart(),
    buyNow(),
    trustBadges(),
    productDescription(),
    relatedProducts(),
  ],
};

// ─── PDP Template 5: With Dimensions ─────────────────────────────────────────
// Landscape gallery + specs table + room/scene related section
// Works for: furniture, home decor, large goods

const DIMENSIONS_PDP: PageTemplate = {
  id: 'pdp-dimensions',
  name: 'Product Page — With Dimensions',
  vertical: 'Universal',
  description: 'Landscape gallery ratio for large products. Specs table for dimensions and materials.',
  thumbnail: '⊞',
  tags: ['pdp', 'furniture', 'dimensions', 'specs'],
  sections: [
    breadcrumb(),
    {
      type: 'columns', label: 'PDP Layout',
      settings: { ratios: '3,2', gap: 48, stackOn: 'tablet' },
      blocks: [],
    },
    productGallery('4/3', 'bottom'),  // landscape for room-scene photography
    {
      type: 'stack', label: 'Product Details',
      settings: { flexDir: 'column', gap: 16 },
      blocks: [],
    },
    productTitle(),
    productPrice(),
    variantSelector('pill'),
    quantitySelector(),
    ctaRow(),
    addToCart(),
    buyNow(),
    trustBadges(),
    divider(),
    productSpecifications(),
    productDescription(true),
    relatedProducts(),
  ],
};

// ─── Registry ──────────────────────────────────────────────────────────────────

export const PDP_TEMPLATES: PageTemplate[] = [
  STANDARD_PDP,
  GALLERY_FIRST_PDP,
  SPECS_PDP,
  MINIMAL_PDP,
  DIMENSIONS_PDP,
];
