/**
 * EditorialBannersSection registry entry.
 *
 * 2-page carousel with 3 editorial banner panels per page.
 * Each panel has a solid or gradient background + floating product images.
 * sectionType: 'editorial_banners'
 */

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { mergeWithDefaults, safeParseJson, validResult } from '../shared/pipeline';
import { UI, SERIF } from '@/themes/aurus/constants';
import type {
  SectionRegistryEntry,
  SectionComponentProps,
  DataResolver,
  ValidationResult,
} from '@/themes/registry/types';
import type { StorefrontProductsResponse } from '@/lib/storefrontApi';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BannerPanel {
  backgroundColor: string;
  gradientFrom: string;
  gradientTo: string;
  useGradient: boolean;
  headline: string;
  headlineStyle: 'sans' | 'serif';
  subtitle: string;
  ctaText: string;
  ctaUrl: string;
  ctaStyle: 'dark' | 'rounded-dark' | 'link';
  productImageSlots: number[];
}

export interface EditorialBannersConfig {
  pages: BannerPanel[][];
}

export interface EditorialBannersData {
  products: Array<{ id: string; image: string }>;
}

// ─── Default config ───────────────────────────────────────────────────────────

const DEFAULT: EditorialBannersConfig = {
  pages: [
    [
      {
        backgroundColor: '#EEE6FF',
        gradientFrom: '',
        gradientTo: '',
        useGradient: false,
        headline: '9KT Gold',
        headlineStyle: 'sans',
        subtitle: 'Because everyday moments deserve gold',
        ctaText: 'STARTING AT ₹5000',
        ctaUrl: '/jewellery/gold',
        ctaStyle: 'dark',
        productImageSlots: [1, 3],
      },
      {
        backgroundColor: '',
        gradientFrom: '#D4836A',
        gradientTo: '#B85A3F',
        useGradient: true,
        headline: 'Golden Hour Styles',
        headlineStyle: 'serif',
        subtitle: 'The summer your style got prettier!',
        ctaText: 'SHOP NOW',
        ctaUrl: '/jewellery/gold',
        ctaStyle: 'rounded-dark',
        productImageSlots: [0, 2],
      },
      {
        backgroundColor: '#F5EAE0',
        gradientFrom: '',
        gradientTo: '',
        useGradient: false,
        headline: 'Pretty in purple,',
        headlineStyle: 'serif',
        subtitle: 'powerful in shine',
        ctaText: 'SHOP NOW ▶',
        ctaUrl: '/jewellery/purple',
        ctaStyle: 'link',
        productImageSlots: [5, 7],
      },
    ],
    [
      {
        backgroundColor: '#E0F4EC',
        gradientFrom: '',
        gradientTo: '',
        useGradient: false,
        headline: 'Diamond Studded',
        headlineStyle: 'sans',
        subtitle: 'Elegance in every facet',
        ctaText: 'SHOP DIAMONDS',
        ctaUrl: '/jewellery/diamonds',
        ctaStyle: 'rounded-dark',
        productImageSlots: [4],
      },
      {
        backgroundColor: '',
        gradientFrom: '#4A1D96',
        gradientTo: '#6D28D9',
        useGradient: true,
        headline: 'Midnight Collection',
        headlineStyle: 'serif',
        subtitle: 'Bold, dark, and brilliant',
        ctaText: 'EXPLORE',
        ctaUrl: '/jewellery/midnight',
        ctaStyle: 'dark',
        productImageSlots: [6],
      },
      {
        backgroundColor: '#FFF0F5',
        gradientFrom: '',
        gradientTo: '',
        useGradient: false,
        headline: 'Rose Gold Edit',
        headlineStyle: 'serif',
        subtitle: 'Soft tones, strong style',
        ctaText: 'SHOP NOW ▶',
        ctaUrl: '/jewellery/rose-gold',
        ctaStyle: 'link',
        productImageSlots: [2],
      },
    ],
  ],
};

function parseConfig(raw: unknown): EditorialBannersConfig {
  const parsed = safeParseJson(raw) as Partial<EditorialBannersConfig>;
  return mergeWithDefaults(parsed, DEFAULT);
}

function validateConfig(
  config: EditorialBannersConfig,
): ValidationResult<EditorialBannersConfig> {
  return validResult(config);
}

// ─── Data Resolver ────────────────────────────────────────────────────────────

const resolveData: DataResolver<EditorialBannersConfig, EditorialBannersData> = async (
  _config,
  context,
) => {
  const cacheKey = 'products:editorial:8';
  let products: EditorialBannersData['products'];

  if (context.sharedCache.has(cacheKey)) {
    products = context.sharedCache.get(cacheKey) as EditorialBannersData['products'];
  } else {
    try {
      const result = await context.fetchStorefront<StorefrontProductsResponse>(
        '/storefront/products?limit=8',
      );
      const apiProducts = (result.products ?? []).map(p => ({ id: p.id, image: p.image }));
      products = apiProducts.some(p => p.image)
        ? apiProducts
        : context.demoAssets.getProductImages(8);
    } catch {
      products = context.demoAssets.getProductImages(8);
    }
    context.sharedCache.set(cacheKey, products);
  }

  return { products };
};

// ─── Component ────────────────────────────────────────────────────────────────

function renderCta(
  ctaStyle: BannerPanel['ctaStyle'],
  ctaText: string,
  ctaUrl: string,
) {
  if (ctaStyle === 'link') {
    return (
      <a
        href={ctaUrl}
        className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-gray-800 hover:text-gray-600 tracking-widest transition-colors"
        style={UI}
      >
        {ctaText}
      </a>
    );
  }
  if (ctaStyle === 'rounded-dark') {
    return (
      <button
        className="mt-4 bg-gray-900 hover:bg-gray-700 text-white text-[11px] font-bold px-6 py-2.5 tracking-wide transition-colors rounded-full"
        style={UI}
        onClick={() => { window.location.href = ctaUrl; }}
      >
        {ctaText}
      </button>
    );
  }
  // 'dark'
  return (
    <button
      className="mt-4 bg-gray-900 hover:bg-gray-700 text-white text-[11px] font-bold px-5 py-2.5 tracking-wide transition-colors"
      style={UI}
      onClick={() => { window.location.href = ctaUrl; }}
    >
      {ctaText}
    </button>
  );
}

const EditorialBannersSection: React.FC<
  SectionComponentProps<EditorialBannersConfig, EditorialBannersData>
> = ({ config, data }) => {
  const [page, setPage] = useState(0);
  const products = data.products ?? [];
  const TOTAL_PAGES = config.pages.length;
  const currentPage = config.pages[page] ?? [];

  return (
    <section className="mx-6 sm:mx-8 mt-4 rounded-2xl overflow-hidden bg-white">
      <div className="flex gap-3 p-3" style={{ minHeight: '300px' }}>
        {currentPage.map((panel, idx) => {
          const bg = panel.useGradient
            ? `linear-gradient(145deg, ${panel.gradientFrom} 0%, ${panel.gradientTo} 100%)`
            : panel.backgroundColor;

          const headlineEl =
            panel.headlineStyle === 'serif' ? (
              <h3 className="text-gray-900 text-[24px] font-semibold leading-tight" style={SERIF}>
                {panel.headline}
              </h3>
            ) : (
              <h3 className="text-gray-900 text-[26px] font-semibold leading-none" style={UI}>
                {panel.headline}
              </h3>
            );

          const textColor = panel.useGradient ? 'text-white' : 'text-gray-700';
          const subtitleStyle = panel.useGradient
            ? { ...UI, color: 'rgba(255,255,255,0.85)' }
            : UI;
          const headlineOverride = panel.useGradient
            ? { ...SERIF, color: '#fff' }
            : panel.headlineStyle === 'serif'
            ? SERIF
            : UI;

          return (
            <div
              key={idx}
              className="flex-1 relative rounded-xl overflow-hidden flex flex-col justify-between p-6"
              style={{ background: bg }}
            >
              {/* Floating product images */}
              {panel.productImageSlots.length > 0 && (
                <div className="absolute top-3 right-3 w-[55%] h-[70%] pointer-events-none">
                  {panel.productImageSlots[0] !== undefined && (
                    <img
                      src={products[panel.productImageSlots[0]]?.image ?? ''}
                      alt=""
                      className="absolute top-0 right-0 w-[80%] object-contain"
                      style={{ mixBlendMode: panel.useGradient ? 'normal' : 'multiply', opacity: panel.useGradient ? 0.9 : 1 }}
                    />
                  )}
                  {panel.productImageSlots[1] !== undefined && (
                    <img
                      src={products[panel.productImageSlots[1]]?.image ?? ''}
                      alt=""
                      className="absolute bottom-0 right-4 w-[60%] object-contain"
                      style={{ mixBlendMode: panel.useGradient ? 'normal' : 'multiply', opacity: panel.useGradient ? 0.8 : 1 }}
                    />
                  )}
                </div>
              )}

              {/* Text content */}
              <div className="relative z-10 mt-auto pt-24">
                <h3
                  className={`text-[24px] font-semibold leading-tight ${panel.useGradient ? 'text-white' : 'text-gray-900'}`}
                  style={panel.headlineStyle === 'serif' ? headlineOverride : { ...UI, color: panel.useGradient ? '#fff' : '#111' }}
                >
                  {panel.headline}
                </h3>
                <p
                  className={`text-[13px] mt-1.5 leading-snug ${textColor}`}
                  style={subtitleStyle}
                >
                  {panel.subtitle}
                </p>
                {renderCta(panel.ctaStyle, panel.ctaText, panel.ctaUrl)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="relative flex items-center justify-center px-4 pb-4">
        <div className="flex items-center gap-2">
          {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`transition-all duration-300 rounded-full ${
                i === page
                  ? 'w-7 h-[7px] bg-gray-800'
                  : 'w-[7px] h-[7px] bg-gray-400 hover:bg-gray-600'
              }`}
              aria-label={`Go to page ${i + 1}`}
            />
          ))}
        </div>
        <div className="absolute right-4 bottom-0 flex gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="w-9 h-9 rounded-full bg-purple-800 hover:bg-purple-900 text-white flex items-center justify-center disabled:opacity-35 transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPage(p => Math.min(TOTAL_PAGES - 1, p + 1))}
            disabled={page >= TOTAL_PAGES - 1}
            className="w-9 h-9 rounded-full bg-purple-800 hover:bg-purple-900 text-white flex items-center justify-center disabled:opacity-35 transition-colors"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};

// ─── Registry Entry ───────────────────────────────────────────────────────────

export const EditorialBannersEntry: SectionRegistryEntry<
  EditorialBannersConfig,
  EditorialBannersData
> = {
  sectionType: 'editorial_banners',
  component: EditorialBannersSection,
  parseConfig,
  defaultConfig: DEFAULT,
  validateConfig,
  resolveData,
  defaultData: { products: [] },
  meta: {
    label: 'Editorial Banners',
    supportsPreview: true,
    dataRequirements: ['products'],
  },
};
