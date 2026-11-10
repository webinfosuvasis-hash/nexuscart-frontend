import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, X, SlidersHorizontal } from 'lucide-react';
import AurusHeader from './aurus/AurusHeader';
import AurusFooter from './aurus/AurusFooter';
import CategoryHero from './aurus/CategoryHero';
import { UI } from './aurus/constants';
import { useFilters } from '@/hooks/useFilters';
import { useProductListing } from '@/hooks/useProductListing';
import { useProductFacets } from '@/hooks/useProductFacets';
import FilterSidebar from '@/components/storefront/plp/FilterSidebar';
import SelectedFilters from '@/components/storefront/plp/SelectedFilters';
import SortDropdown from '@/components/storefront/plp/SortDropdown';
import ProductGrid from '@/components/storefront/plp/ProductGrid';
import Pagination from '@/components/storefront/plp/Pagination';
import { FILTER_ACCENT, FILTER_HAIRLINE, FILTER_INK, FILTER_SURFACE } from '@/components/storefront/plp/filterTokens';
import { ApiError, type SortOption } from '@/lib/storefrontApi';
import { absoluteUrl } from '@/lib/seo';

export interface AurusListingProps {
  /** Scopes the listing to a single category — present on /category/:categorySlug (and legacy /jewellery/:category). */
  categorySlug?: string;
  /** Scopes the listing to a single brand — present on /brand/:brandSlug. */
  brandSlug?: string;
  /** Scopes the listing to a single collection — present on /collection/:collectionSlug. */
  collectionSlug?: string;
  /** Reports the resolved page title/breadcrumbs/pagination up to the route wrapper for dynamic <Helmet> SEO tags. */
  onMetaChange?: (meta: { title: string; description?: string; canonical: string }) => void;
}

/**
 * AurusListing — the Product Listing Page orchestrator (Phase P1).
 *
 * Fully API-driven: resolves filter state from the URL (useFilters),
 * fetches products + pagination + breadcrumbs (useProductListing) and
 * dynamic facet metadata (useProductFacets), and composes the
 * FilterSidebar / SelectedFilters / SortDropdown / ProductGrid / Pagination
 * building blocks. Visual chrome (header, breadcrumb bar, sidebar shell,
 * mobile drawer) preserves the original Aurus design — only the data layer
 * changed.
 */
const AurusListing: React.FC<AurusListingProps> = ({ categorySlug, brandSlug, collectionSlug, onMetaChange }) => {
  const filterState = useFilters(categorySlug);
  const filters = {
    ...filterState.filters,
    brandSlug:      brandSlug ?? filterState.filters.brandSlug,
    collectionSlug: collectionSlug ?? filterState.filters.collectionSlug,
  };

  const { data, isLoading, isFetching, isError, error, refetch } = useProductListing(filters);
  const { data: facets } = useProductFacets(filters);
  const [searchInput, setSearchInput] = useState(filterState.filters.q ?? '');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Resyncs the search box when the URL changes from outside this input
  // (browser back/forward, a chip removal, or Clear All) — without this the
  // box can show stale text while the grid has already updated.
  React.useEffect(() => {
    setSearchInput(filterState.filters.q ?? '');
  }, [filterState.filters.q]);

  const isNotFound = isError && error instanceof ApiError && error.status === 404;

  const products    = data?.products ?? [];
  const pagination  = data?.pagination;
  const breadcrumbs = data?.breadcrumbs ?? [{ label: 'Home', url: '/' }];
  const sortOptions = data?.sortOptions ?? [];
  const pageTitle   = isError
    ? (isNotFound ? 'Page Not Found' : 'Unable to Load Products')
    : data?.category?.name
    ?? (collectionSlug ? collectionSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : brandSlug ? brandSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : filters.q ? `Search: "${filters.q}"`
    : 'All Products');

  // Prefers real category copy from the API; falls back to a generic
  // editorial line keyed off which kind of listing this is.
  const heroDescription = data?.category?.description
    ?? (collectionSlug ? `The full ${pageTitle} collection, curated for you.`
    : brandSlug ? `Every ${pageTitle} piece, filtered exactly how you like it.`
    : filters.q ? `Refine your results for "${filters.q}" using the filters below.`
    : categorySlug ? `Every piece in ${pageTitle}, filtered exactly how you like it.`
    : 'The full edit — filtered, sorted, and ready to shop.');

  React.useEffect(() => {
    if (!onMetaChange) return;
    onMetaChange({
      title: data?.category?.seo?.title || `${pageTitle} — Aurus`,
      description: data?.category?.seo?.description || data?.category?.description || undefined,
      canonical: absoluteUrl(typeof window !== 'undefined' ? window.location.pathname : '/'),
    });
  }, [data?.category, pageTitle, onMetaChange]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F7FBFA] via-white to-white pb-16 lg:pb-0" style={UI}>
      <AurusHeader
        searchQuery={searchInput}
        onSearchChange={setSearchInput}
        onSearchSubmit={(q) => filterState.setSearch(q)}
      />

      {!isError && (
        <CategoryHero
          title={pageTitle}
          description={heroDescription}
          breadcrumbs={breadcrumbs}
          total={pagination?.total}
          brandCount={facets?.brand.length}
          priceFrom={facets?.price.min}
        />
      )}

      {/* Main layout: sidebar + content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-5 pb-16 flex gap-7">

        <aside className="hidden lg:block w-[240px] flex-shrink-0">
          <div className="sticky top-[93px] pt-8">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 18, borderBottom: `1px solid ${FILTER_HAIRLINE}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: FILTER_INK, textTransform: 'uppercase', letterSpacing: '0.1em', ...UI }}>
                  Filters
                </span>
                {filterState.totalActive > 0 && (
                  <span style={{ background: FILTER_SURFACE, color: FILTER_ACCENT, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '1.5px 8px', ...UI }}>
                    {filterState.totalActive}
                  </span>
                )}
              </div>
              {filterState.totalActive > 0 && (
                <button
                  onClick={filterState.clearAll}
                  style={{ fontSize: 11, color: FILTER_ACCENT, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', ...UI }}
                >
                  Clear All
                </button>
              )}
            </div>
            <FilterSidebar facets={facets} filterState={filterState} hideCategory={!!categorySlug} />
          </div>
        </aside>

        <div className="flex-1 min-w-0 pt-5">
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap min-h-[36px]">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden flex items-center gap-1.5 border border-gray-400 text-gray-700 text-[12px] font-medium px-3 py-1.5 rounded-full hover:border-gray-600 transition-colors"
                style={UI}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                FILTER {filterState.totalActive > 0 && `(${filterState.totalActive})`}
              </button>

              <SelectedFilters chips={filterState.activeChips} onRemove={filterState.removeChip} />
            </div>

            <SortDropdown options={sortOptions} value={filterState.filters.sortBy} onChange={filterState.setSort} />
          </div>

          {isError ? (
            <div className="text-center py-20">
              {isNotFound ? (
                <>
                  <p className="text-[16px] font-bold text-gray-800" style={UI}>We couldn't find this page</p>
                  <p className="text-[13px] text-gray-500 mt-1.5 mb-5" style={UI}>
                    {categorySlug ? 'This category' : brandSlug ? 'This brand' : collectionSlug ? 'This collection' : 'This page'} doesn't exist or may have been removed.
                  </p>
                  <Link
                    to="/"
                    className="inline-block bg-purple-700 hover:bg-purple-800 text-white text-[13px] font-bold px-6 py-2.5 rounded-sm transition-colors"
                    style={UI}
                  >
                    Back to Home
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-[16px] font-bold text-gray-800" style={UI}>Something went wrong</p>
                  <p className="text-[13px] text-gray-500 mt-1.5 mb-5" style={UI}>We couldn't load products right now. Please try again.</p>
                  <button
                    onClick={() => refetch()}
                    className="inline-block bg-purple-700 hover:bg-purple-800 text-white text-[13px] font-bold px-6 py-2.5 rounded-sm transition-colors"
                    style={UI}
                  >
                    Retry
                  </button>
                </>
              )}
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-8">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <ProductGrid products={products} isFetching={isFetching} />
              {pagination && (
                <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={filterState.setPage} />
              )}
            </>
          )}
        </div>
      </div>

      <AurusFooter />

      {/* Mobile filter drawer */}
      {mobileSidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[110]" onClick={() => setMobileSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-[300px] bg-white z-[120] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
              <span className="text-[15px] font-bold text-gray-800" style={UI}>
                FILTERS {filterState.totalActive > 0 && `(${filterState.totalActive})`}
              </span>
              <div className="flex items-center gap-3">
                {filterState.totalActive > 0 && (
                  <button onClick={filterState.clearAll} className="text-[12px] text-purple-700 font-semibold" style={UI}>CLEAR ALL</button>
                )}
                <button onClick={() => setMobileSidebarOpen(false)}>
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2">
              <FilterSidebar facets={facets} filterState={filterState} hideCategory={!!categorySlug} />
            </div>
            <div className="px-4 py-4 border-t border-gray-200">
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="w-full bg-purple-700 hover:bg-purple-800 text-white py-3 text-[13px] font-bold tracking-wide transition-colors rounded-sm"
                style={UI}
              >
                APPLY FILTERS
              </button>
            </div>
          </div>
        </>
      )}

      {/* Sticky bottom filter/sort bar — mobile only */}
      <div
        className="lg:hidden fixed bottom-0 inset-x-0 z-[90] bg-white border-t border-gray-200 flex"
        style={{ boxShadow: '0 -2px 8px rgba(0,0,0,0.08)' }}
      >
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-semibold text-gray-700 border-r border-gray-200"
          style={UI}
        >
          <SlidersHorizontal className="w-4 h-4" /> Filter {filterState.totalActive > 0 && `(${filterState.totalActive})`}
        </button>
        <div className="flex-1 relative flex items-center justify-center gap-2 py-3 text-[13px] font-semibold text-gray-700" style={UI}>
          Sort <ChevronDown className="w-4 h-4" />
          <select
            value={filterState.filters.sortBy ?? 'featured'}
            onChange={(e) => filterState.setSort(e.target.value as SortOption)}
            aria-label="Sort products"
            className="absolute inset-0 opacity-0 cursor-pointer w-full"
          >
            {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

    </div>
  );
};

export default AurusListing;
