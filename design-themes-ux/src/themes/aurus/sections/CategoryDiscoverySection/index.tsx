/**
 * CategoryDiscoverySection registry entry.
 *
 * Horizontal scrolling strip of category thumbnails with a gift-icon callout on
 * the left. Product images are fetched from /storefront/products (fallback: demo
 * assets) and mapped to each category item by index.
 */

import React from 'react';
import { mergeWithDefaults, safeParseJson } from '../shared/pipeline';
import { validResult } from '../shared/pipeline';
import { UI } from '@/themes/aurus/constants';
import type {
  SectionRegistryEntry,
  SectionComponentProps,
  DataResolver,
  ValidationResult,
} from '@/themes/registry/types';
import type { StorefrontProductsResponse } from '@/lib/storefrontApi';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryItem {
  label: string;
  linkUrl: string;
  customImage: string;
}

export interface CategoryDiscoveryConfig {
  backgroundColor: string;
  borderColor: string;
  giftIcon: string;
  giftLabel: string;
  items: CategoryItem[];
}

export interface CategoryDiscoveryData {
  products: Array<{ id: string; image: string }>;
}

const DEFAULT: CategoryDiscoveryConfig = {
  backgroundColor: '#F5EEFF',
  borderColor: '#DDD0F5',
  giftIcon: '🎁',
  giftLabel: 'Gift Her Style',
  items: [
    { label: 'WEDDING BANDS',       linkUrl: '/jewellery/rings',        customImage: '' },
    { label: 'EVERYDAY PENDANTS',   linkUrl: '/jewellery/pendants',     customImage: '' },
    { label: 'BESTSELLING STYLES',  linkUrl: '/jewellery/bestsellers',  customImage: '' },
    { label: 'NEW STYLES FOR KIDS', linkUrl: '/jewellery/kids',         customImage: '' },
    { label: 'DAILYWEAR HOOPS',     linkUrl: '/jewellery/earrings',     customImage: '' },
    { label: 'NOSE PINS',           linkUrl: '/jewellery/nose-pins',    customImage: '' },
    { label: 'GOLD RINGS',          linkUrl: '/jewellery/gold-rings',   customImage: '' },
    { label: 'MANGALSUTRA',         linkUrl: '/jewellery/mangalsutra',  customImage: '' },
  ],
};

function parseConfig(raw: unknown): CategoryDiscoveryConfig {
  const parsed = safeParseJson(raw) as Partial<CategoryDiscoveryConfig>;
  const merged = mergeWithDefaults(parsed, DEFAULT);
  // Preserve items array from config if present
  if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
    merged.items = parsed.items;
  }
  return merged;
}

function validateConfig(
  config: CategoryDiscoveryConfig,
): ValidationResult<CategoryDiscoveryConfig> {
  return validResult(config);
}

// ─── Data Resolver ────────────────────────────────────────────────────────────

const resolveData: DataResolver<CategoryDiscoveryConfig, CategoryDiscoveryData> = async (
  _config,
  context,
) => {
  const cacheKey = 'products:category-discovery:8';

  if (context.sharedCache.has(cacheKey)) {
    return context.sharedCache.get(cacheKey) as CategoryDiscoveryData;
  }

  let products: CategoryDiscoveryData['products'];

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

  const data: CategoryDiscoveryData = { products };
  context.sharedCache.set(cacheKey, data);
  return data;
};

// ─── Component ────────────────────────────────────────────────────────────────

const CategoryDiscoverySection: React.FC<
  SectionComponentProps<CategoryDiscoveryConfig, CategoryDiscoveryData>
> = ({ config, data }) => {
  const products = data.products ?? [];

  return (
    <section
      className="mx-10 sm:mx-16 mt-4 rounded-2xl px-6 py-12"
      style={{ background: config.backgroundColor, border: `1px solid ${config.borderColor}` }}
    >
      <div className="flex items-center gap-4">
        {/* Gift icon callout */}
        <div className="flex-shrink-0 text-center" style={{ width: '130px' }}>
          <div
            className="mx-auto w-[72px] h-[72px] rounded-2xl flex items-center justify-center text-[44px] leading-none select-none"
            style={{
              background: 'linear-gradient(135deg, #C084FC 0%, #9333EA 50%, #7C3AED 100%)',
              boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
            }}
          >
            {config.giftIcon}
          </div>
          <p className="text-gray-700 text-[12px] font-semibold mt-2.5 leading-snug" style={UI}>
            {config.giftLabel}
          </p>
        </div>

        {/* Scrolling category tiles */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="flex gap-4 pb-0.5">
            {config.items.map((item, idx) => (
              <a
                key={item.label}
                href={item.linkUrl || '#shop'}
                className="flex-shrink-0 group text-center"
                style={{ width: '158px' }}
              >
                <div className="aspect-square rounded-2xl overflow-hidden bg-white shadow-sm group-hover:shadow-md transition-all duration-200 border border-[#EEE8F8]">
                  <img
                    src={item.customImage || products[idx % Math.max(products.length, 1)]?.image || ''}
                    alt={item.label}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-400"
                  />
                </div>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-700 mt-2.5 leading-snug group-hover:text-gray-900 transition-colors"
                  style={UI}
                >
                  {item.label}
                </p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Registry Entry ───────────────────────────────────────────────────────────

export const CategoryDiscoveryEntry: SectionRegistryEntry<
  CategoryDiscoveryConfig,
  CategoryDiscoveryData
> = {
  sectionType:   'category_discovery',
  component:     CategoryDiscoverySection,
  parseConfig,
  defaultConfig: DEFAULT,
  validateConfig,
  resolveData,
  defaultData:   { products: [] },
  meta: {
    label:            'Category Discovery',
    supportsPreview:  true,
    dataRequirements: ['products'],
  },
};
