/**
 * useFilters — URL-synced filter state for the Product Listing Page.
 *
 * The URL is the single source of truth (no duplicate local state), so
 * filters survive page refresh and are shareable/bookmarkable, e.g.:
 *   /category/sarees?color=Red&size=M&brand=biba&page=2
 *   /category/sarees?attr_fabric=Silk,Cotton&sortBy=price_asc
 *
 * Attribute facets (fabric, occasion, pattern, season, fit, ...) use the
 * `attr_<slug>` URL key convention (plain, no brackets, easy to read/share)
 * and are translated to the API's `{ attr: { slug: string[] } }` shape here.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ListingQueryParams, SortOption } from '@/lib/storefrontApi';

const ATTR_PREFIX = 'attr_';
const MULTI_KEYS = ['color', 'size', 'badge'] as const;
type MultiKey = typeof MULTI_KEYS[number];

export interface ActiveFilterChip {
  /** URL param key, e.g. 'color' or 'attr_fabric' */
  paramKey: string;
  value:    string;
  label:    string;
}

export interface UseFiltersResult {
  filters: ListingQueryParams;
  toggleMulti: (key: MultiKey, value: string) => void;
  toggleAttr:  (slug: string, value: string) => void;
  setPriceRange: (min?: number, max?: number) => void;
  setRating:      (rating?: number) => void;
  setDiscountMin: (discount?: number) => void;
  setInStock:     (inStock: boolean) => void;
  setBrand:       (slug?: string) => void;
  setCollection:  (slug?: string) => void;
  setSearch:      (q: string) => void;
  setSort:        (sortBy: SortOption) => void;
  setPage:        (page: number) => void;
  removeChip:     (chip: ActiveFilterChip) => void;
  clearAll:       () => void;
  activeChips:    ActiveFilterChip[];
  totalActive:    number;
}

function csv(value: string | null): string[] | undefined {
  if (!value) return undefined;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export function useFilters(categorySlug?: string): UseFiltersResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<ListingQueryParams>(() => {
    const attr: Record<string, string[]> = {};
    for (const [key, value] of searchParams.entries()) {
      if (key.startsWith(ATTR_PREFIX)) {
        const slug = key.slice(ATTR_PREFIX.length);
        const values = csv(value);
        if (values?.length) attr[slug] = values;
      }
    }
    return {
      categorySlug,
      brandSlug:      searchParams.get('brand') ?? undefined,
      collectionSlug: searchParams.get('collection') ?? undefined,
      q:              searchParams.get('q') ?? undefined,
      priceMin:       searchParams.get('priceMin') ? Number(searchParams.get('priceMin')) : undefined,
      priceMax:       searchParams.get('priceMax') ? Number(searchParams.get('priceMax')) : undefined,
      color:          csv(searchParams.get('color')),
      size:           csv(searchParams.get('size')),
      badge:          csv(searchParams.get('badge')),
      attr:           Object.keys(attr).length ? attr : undefined,
      inStock:        searchParams.get('inStock') === 'true',
      discountMin:    searchParams.get('discountMin') ? Number(searchParams.get('discountMin')) : undefined,
      rating:         searchParams.get('rating') ? Number(searchParams.get('rating')) : undefined,
      sortBy:         (searchParams.get('sortBy') as SortOption) ?? undefined,
      page:           searchParams.get('page') ? Number(searchParams.get('page')) : 1,
    };
  }, [searchParams, categorySlug]);

  /** Mutates params and always resets `page` back to 1 unless explicitly setting page itself. */
  const update = useCallback((mutate: (params: URLSearchParams) => void, resetPage = true) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      mutate(next);
      if (resetPage) next.delete('page');
      return next;
    });
  }, [setSearchParams]);

  const toggleMulti = useCallback((key: MultiKey, value: string) => {
    update((params) => {
      const current = csv(params.get(key)) ?? [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      if (next.length) params.set(key, next.join(',')); else params.delete(key);
    });
  }, [update]);

  const toggleAttr = useCallback((slug: string, value: string) => {
    const paramKey = `${ATTR_PREFIX}${slug}`;
    update((params) => {
      const current = csv(params.get(paramKey)) ?? [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      if (next.length) params.set(paramKey, next.join(',')); else params.delete(paramKey);
    });
  }, [update]);

  const setPriceRange = useCallback((min?: number, max?: number) => {
    update((params) => {
      if (min !== undefined) params.set('priceMin', String(min)); else params.delete('priceMin');
      if (max !== undefined) params.set('priceMax', String(max)); else params.delete('priceMax');
    });
  }, [update]);

  const setRating = useCallback((rating?: number) => {
    update((params) => { if (rating !== undefined) params.set('rating', String(rating)); else params.delete('rating'); });
  }, [update]);

  const setDiscountMin = useCallback((discount?: number) => {
    update((params) => { if (discount !== undefined) params.set('discountMin', String(discount)); else params.delete('discountMin'); });
  }, [update]);

  const setInStock = useCallback((inStock: boolean) => {
    update((params) => { if (inStock) params.set('inStock', 'true'); else params.delete('inStock'); });
  }, [update]);

  const setBrand = useCallback((slug?: string) => {
    update((params) => { if (slug) params.set('brand', slug); else params.delete('brand'); });
  }, [update]);

  const setCollection = useCallback((slug?: string) => {
    update((params) => { if (slug) params.set('collection', slug); else params.delete('collection'); });
  }, [update]);

  const setSearch = useCallback((q: string) => {
    update((params) => { if (q.trim()) params.set('q', q.trim()); else params.delete('q'); });
  }, [update]);

  const setSort = useCallback((sortBy: SortOption) => {
    update((params) => params.set('sortBy', sortBy));
  }, [update]);

  const setPage = useCallback((page: number) => {
    update((params) => {
      if (page > 1) params.set('page', String(page)); else params.delete('page');
    }, false);
  }, [update]);

  const activeChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    for (const key of MULTI_KEYS) {
      for (const value of filters[key] ?? []) chips.push({ paramKey: key, value, label: value });
    }
    if (filters.brandSlug)      chips.push({ paramKey: 'brand',      value: filters.brandSlug,      label: filters.brandSlug });
    if (filters.collectionSlug) chips.push({ paramKey: 'collection', value: filters.collectionSlug, label: filters.collectionSlug });
    if (filters.rating)         chips.push({ paramKey: 'rating',     value: String(filters.rating),     label: `${filters.rating}★ & above` });
    if (filters.discountMin)    chips.push({ paramKey: 'discountMin',value: String(filters.discountMin),label: `${filters.discountMin}% off or more` });
    if (filters.inStock)        chips.push({ paramKey: 'inStock',    value: 'true',                     label: 'In Stock' });
    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      chips.push({ paramKey: 'price', value: 'range', label: `₹${filters.priceMin ?? 0} – ₹${filters.priceMax ?? '∞'}` });
    }
    for (const [slug, values] of Object.entries(filters.attr ?? {})) {
      for (const value of values) chips.push({ paramKey: `${ATTR_PREFIX}${slug}`, value, label: value });
    }
    return chips;
  }, [filters]);

  const removeChip = useCallback((chip: ActiveFilterChip) => {
    if (chip.paramKey === 'price') { setPriceRange(undefined, undefined); return; }
    if (chip.paramKey === 'rating') { setRating(undefined); return; }
    if (chip.paramKey === 'discountMin') { setDiscountMin(undefined); return; }
    if (chip.paramKey === 'inStock') { setInStock(false); return; }
    if (chip.paramKey === 'brand') { setBrand(undefined); return; }
    if (chip.paramKey === 'collection') { setCollection(undefined); return; }
    if (chip.paramKey.startsWith(ATTR_PREFIX)) { toggleAttr(chip.paramKey.slice(ATTR_PREFIX.length), chip.value); return; }
    toggleMulti(chip.paramKey as MultiKey, chip.value);
  }, [setPriceRange, setRating, setDiscountMin, setInStock, setBrand, setCollection, toggleAttr, toggleMulti]);

  const clearAll = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams();
      const q = prev.get('q');
      if (q) next.set('q', q); // preserve keyword search across "clear all filters"
      return next;
    });
  }, [setSearchParams]);

  const totalActive = activeChips.length;

  return {
    filters, toggleMulti, toggleAttr, setPriceRange, setRating, setDiscountMin,
    setInStock, setBrand, setCollection, setSearch, setSort, setPage,
    removeChip, clearAll, activeChips, totalActive,
  };
}
