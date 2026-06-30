/**
 * CategoryIconsSection registry entry.
 *
 * A horizontally scrollable strip of circular category icons.
 * Falls back to API categories, then demo asset provider images.
 */

import React from 'react';
import { mergeWithDefaults, safeParseJson } from '../shared/pipeline';
import { validResult } from '../shared/pipeline';
import type { SectionRegistryEntry, SectionComponentProps, DataResolver, ValidationResult } from '@/themes/registry/types';
import type { StorefrontCategoriesResponse } from '@/lib/storefrontApi';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryIconItem {
  name: string;
  linkUrl: string;
  customImage: string;
}

export interface CategoryIconsConfig {
  items: CategoryIconItem[];
}

export interface CategoryIconsData {
  cats: Array<{ img: string }>;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_ITEMS: CategoryIconItem[] = [
  'Wedding Rings',
  'Solitaire Pendants',
  'Bestselling Styles',
  'New Styles For You',
  'Daily Wear Drops',
  'Gold Rings',
  'Diamond Earrings',
  'Mangalsutra',
].map(name => ({ name, linkUrl: '/jewellery', customImage: '' }));

const DEFAULT: CategoryIconsConfig = {
  items: DEFAULT_ITEMS,
};

// ─── Config pipeline ──────────────────────────────────────────────────────────

function parseConfig(raw: unknown): CategoryIconsConfig {
  const parsed = safeParseJson(raw) as Partial<CategoryIconsConfig>;
  const merged = mergeWithDefaults(parsed, DEFAULT);
  if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
    merged.items = parsed.items;
  }
  return merged;
}

function validateConfig(config: CategoryIconsConfig): ValidationResult<CategoryIconsConfig> {
  return validResult(config);
}

// ─── Data Resolver ────────────────────────────────────────────────────────────

const resolveData: DataResolver<CategoryIconsConfig, CategoryIconsData> = async (_config, context) => {
  const cacheKey = 'categories:icons:10';

  if (context.sharedCache.has(cacheKey)) {
    return { cats: context.sharedCache.get(cacheKey) as CategoryIconsData['cats'] };
  }

  let cats: CategoryIconsData['cats'];

  try {
    const result = await context.fetchStorefront<StorefrontCategoriesResponse>(
      '/storefront/categories?limit=10',
    );
    const apiCats = (result.categories ?? []).map(c => ({ img: c.img }));
    cats = apiCats.some(c => c.img)
      ? apiCats
      : context.demoAssets.getCategoryImages(10);
  } catch {
    cats = context.demoAssets.getCategoryImages(10);
  }

  context.sharedCache.set(cacheKey, cats);
  return { cats };
};

// ─── Component ────────────────────────────────────────────────────────────────

const CategoryIconsSection: React.FC<SectionComponentProps<CategoryIconsConfig, CategoryIconsData>> = ({ config, data }) => {
  const { items } = config;
  const cats = data.cats ?? [];

  return (
    <section className="border-b border-gray-100 bg-white py-7">
      <div className="max-w-[1280px] mx-auto px-4">
        <div className="overflow-x-auto">
          <div className="flex gap-7 sm:gap-10 w-max mx-auto py-1">
            {items.map((item, i) => (
              <a
                key={item.name}
                href={item.linkUrl || '#shop'}
                className="flex flex-col items-center gap-2.5 group w-[70px] text-center flex-shrink-0"
              >
                <div className="w-[58px] h-[58px] sm:w-[64px] sm:h-[64px] rounded-full overflow-hidden border-2 border-gray-200 group-hover:border-purple-500 transition-colors duration-300 bg-purple-50">
                  <img
                    src={item.customImage || cats[i % Math.max(cats.length, 1)]?.img || ''}
                    alt={item.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-400"
                  />
                </div>
                <p className="text-[11px] text-gray-700 group-hover:text-purple-700 leading-tight transition-colors font-medium">
                  {item.name}
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

export const CategoryIconsEntry: SectionRegistryEntry<CategoryIconsConfig, CategoryIconsData> = {
  sectionType:   'category_icons',
  component:     CategoryIconsSection,
  parseConfig,
  defaultConfig: DEFAULT,
  validateConfig,
  resolveData,
  defaultData:   { cats: [] },
  meta: {
    label:            'Category Icons',
    supportsPreview:  true,
    dataRequirements: ['categories'],
  },
};
