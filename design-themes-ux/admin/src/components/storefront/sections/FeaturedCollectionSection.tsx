import React from 'react';
import type { SectionRenderProps } from '../SectionRenderer';
import BlockRenderer from '../BlockRenderer';
import { Star, Heart, Plus, Package } from 'lucide-react';
import { resolveColorScheme } from '../utils/colorSchemes';
import { useCanvasProducts, formatCanvasPrice, type CanvasProduct } from '@/hooks/useCanvasProducts';

const ProductCard: React.FC<{
  product:      CanvasProduct;
  cardSettings: Record<string, any>;
  themeColors:  Record<string, string>;
}> = ({ product, cardSettings, themeColors }) => {
  const showQuickAdd = cardSettings.showQuickAdd !== false;
  const showRating   = cardSettings.showRating   !== false;
  const showAddToCart= cardSettings.showAddToCart === true;
  const addToCartLabel = (cardSettings.addToCartLabel as string) ?? 'ADD TO CART';
  const addToCartBg    = (cardSettings.addToCartBg   as string) ?? '#cc3300';
  const ratio        = cardSettings.imageRatio ?? '1/1';
  const paddingTop   = ratio === '3/4' ? '133%' : ratio === '4/3' ? '75%' : '100%';
  const rating       = Math.round(product.rating ?? 4);

  return (
    <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #f1f5f9', cursor: 'pointer', transition: 'box-shadow 0.2s' }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
    >
      {/* Image */}
      <div style={{ position: 'relative', paddingTop, background: '#f3f4f6' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          {product.image ? (
            <img src={product.image} alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={32} color="#d1d5db" />
            </div>
          )}
        </div>
        {showQuickAdd && (
          <div className="nx-quick-add" style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'rgba(15,23,42,0.85)', color: '#fff',
            fontSize: 11, fontWeight: 600, padding: '8px 0', textAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            opacity: 0, transition: 'opacity 0.2s',
          }}>
            <Plus size={12} /> Quick add
          </div>
        )}
        <button style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <Heart size={13} color="#64748b" />
        </button>
        {/* Discount badge */}
        {product.comparePrice && product.comparePrice > product.price && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: '#cc3300', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>
            {Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)}% OFF
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 10px 12px' }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {product.name}
        </p>
        {showRating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, margin: '3px 0' }}>
            {[1,2,3,4,5].map((i) => (
              <Star key={i} size={9} fill={i <= rating ? '#f59e0b' : 'none'} color={i <= rating ? '#f59e0b' : '#e2e8f0'} />
            ))}
            {product.reviewCount != null && <span style={{ fontSize: 9, color: '#94a3b8', marginLeft: 2 }}>({product.reviewCount})</span>}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: themeColors.text ?? '#0f172a' }}>
            {formatCanvasPrice(product.price)}
          </p>
          {product.comparePrice && product.comparePrice > product.price && (
            <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', textDecoration: 'line-through' }}>
              {formatCanvasPrice(product.comparePrice)}
            </p>
          )}
        </div>
        {showAddToCart && (
          <button style={{ marginTop: 8, width: '100%', padding: '7px 0', background: addToCartBg, color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em' }}>
            {addToCartLabel}
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * FeaturedCollectionSection — Sprint 5
 *
 * Renders a product grid from section blocks:
 *   collection_title → section heading
 *   view_all_button  → "View all" link
 *   product_card     → card appearance settings
 *
 * Uses demo product data (real data is Sprint 7-8 when the renderer
 * fetches from the catalog via the collection picker setting).
 */
const FeaturedCollectionSection: React.FC<SectionRenderProps> = ({ section, themeConfig, storeName }) => {
  const {
    productsToShow = 4,
    columnsDesktop = '4',
    columnsMobile  = '2',
    showViewAll    = true,
    spacing        = {},
    collection,
    category,
    product: productId,
  } = section.settings;

  const colsDesktop = parseInt(String(columnsDesktop), 10) || 4;
  const colsMobile  = parseInt(String(columnsMobile),  10) || 2;
  const limit       = Math.min(Number(productsToShow) || 4, 24);
  const cols        = colsDesktop;

  // P6 storefront path: use server-pre-resolved products when available (no auth needed)
  // P2/P3 editor path: fetch from API using collection/category/product bindings
  const serverProducts = (section.settings.resolvedProducts as CanvasProduct[] | undefined) ?? null;
  const hasServerProducts = serverProducts !== null && serverProducts.length >= 0;

  const apiResult = useCanvasProducts({
    collectionId: hasServerProducts ? undefined : collection,
    categoryId:   hasServerProducts ? undefined : category,
    productId:    hasServerProducts ? undefined : (productId as string | undefined),
    limit,
  });

  const products  = hasServerProducts ? serverProducts : apiResult.products;
  const isLoading = hasServerProducts ? false         : apiResult.isLoading;
  const isEmpty   = hasServerProducts ? products.length === 0 : apiResult.isEmpty;

  // P0-7: resolve color scheme → overrides section background and text
  const scheme = resolveColorScheme(section.settings.colorScheme, themeConfig.colors);

  const titleBlock   = section.blocks.find((b) => b.type === 'collection_title');
  const viewAllBlock = section.blocks.find((b) => b.type === 'view_all_button');
  const cardBlock    = section.blocks.find((b) => b.type === 'product_card');

  const pt = spacing.top    ? `${spacing.top}px`    : '48px';
  const pb = spacing.bottom ? `${spacing.bottom}px` : '48px';

  return (
    // P0-7: scheme.bg from color scheme setting (or theme background as fallback)
    <section style={{ paddingTop: pt, paddingBottom: pb, paddingLeft: '24px', paddingRight: '24px', background: scheme.bg }}>
      <style>{`
        @media (max-width: 640px) { .nx-fc-grid { grid-template-columns: repeat(${colsMobile}, 1fr) !important; } }
      `}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          {titleBlock && (
            <BlockRenderer
              block={titleBlock}
              sectionId={section.id}
              sectionType={section.type}
              themeConfig={themeConfig}
              storeName={storeName}
            />
          )}
          {viewAllBlock && showViewAll && (
            <BlockRenderer
              block={viewAllBlock}
              sectionId={section.id}
              sectionType={section.type}
              themeConfig={themeConfig}
              storeName={storeName}
            />
          )}
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="nx-fc-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>
            {Array.from({ length: limit }).map((_, i) => (
              <div key={i} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                <div style={{ paddingTop: '100%', background: '#f3f4f6', animation: 'pulse 1.5s infinite' }} />
                <div style={{ padding: '10px 10px 12px' }}>
                  <div style={{ height: 12, background: '#f3f4f6', borderRadius: 4, marginBottom: 6 }} />
                  <div style={{ height: 12, background: '#f3f4f6', borderRadius: 4, width: '60%' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && isEmpty && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            No products found. Add products to your store.
          </div>
        )}

        {/* Real product grid */}
        {!isLoading && products.length > 0 && (
          <div className="nx-fc-grid" style={{
            display:             'grid',
            gridTemplateColumns: `repeat(${Math.min(cols, products.length)}, 1fr)`,
            gap:                 16,
          }}>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                cardSettings={cardBlock?.settings ?? {}}
                themeColors={themeConfig.colors}
              />
            ))}
          </div>
        )}
      </div>

      {/* Inject hover style for quick-add (minimal inline CSS) */}
      <style>{`.nx-quick-add { opacity: 0 !important } div:hover .nx-quick-add { opacity: 1 !important }`}</style>
    </section>
  );
};

export default FeaturedCollectionSection;
