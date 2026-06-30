/**
 * CollectionsSection registry entry — Phase S1B.
 *
 * 5 portrait editorial collection cards on a lavender background.
 * Each slot shows a collection name + sub-label in italic serif over the image.
 */

import React from 'react';
import { mergeWithDefaults, safeParseJson } from '../shared/pipeline';
import { validResult } from '../shared/pipeline';
import { UI, SERIF } from '@/themes/aurus/constants';
import type { SectionRegistryEntry, SectionComponentProps, DataResolver, ValidationResult } from '@/themes/registry/types';
import type { StorefrontProductsResponse, StorefrontCategoriesResponse } from '@/lib/storefrontApi';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollectionSlot {
  id:             string;
  customName:     string;
  customSubLabel: string;
  customImage:    string;
  linkUrl:        string;
}

export interface CollectionsConfig {
  backgroundColor: string;
  heading:         string;
  ctaText:         string;
  ctaUrl:          string;
  ctaButtonColor:  string;
  slots:           CollectionSlot[];
}

export interface CollectionsData {
  products: Array<{ id: string; image: string }>;
  cats:     Array<{ img: string }>;
}

const DEFAULT_SLOTS: CollectionSlot[] = [
  { id: '1', customName: 'दश्ता',    customSubLabel: 'Heritage Edit',              customImage: '', linkUrl: '/collections/dashta'    },
  { id: '2', customName: 'Leher',    customSubLabel: 'The dance of waves',         customImage: '', linkUrl: '/collections/leher'     },
  { id: '3', customName: 'Adaa',     customSubLabel: 'BY AURUS',                   customImage: '', linkUrl: '/collections/adaa'      },
  { id: '4', customName: 'aneka',    customSubLabel: 'MANY FORMS, ONE ESSENCE',    customImage: '', linkUrl: '/collections/aneka'     },
  { id: '5', customName: 'Eternity', customSubLabel: 'Luxury, woven in brilliance',customImage: '', linkUrl: '/collections/eternity'  },
];

const DEFAULT: CollectionsConfig = {
  backgroundColor: '#EDE9FE',
  heading:         'Aurus Collections',
  ctaText:         'VIEW ALL COLLECTIONS',
  ctaUrl:          '/collections',
  ctaButtonColor:  '#7C3AED',
  slots:           DEFAULT_SLOTS,
};

function parseConfig(raw: unknown): CollectionsConfig {
  const parsed = safeParseJson(raw) as Partial<CollectionsConfig>;
  const merged = mergeWithDefaults(parsed, DEFAULT);
  // Preserve slots array from config if present
  if (parsed.slots && Array.isArray(parsed.slots) && parsed.slots.length > 0) {
    merged.slots = parsed.slots;
  }
  return merged;
}

function validateConfig(config: CollectionsConfig): ValidationResult<CollectionsConfig> {
  return validResult(config);
}

// ─── Data Resolver ────────────────────────────────────────────────────────────
// Phase S2: products + categories fetched from the public storefront API.
//
// Image fallback chain (matches V1 exactly when demo assets are enabled):
//   1. slot.customImage                 (merchant-uploaded per slot in admin)
//   2. products[idx].image              (real store product image from API)
//   3. context.demoAssets.getProductImages() (injected by orchestrator)
//
// The demoAssets provider is injected via ResolverContext by AurusHomeV2.
// Resolvers never import PRODUCTS.aurus or CATEGORIES.aurus directly.
// In dev mode, the provider returns real Aurus CDN images (pixel-identical to V1).
// In prod mode, the provider returns empty strings (graceful degraded state).
//
// NOTE: Uses a dedicated cache key ('products:collections:8') separate from
// CampaignGrid ('products:all:8') to avoid inheriting empty cached results
// when CampaignGrid runs first and writes [] to the shared cache.

const resolveData: DataResolver<CollectionsConfig, CollectionsData> = async (_config, context) => {
  // ── Products ──────────────────────────────────────────────────────────────
  const productKey = 'products:collections:8';
  let products: CollectionsData['products'];

  if (context.sharedCache.has(productKey)) {
    products = context.sharedCache.get(productKey) as CollectionsData['products'];
  } else {
    try {
      const result = await context.fetchStorefront<StorefrontProductsResponse>(
        '/storefront/products?limit=8',
      );
      const apiProducts = (result.products ?? []).map(p => ({ id: p.id, image: p.image }));
      // Fall back to the injected provider when the store has no product images.
      // The provider decides whether to return demo images (dev) or placeholders (prod).
      products = apiProducts.some(p => p.image)
        ? apiProducts
        : context.demoAssets.getProductImages(8);
    } catch {
      products = context.demoAssets.getProductImages(8);
    }
    context.sharedCache.set(productKey, products);
  }

  // ── Categories ────────────────────────────────────────────────────────────
  const catKey = 'categories:collections:10';
  let cats: CollectionsData['cats'];

  if (context.sharedCache.has(catKey)) {
    cats = context.sharedCache.get(catKey) as CollectionsData['cats'];
  } else {
    try {
      const result = await context.fetchStorefront<StorefrontCategoriesResponse>(
        '/storefront/categories?limit=10',
      );
      const apiCats = (result.categories ?? []).map(c => ({ img: c.img }));
      // Same fallback strategy for category images.
      cats = apiCats.some(c => c.img)
        ? apiCats
        : context.demoAssets.getCategoryImages(10);
    } catch {
      cats = context.demoAssets.getCategoryImages(10);
    }
    context.sharedCache.set(catKey, cats);
  }

  return { products, cats };
};

// ─── Component ────────────────────────────────────────────────────────────────

const CollectionsSection: React.FC<SectionComponentProps<CollectionsConfig, CollectionsData>> = ({ config, data }) => {
  const { slots, heading, ctaText, ctaUrl, ctaButtonColor, backgroundColor } = config;
  const products = data.products ?? [];
  const cats     = data.cats ?? [];

  return (
    <section id="collections" style={{ background: backgroundColor }} className="py-10 sm:py-12">
      <h2 className="text-center text-[26px] font-bold text-gray-900 mb-6 tracking-tight" style={UI}>{heading}</h2>

      <div className="px-2 sm:px-3">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1">
          {slots.map((slot, idx) => {
            const fallbackImg = products[idx]?.image ?? cats[idx % Math.max(cats.length, 1)]?.img ?? '';
            const image = slot.customImage || fallbackImg;
            return (
              <a key={slot.id} href={slot.linkUrl || '#shop'} className="group relative overflow-hidden rounded-lg block" style={{ aspectRatio: '3 / 5' }}>
                <img src={image} alt={slot.customName} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.35) 40%, transparent 70%)' }} />
                <div className="absolute bottom-0 left-0 right-0 px-4 pb-7">
                  <p className="text-white leading-none" style={{ ...SERIF, fontSize: 34, fontWeight: 400, fontStyle: 'italic', textShadow: '0 2px 14px rgba(0,0,0,0.55)', letterSpacing: '-0.01em' }}>{slot.customName}</p>
                  <p className="text-white/65 mt-1.5 leading-none" style={{ ...UI, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}>{slot.customSubLabel}</p>
                </div>
              </a>
            );
          })}
        </div>
      </div>

      <div className="text-center mt-7">
        <a href={ctaUrl} className="inline-block text-white px-10 py-3 text-[13px] font-bold tracking-[0.1em] uppercase transition-colors rounded-sm hover:opacity-90" style={{ ...UI, background: ctaButtonColor }}>{ctaText}</a>
      </div>
    </section>
  );
};

// ─── Registry Entry ───────────────────────────────────────────────────────────

export const CollectionsEntry: SectionRegistryEntry<CollectionsConfig, CollectionsData> = {
  sectionType:    'collections',
  component:      CollectionsSection,
  parseConfig,
  defaultConfig:  DEFAULT,
  validateConfig,
  resolveData,
  defaultData:    { products: [], cats: [] },
  meta: {
    label:            'Collections',
    supportsPreview:  true,
    dataRequirements: ['products', 'categories'],
  },
};
