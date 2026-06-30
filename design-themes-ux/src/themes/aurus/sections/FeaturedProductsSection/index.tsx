/**
 * FeaturedProductsSection registry entry — Phase S2 (real API data).
 *
 * Aurus "Polki Brand Section": dark editorial image on the left (~42% width),
 * lavender product carousel on the right (~58% width).
 *
 * Phase S2: product data fetched from GET /storefront/products via the
 * Data Resolver layer. The SectionRenderer remains presentation-only.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { mergeWithDefaults, safeParseJson } from '../shared/pipeline';
import { validResult, invalidResult } from '../shared/pipeline';
import { inr } from '@/context/StoreContext';
import { UI } from '@/themes/aurus/constants';
import type { SectionRegistryEntry, SectionComponentProps, DataResolver, ValidationResult } from '@/themes/registry/types';
import type { StorefrontProductsResponse } from '@/lib/storefrontApi';

// ─── Types ────────────────────────────────────────────────────────────────────

const BANNER_SLIDE_2 = 'https://images.unsplash.com/photo-1761125135357-99cbe52a6271?auto=format&fit=crop&w=800&h=1100&q=85';

export interface FeaturedProductsConfig {
  leftPanel: {
    image:           string;
    overlayOpacity:  number;
    linkUrl:         string;
  };
  rightPanel: {
    backgroundColor: string;
    productSource:   'manual' | 'tag' | 'category';
    productIds:      string;
    tag:             string;
    categorySlug:    string;
    maxProducts:     number;
    arrowColor:      string;
    ctaText:         string;
    ctaUrl:          string;
  };
}

export interface FeaturedProductsData {
  products: Array<{ id: string; name: string; price: number; mrp: number; image: string }>;
}

const DEFAULT: FeaturedProductsConfig = {
  leftPanel:  { image: BANNER_SLIDE_2, overlayOpacity: 15, linkUrl: '' },
  rightPanel: { backgroundColor: '#FFFFFF', productSource: 'tag', productIds: '', tag: 'Bestseller', categorySlug: '', maxProducts: 12, arrowColor: '#3D0F6E', ctaText: 'Shop Now', ctaUrl: '/jewellery' },
};

function parseConfig(raw: unknown): FeaturedProductsConfig {
  const parsed = safeParseJson(raw) as Partial<FeaturedProductsConfig>;
  return mergeWithDefaults(parsed, DEFAULT);
}

function validateConfig(config: FeaturedProductsConfig): ValidationResult<FeaturedProductsConfig> {
  const errors: Record<string, string> = {};
  if (!config.rightPanel.ctaText?.trim()) errors['rightPanel.ctaText'] = 'CTA text is required';
  if (!config.rightPanel.ctaUrl?.trim())  errors['rightPanel.ctaUrl']  = 'CTA URL is required';
  return Object.keys(errors).length ? invalidResult(config, errors) : validResult(config);
}

// ─── Data Resolver ────────────────────────────────────────────────────────────
// Phase S2: calls GET /storefront/products with the configured source.
// The sharedCache prevents duplicate fetches when multiple sections need products.

const resolveData: DataResolver<FeaturedProductsConfig, FeaturedProductsData> = async (config, context) => {
  const r = config.rightPanel;
  const limit = r.maxProducts ?? 12;

  // Build a canonical cache key for deduplication across sections
  const cacheKey = `products:featured:${r.productSource}:${r.tag}:${r.categorySlug}:${r.productIds}:${limit}`;
  if (context.sharedCache.has(cacheKey)) {
    return context.sharedCache.get(cacheKey) as FeaturedProductsData;
  }

  // Build query parameters based on the merchant-configured source
  const params = new URLSearchParams({ limit: String(limit) });
  switch (r.productSource) {
    case 'tag':
      if (r.tag?.trim()) params.set('tag', r.tag.trim());
      break;
    case 'category':
      if (r.categorySlug?.trim()) params.set('categorySlug', r.categorySlug.trim());
      break;
    case 'manual':
      if (r.productIds?.trim()) params.set('ids', r.productIds.trim());
      break;
  }

  const result = await context.fetchStorefront<StorefrontProductsResponse>(
    `/storefront/products?${params.toString()}`,
  );

  const apiProducts = result.products ?? [];
  // Fall back to demo assets (dev) or empty list (prod) when the store has no products.
  // This keeps the section pixel-identical to V1 in dev mode and avoids an empty lavender panel.
  const products = apiProducts.some(p => p.image)
    ? apiProducts
    : context.demoAssets.getFullProducts(limit);

  const data: FeaturedProductsData = { products };
  context.sharedCache.set(cacheKey, data);
  return data;
};

// ─── Component ────────────────────────────────────────────────────────────────

const FeaturedProductsSection: React.FC<SectionComponentProps<FeaturedProductsConfig, FeaturedProductsData>> = ({ config, data }) => {
  const { leftPanel: l, rightPanel: r } = config;
  const products = data.products ?? [];
  const polkiVisible = 4;
  const polkiMax = Math.max(0, products.length - polkiVisible);

  const [polkiIdx, setPolkiIdx] = useState(0);

  return (
    <section className="flex flex-col md:flex-row mx-6 sm:mx-8 mb-6 rounded-2xl overflow-hidden" style={{ minHeight: '380px' }}>
      {/* Left: dark editorial image */}
      <div className="md:w-[42%] w-full relative bg-[#0A0714] overflow-hidden min-h-[300px] md:min-h-0 flex-shrink-0">
        <img src={l.image || BANNER_SLIDE_2} alt="Festive Collection" className="absolute inset-0 w-full h-full object-cover object-center" draggable={false} />
        <div className="absolute inset-0 bg-black" style={{ opacity: l.overlayOpacity / 100 }} />
      </div>

      {/* Right: lavender product carousel */}
      <div className="flex-1 w-full px-5 sm:px-6 pt-5 pb-5 flex flex-col justify-between overflow-hidden" style={{ background: r.backgroundColor }}>
        <div className="flex gap-4 overflow-hidden">
          {products.slice(polkiIdx, polkiIdx + polkiVisible).map((p, i) => (
            <Link key={p.id} to={`/products/${p.id}`} className="flex-shrink-0 group" style={{ width: i === 0 ? '195px' : '175px' }}>
              <div className={`aspect-square bg-white overflow-hidden border-2 transition-all duration-200 rounded-xl ${i === 0 ? 'border-purple-400 shadow-[0_4px_20px_rgba(107,33,168,0.2)]' : 'border-transparent hover:border-purple-300 hover:shadow-md'}`}>
                <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-400" />
              </div>
              <div className="mt-3 pr-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[14px] font-bold text-gray-900" style={UI}>{inr(p.price)}</span>
                  <span className="text-[11px] text-gray-400 line-through">{inr(p.mrp)}</span>
                </div>
                <p className="text-[12px] text-gray-600 mt-0.5 leading-tight line-clamp-2" style={UI}>{p.name}</p>
              </div>
            </Link>
          ))}
        </div>
        <div className="flex items-center justify-between mt-6">
          <div className="flex gap-2.5">
            <button onClick={() => setPolkiIdx(i => Math.max(0, i - 1))} disabled={polkiIdx === 0} className="w-9 h-9 rounded-full text-white flex items-center justify-center disabled:opacity-35 transition-colors" style={{ background: r.arrowColor }} aria-label="Previous products"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setPolkiIdx(i => Math.min(polkiMax, i + 1))} disabled={polkiIdx >= polkiMax} className="w-9 h-9 rounded-full text-white flex items-center justify-center disabled:opacity-35 transition-colors" style={{ background: r.arrowColor }} aria-label="Next products"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <button className="text-white text-[13px] font-bold px-12 py-3 transition-colors tracking-wide rounded-full" style={{ ...UI, background: r.arrowColor }} onClick={() => setPolkiIdx(0)}>{r.ctaText}</button>
        </div>
      </div>
    </section>
  );
};

// ─── Registry Entry ───────────────────────────────────────────────────────────

export const FeaturedProductsEntry: SectionRegistryEntry<FeaturedProductsConfig, FeaturedProductsData> = {
  sectionType:    'featured_products',
  component:      FeaturedProductsSection,
  parseConfig,
  defaultConfig:  DEFAULT,
  validateConfig,
  resolveData,
  defaultData:    { products: [] },
  meta: {
    label:            'Featured Products',
    supportsPreview:  true,
    dataRequirements: ['products'],
  },
};
