import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Heart } from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { useProductDetail } from '@/hooks/useProductDetail';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { ApiError, type ProductVariant } from '@/lib/storefrontApi';
import CartDrawer from '@/components/CartDrawer';
import AurusHeader from './aurus/AurusHeader';
import { UI, SERIF } from './aurus/constants';
import ProductGallery from '@/components/storefront/pdp/ProductGallery';
import VariantSelector from '@/components/storefront/pdp/VariantSelector';
import PriceBlock from '@/components/storefront/pdp/PriceBlock';
import InventoryStatus from '@/components/storefront/pdp/InventoryStatus';
import SpecsAccordion from '@/components/storefront/pdp/SpecsAccordion';
import DeliveryEstimate from '@/components/storefront/pdp/DeliveryEstimate';
import ReviewsSection from '@/components/storefront/pdp/ReviewsSection';
import ProductCarousel from '@/components/storefront/pdp/ProductCarousel';
import RecentlyViewedSection from '@/components/storefront/pdp/RecentlyViewedSection';
import ProductJsonLd from '@/components/storefront/pdp/ProductJsonLd';
import StarRow from '@/components/storefront/pdp/StarRow';
import { absoluteUrl } from '@/lib/seo';
import type { Product } from '@/data/products';

export interface AurusProductDetailProps {
  id: string;
  onMetaChange?: (meta: { title: string; description?: string; canonical: string; image?: string }) => void;
}

/**
 * AurusProductDetail — the data-driven Product Detail Page (Phase P2).
 *
 * Mirrors AurusListing.tsx's pattern: resolves everything from the API via
 * useProductDetail, renders the same visual shell as the legacy AurusProduct
 * (header/breadcrumb/2-col layout/reviews/related/footer), but every section
 * is wired to real data — no hardcoded products, reviews, or related items.
 */
const AurusProductDetail: React.FC<AurusProductDetailProps> = ({ id, onMetaChange }) => {
  const navigate = useNavigate();
  const { addToCart, toggleWishlist, wishlist } = useStore();
  const { ids: recentlyViewedIds, addViewed } = useRecentlyViewed();
  const [headerSearch, setHeaderSearch] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  const { data: product, isLoading, isError, error, refetch } = useProductDetail(id);

  useEffect(() => {
    if (product) addViewed(product.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const onVariantChange = useCallback((v: ProductVariant | null) => setSelectedVariant(v), []);

  const isNotFound = isError && error instanceof ApiError && error.status === 404;

  useEffect(() => {
    if (!onMetaChange || !product) return;
    onMetaChange({
      title: product.seo?.title || `${product.name} — Aurus`,
      description: product.seo?.description || product.shortDescription || undefined,
      canonical: absoluteUrl(`/products/${product.id}`),
      image: product.images[0],
    });
  }, [product, onMetaChange]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white" style={UI}>
        <AurusHeader searchQuery={headerSearch} onSearchChange={setHeaderSearch} />
        <div className="max-w-[1400px] mx-auto px-4 sm:px-5 py-6">
          <div className="grid lg:grid-cols-2 gap-10 xl:gap-14 items-start animate-pulse">
            <div className="aspect-square bg-gray-100 rounded-xl" />
            <div className="space-y-4">
              <div className="h-6 bg-gray-100 rounded w-2/3" />
              <div className="h-10 bg-gray-100 rounded w-1/3" />
              <div className="h-24 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="min-h-screen bg-white" style={UI}>
        <AurusHeader searchQuery={headerSearch} onSearchChange={setHeaderSearch} />
        <div className="text-center py-24 px-4">
          {isNotFound ? (
            <>
              <p className="text-[16px] font-bold text-gray-800" style={UI}>We couldn't find this product</p>
              <p className="text-[13px] text-gray-500 mt-1.5 mb-5" style={UI}>It may have been removed or the link is incorrect.</p>
              <Link to="/" className="inline-block bg-purple-700 hover:bg-purple-800 text-white text-[13px] font-bold px-6 py-2.5 rounded-sm transition-colors" style={UI}>
                Back to Home
              </Link>
            </>
          ) : (
            <>
              <p className="text-[16px] font-bold text-gray-800" style={UI}>Something went wrong</p>
              <p className="text-[13px] text-gray-500 mt-1.5 mb-5" style={UI}>We couldn't load this product right now. Please try again.</p>
              <button onClick={() => refetch()} className="inline-block bg-purple-700 hover:bg-purple-800 text-white text-[13px] font-bold px-6 py-2.5 rounded-sm transition-colors" style={UI}>
                Retry
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const wished = wishlist.includes(product.id);
  const effectivePrice = selectedVariant?.price ?? product.price;
  const effectiveMrp   = selectedVariant?.mrp ?? product.mrp;
  const effectiveStock = selectedVariant?.stock ?? product.stock;
  const effectiveDiscount = effectiveMrp > effectivePrice
    ? Math.round(((effectiveMrp - effectivePrice) / effectiveMrp) * 100)
    : 0;
  const galleryImages = selectedVariant?.image ? [selectedVariant.image, ...product.images] : product.images;

  const cartProduct: Product = {
    id: product.id, theme: 'aurus', name: product.name, category: product.category?.name ?? '',
    price: effectivePrice, mrp: effectiveMrp, image: selectedVariant?.image || product.images[0] || '',
    badge: product.badges[0], rating: product.rating, reviews: product.reviewCount, desc: product.shortDescription ?? '',
  };
  const cartVariant = selectedVariant
    ? { variantId: selectedVariant.id, variantSku: selectedVariant.sku, variantOptions: selectedVariant.options }
    : undefined;

  return (
    <div className="min-h-screen bg-white" style={UI}>
      <ProductJsonLd product={product} />

      <AurusHeader
        activeNav={product.category?.name}
        searchQuery={headerSearch}
        onSearchChange={setHeaderSearch}
        onSearchSubmit={(q) => navigate(`/search?q=${encodeURIComponent(q)}`)}
      />

      <div className="bg-white border-b border-gray-100 py-2.5">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-5 flex items-center gap-1.5 text-[11px] text-gray-400 flex-wrap" style={UI}>
          {product.breadcrumbs.map((bc, i) => (
            <React.Fragment key={`${bc.url}-${i}`}>
              {i > 0 && <ChevronRight className="w-3 h-3" />}
              {i === product.breadcrumbs.length - 1
                ? <span className="text-gray-600 truncate max-w-[300px]">{bc.label}</span>
                : <Link to={bc.url} className="hover:text-purple-700 transition-colors">{bc.label}</Link>}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-5 py-6">
        <div className="grid lg:grid-cols-2 gap-10 xl:gap-14 items-start">

          <ProductGallery
            images={galleryImages}
            name={product.name}
            wished={wished}
            onToggleWishlist={() => toggleWishlist(product.id)}
          />

          <div>
            {product.category && (
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-purple-600 mb-1" style={UI}>
                {product.category.name}
              </p>
            )}

            <h1 className="text-[26px] sm:text-[30px] font-light text-gray-900 leading-tight" style={SERIF}>
              {product.name}
            </h1>

            <div className="flex items-center gap-2 mt-2.5" style={UI}>
              <StarRow r={product.rating} size={14} />
              <span className="text-[13px] font-bold text-gray-800">{product.rating || '—'}</span>
              {product.reviewCount > 0 && (
                <span className="text-[12px] text-purple-600 underline underline-offset-2">{product.reviewCount} Reviews</span>
              )}
            </div>

            <div className="h-px bg-gray-200 my-4" />

            <PriceBlock price={effectivePrice} mrp={effectiveMrp} discount={effectiveDiscount} />
            <InventoryStatus stock={effectiveStock} />

            <div className="h-px bg-gray-200 my-5" />

            <VariantSelector variants={product.variants} onChange={onVariantChange} />

            <div className="h-px bg-gray-200 my-5" />

            <DeliveryEstimate />

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => addToCart(cartProduct, 1, cartVariant)}
                disabled={effectiveStock <= 0}
                className="flex-1 bg-[#6B21A8] hover:bg-[#581C87] text-white py-3.5 text-[14px] font-bold tracking-wide transition-colors rounded-sm disabled:opacity-40 disabled:cursor-not-allowed"
                style={UI}
              >
                {effectiveStock > 0 ? 'ADD TO BAG' : 'OUT OF STOCK'}
              </button>
              <button
                onClick={() => toggleWishlist(product.id)}
                className={`px-4 py-3.5 border-2 rounded-sm transition-colors ${wished ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-red-400'}`}
              >
                <Heart className={`w-5 h-5 ${wished ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
              </button>
            </div>

            <div className="h-px bg-gray-200 my-5" />

            <SpecsAccordion
              sku={selectedVariant?.sku ?? product.sku}
              category={product.category?.name}
              description={product.description}
              shortDescription={product.shortDescription}
              attributes={product.attributes}
            />
          </div>
        </div>
      </div>

      <ReviewsSection productId={product.id} rating={product.rating} reviewCount={product.reviewCount} />

      <ProductCarousel title="Related Products" products={product.relatedProducts} />
      <ProductCarousel title="Similar Products" products={product.similarProducts} />
      <RecentlyViewedSection ids={recentlyViewedIds} excludeProductId={product.id} />

      <CartDrawer accentClass="bg-purple-800" fontClass="font-sans" />
    </div>
  );
};

export default AurusProductDetail;
