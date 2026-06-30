/**
 * BridalSection registry entry.
 *
 * Split layout: editorial hero image on the left, product carousel on the right.
 * Products are fetched from /storefront/products using the configured source
 * (tag / category / manual IDs). Fallback: demo assets.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { mergeWithDefaults, safeParseJson } from '../shared/pipeline';
import { validResult } from '../shared/pipeline';
import { inr } from '@/context/StoreContext';
import { UI, SERIF } from '@/themes/aurus/constants';
import type {
  SectionRegistryEntry,
  SectionComponentProps,
  DataResolver,
  ValidationResult,
} from '@/themes/registry/types';
import type { StorefrontProductsResponse } from '@/lib/storefrontApi';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BridalConfig {
  leftPanel: {
    backgroundImage: string;
    backgroundColor: string;
    overlayGradient: string;
    headlineL1: string;
    headlineL2: string;
    ctaText: string;
    ctaUrl: string;
  };
  rightPanel: {
    backgroundColor: string;
    arrowColor: string;
    ctaText: string;
    ctaUrl: string;
    productSource: 'tag' | 'category' | 'manual';
    tag: string;
    categorySlug: string;
    productIds: string;
    maxProducts: number;
  };
}

export interface BridalData {
  products: Array<{ id: string; name: string; price: number; mrp: number; image: string }>;
}

const DEFAULT: BridalConfig = {
  leftPanel: {
    backgroundImage:
      'https://images.unsplash.com/photo-1692992193981-d3d92fabd9cb?auto=format&fit=crop&w=1920&q=80',
    backgroundColor: '#F9E4D4',
    overlayGradient: '#F9C4A0',
    headlineL1: 'For the bride squad',
    headlineL2: '& all the wedding glam',
    ctaText: 'SHOP NOW ▶',
    ctaUrl: '/jewellery/bridal',
  },
  rightPanel: {
    backgroundColor: '#FFFFFF',
    arrowColor: '#6D28D9',
    ctaText: 'Shop Now',
    ctaUrl: '/jewellery/bridal',
    productSource: 'tag',
    tag: 'Bridal',
    categorySlug: '',
    productIds: '',
    maxProducts: 8,
  },
};

function parseConfig(raw: unknown): BridalConfig {
  const parsed = safeParseJson(raw) as Partial<BridalConfig>;
  return mergeWithDefaults(parsed, DEFAULT);
}

function validateConfig(config: BridalConfig): ValidationResult<BridalConfig> {
  return validResult(config);
}

// ─── Data Resolver ────────────────────────────────────────────────────────────

const resolveData: DataResolver<BridalConfig, BridalData> = async (config, context) => {
  const r = config.rightPanel;
  const limit = r.maxProducts ?? 8;

  const cacheKey = `products:bridal:${r.productSource}:${r.tag}:${r.categorySlug}:${r.productIds}:${limit}`;

  if (context.sharedCache.has(cacheKey)) {
    return context.sharedCache.get(cacheKey) as BridalData;
  }

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

  let products: BridalData['products'];

  try {
    const result = await context.fetchStorefront<StorefrontProductsResponse>(
      `/storefront/products?${params.toString()}`,
    );
    const apiProducts = result.products ?? [];
    products = apiProducts.some(p => p.image)
      ? apiProducts
      : context.demoAssets.getFullProducts(limit);
  } catch {
    products = context.demoAssets.getFullProducts(limit);
  }

  const data: BridalData = { products };
  context.sharedCache.set(cacheKey, data);
  return data;
};

// ─── Component ────────────────────────────────────────────────────────────────

const BridalSection: React.FC<SectionComponentProps<BridalConfig, BridalData>> = ({
  config,
  data,
}) => {
  const { leftPanel: l, rightPanel: r } = config;
  const products = data.products ?? [];

  const [c1Idx, setC1Idx] = useState(0);
  const c1Max = Math.max(0, products.length - 4);

  return (
    <section
      className="mx-6 sm:mx-8 mt-4 rounded-2xl overflow-hidden flex flex-col md:flex-row"
      style={{ minHeight: '370px' }}
    >
      {/* Left: editorial image */}
      <div
        className="md:w-1/2 relative overflow-hidden min-h-[260px] md:min-h-0"
        style={{ background: l.backgroundColor }}
      >
        <img
          src={l.backgroundImage}
          alt="For the bride squad"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#F9C4A0]/60 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <div className="absolute bottom-10 left-8 z-10">
          <p
            className="text-white text-[24px] font-light leading-snug drop-shadow-md"
            style={SERIF}
          >
            {l.headlineL1}
          </p>
          <p
            className="text-white text-[24px] font-light leading-snug drop-shadow-md"
            style={SERIF}
          >
            &amp; all the <em>wedding glam</em>
          </p>
        </div>
        <a
          href={l.ctaUrl}
          className="absolute bottom-4 left-8 z-10 text-white text-[11px] font-bold tracking-[0.12em] uppercase flex items-center gap-1 drop-shadow-md"
          style={UI}
        >
          {l.ctaText}
        </a>
      </div>

      {/* Right: product carousel */}
      <div
        className="md:w-1/2 flex flex-col justify-between p-5"
        style={{ background: r.backgroundColor }}
      >
        <div className="flex gap-3 overflow-hidden">
          {products.slice(c1Idx, c1Idx + 4).map((p, i) => (
            <Link
              key={p.id}
              to={`/products/${p.id}`}
              className="flex-shrink-0 group flex-1 min-w-0"
            >
              <div
                className={`aspect-square rounded-xl overflow-hidden bg-white transition-all duration-200 ${
                  i === 0
                    ? 'border-2 border-purple-600 shadow-md'
                    : 'border border-purple-100 shadow-sm group-hover:border-purple-400'
                }`}
              >
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-400"
                />
              </div>
              <div className="mt-2.5 px-0.5">
                <p className="text-[14px] font-bold text-gray-900" style={UI}>
                  {inr(p.price)}
                </p>
                <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-2 leading-snug" style={UI}>
                  {p.name}
                </p>
              </div>
            </Link>
          ))}
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-2">
            <button
              onClick={() => setC1Idx(i => Math.max(0, i - 1))}
              disabled={c1Idx === 0}
              className="w-9 h-9 rounded-full text-white flex items-center justify-center disabled:opacity-35 transition-colors"
              style={{ background: r.arrowColor }}
              aria-label="Previous products"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setC1Idx(i => Math.min(c1Max, i + 1))}
              disabled={c1Idx >= c1Max}
              className="w-9 h-9 rounded-full text-white flex items-center justify-center disabled:opacity-35 transition-colors"
              style={{ background: r.arrowColor }}
              aria-label="Next products"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <a
            href={r.ctaUrl}
            className="text-white text-[13px] font-bold px-10 py-3 transition-colors rounded-full"
            style={{ ...UI, background: r.arrowColor }}
          >
            {r.ctaText}
          </a>
        </div>
      </div>
    </section>
  );
};

// ─── Registry Entry ───────────────────────────────────────────────────────────

export const BridalEntry: SectionRegistryEntry<BridalConfig, BridalData> = {
  sectionType:   'bridal_section',
  component:     BridalSection,
  parseConfig,
  defaultConfig: DEFAULT,
  validateConfig,
  resolveData,
  defaultData:   { products: [] },
  meta: {
    label:            'Bridal Section',
    supportsPreview:  true,
    dataRequirements: ['products'],
  },
};
