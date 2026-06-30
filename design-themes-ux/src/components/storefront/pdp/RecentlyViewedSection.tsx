import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchProductListing } from '@/lib/storefrontApi';
import ProductCarousel from './ProductCarousel';

const STORE_ID = import.meta.env.VITE_STORE_ID ?? '';

interface RecentlyViewedSectionProps {
  ids:               string[];
  excludeProductId?: string;
}

/**
 * Renders real product cards for the ids tracked by useRecentlyViewed
 * (client-side state) — the *which ids* list is per-browser, but everything
 * displayed (price/discount/rating/stock) comes from a live
 * `/storefront/products?ids=...` call (the same listing endpoint used for
 * related/similar products), so no stale/fake product data is ever shown.
 */
const RecentlyViewedSection: React.FC<RecentlyViewedSectionProps> = ({ ids, excludeProductId }) => {
  const filteredIds = ids.filter((id) => id !== excludeProductId);
  const hasStoreId = Boolean(STORE_ID) && filteredIds.length > 0;

  const { data } = useQuery({
    queryKey: ['storefront', 'recently-viewed', filteredIds],
    queryFn:  () => fetchProductListing({ ids: filteredIds.join(',') }),
    enabled:  hasStoreId,
    staleTime: 60_000,
    gcTime:    600_000,
  });

  if (!hasStoreId || !data?.products.length) return null;

  return <ProductCarousel title="Recently Viewed" products={data.products} />;
};

export default RecentlyViewedSection;
