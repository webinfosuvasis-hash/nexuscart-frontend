/**
 * CampaignGridSection registry entry — Phase S1B.
 *
 * 3-panel campaign layout (2×2 CSS grid):
 *   Left (row-span-2):  SHAYA pink — 2×2 product thumbnails + sale text
 *   Top-right:          SHAYA Diamonds teal — model + offer
 *   Bottom-right:       Latest Designs cream — typography + CTA
 */

import React from 'react';
import { mergeWithDefaults, safeParseJson } from '../shared/pipeline';
import { validResult } from '../shared/pipeline';
import { UI, SERIF } from '@/themes/aurus/constants';
import type { SectionRegistryEntry, SectionComponentProps, DataResolver, ValidationResult } from '@/themes/registry/types';
import type { StorefrontProductsResponse } from '@/lib/storefrontApi';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CampaignGridConfig {
  leftPanel: {
    backgroundColor: string;
    brandLabel1:     string;
    brandLabel2:     string;
    craftNote:       string;
    saleHeadline:    string;
    offerText:       string;
    offerSubtitle:   string;
    disclaimer:      string;
  };
  topRight: {
    gradientFrom:       string;
    gradientTo:         string;
    brandLabel:         string;
    headline:           string;
    headlineSuperscript:string;
    subtitle:           string;
    bodyNote:           string;
    disclaimer:         string;
  };
  bottomRight: {
    backgroundColor: string;
    subLabel:        string;
    headlinePart1:   string;
    headlinePart2:   string;
    ctaText:         string;
    ctaUrl:          string;
  };
}

export interface CampaignGridData {
  products: Array<{ id: string; image: string }>;
  heroImg:  string;
}

const DEFAULT: CampaignGridConfig = {
  leftPanel:   { backgroundColor: '#F2899D', brandLabel1: 'SHAYA', brandLabel2: 'by AURUS', craftNote: 'Crafted in 925 Silver', saleHeadline: 'Big Sale Alert', offerText: 'Upto 50% Off', offerSubtitle: 'on Silver Jewellery', disclaimer: 'TCA' },
  topRight:    { gradientFrom: '#6DC5B0', gradientTo: '#2D8B7A', brandLabel: 'SHAYA DIAMONDS', headline: 'FLAT 10% OFF', headlineSuperscript: '*', subtitle: 'on MRP of all Designs', bodyNote: 'Natural Diamonds in 925 Silver from ₹5000', disclaimer: '*TCA' },
  bottomRight: { backgroundColor: '#F0E6D4', subLabel: 'More Earrings, More Fun!', headlinePart1: 'LATEST', headlinePart2: 'Designs', ctaText: 'SHOP NOW ▶', ctaUrl: '/jewellery/new-arrivals' },
};

function parseConfig(raw: unknown): CampaignGridConfig {
  const parsed = safeParseJson(raw) as Partial<CampaignGridConfig>;
  return mergeWithDefaults(parsed, DEFAULT);
}

function validateConfig(config: CampaignGridConfig): ValidationResult<CampaignGridConfig> {
  return validResult(config);
}

// ─── Data Resolver ────────────────────────────────────────────────────────────
// Phase S2: product images fetched from GET /storefront/products.
// Falls back to context.demoAssets (injected by orchestrator) when no real
// product images are available — never imports PRODUCTS.aurus directly.

const resolveData: DataResolver<CampaignGridConfig, CampaignGridData> = async (_config, context) => {
  const cacheKey = 'products:all:8';
  let products: CampaignGridData['products'];

  if (context.sharedCache.has(cacheKey)) {
    products = context.sharedCache.get(cacheKey) as CampaignGridData['products'];
  } else {
    try {
      const result = await context.fetchStorefront<StorefrontProductsResponse>(
        '/storefront/products?limit=8',
      );
      const apiProducts = (result.products ?? []).map(p => ({ id: p.id, image: p.image }));
      // Fall back to the injected demo provider when no real product images exist.
      products = apiProducts.some(p => p.image)
        ? apiProducts
        : context.demoAssets.getProductImages(8);
    } catch {
      products = context.demoAssets.getProductImages(8);
    }
    context.sharedCache.set(cacheKey, products);
  }

  // heroImg: use the model image configured in the section config (Phase S2+).
  // Falls back to an empty string — the component handles this gracefully.
  const heroImg = (_config as any)?.topRight?.modelImage ?? '';

  return { products, heroImg };
};

// ─── Component ────────────────────────────────────────────────────────────────

const CampaignGridSection: React.FC<SectionComponentProps<CampaignGridConfig, CampaignGridData>> = ({ config, data }) => {
  const { leftPanel: l, topRight: t, bottomRight: b } = config;
  const products = data.products ?? [];
  const heroImg  = data.heroImg ?? '';

  return (
    <section className="grid grid-cols-2 grid-rows-2 mx-6 sm:mx-8 mt-4 rounded-2xl overflow-hidden bg-white gap-3 p-3" style={{ height: '492px' }}>

      {/* Left full-height — pink sale panel */}
      <div className="row-span-2 relative overflow-hidden rounded-xl flex flex-col justify-between p-5" style={{ background: l.backgroundColor }}>
        <div className="flex items-start justify-between relative z-10 flex-shrink-0">
          <div>
            <p className="text-white text-[17px] font-black tracking-[0.05em]" style={UI}>{l.brandLabel1}</p>
            <p className="text-white/90 text-[12px] font-medium tracking-wide" style={UI}>{l.brandLabel2}</p>
          </div>
          <p className="text-gray-800 text-[12px] font-medium text-right leading-snug" style={UI}>{l.craftNote.split(' in ').length > 1 ? <>Crafted in<br /><strong>{l.craftNote.split(' in ')[1]}</strong></> : l.craftNote}</p>
        </div>
        <div className="absolute grid grid-cols-2 gap-2 pointer-events-none" style={{ top: 68, left: 12, right: 12, bottom: 140 }}>
          {products.slice(0, 4).map((p, i) => (
            <div key={i} className="w-full h-full rounded-xl overflow-hidden">
              <img src={p.image} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
        <div className="relative z-10 flex-shrink-0 pt-3" style={{ background: `linear-gradient(to top, ${l.backgroundColor} 70%, transparent)` }}>
          <h3 className="text-gray-900 text-[24px] font-semibold leading-tight" style={UI}>{l.saleHeadline}</h3>
          <p className="text-gray-900 text-[40px] font-black leading-none mt-0.5" style={UI}>{l.offerText}</p>
          <p className="text-gray-800 text-[13px] mt-1" style={UI}>{l.offerSubtitle}</p>
        </div>
        <p className="absolute bottom-3 left-5 text-gray-700/60 text-[10px] z-10" style={UI}>{l.disclaimer}</p>
      </div>

      {/* Top-right — teal diamond panel */}
      <div className="relative overflow-hidden rounded-xl flex" style={{ background: `linear-gradient(135deg, ${t.gradientFrom} 0%, ${t.gradientTo} 100%)` }}>
        <div className="relative w-[45%] h-full overflow-hidden flex-shrink-0">
          <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent" style={{ '--tw-gradient-to': t.gradientTo + '99' } as any} />
        </div>
        <div className="flex-1 flex flex-col justify-between p-4 pl-3">
          <p className="text-white font-black text-[13px] tracking-wide" style={UI}>{t.brandLabel}</p>
          <div>
            <h3 className="text-white text-[28px] font-black leading-none" style={UI}>{t.headline}<span className="text-[16px]">{t.headlineSuperscript}</span></h3>
            <p className="text-white/85 text-[11px] mt-0.5" style={UI}>{t.subtitle}</p>
            <div className="flex gap-1 mt-2">
              {products.slice(0, 3).map((p, i) => (
                <img key={i} src={p.image} alt="" className="w-12 h-12 object-contain rounded bg-white/20" />
              ))}
            </div>
            <p className="text-white/80 text-[10px] mt-2 leading-snug font-medium" style={UI}>{t.bodyNote}</p>
          </div>
          <p className="text-white/40 text-[9px]" style={UI}>{t.disclaimer}</p>
        </div>
      </div>

      {/* Bottom-right — cream typography panel */}
      <div className="relative overflow-hidden rounded-xl flex items-center justify-between px-7 py-5" style={{ background: b.backgroundColor }}>
        <div className="absolute top-2 right-2 flex items-end gap-2">
          {products[5] && <img src={products[5].image} alt="" className="w-[64px] h-[64px] object-contain pointer-events-none" style={{ mixBlendMode: 'multiply' }} />}
          {products[3] && <img src={products[3].image} alt="" className="w-[80px] h-[80px] object-contain pointer-events-none" style={{ mixBlendMode: 'multiply' }} />}
        </div>
        <div>
          <p className="text-gray-600 text-[11px] mb-1 tracking-wide" style={UI}>{b.subLabel}</p>
          <div className="leading-none">
            <span className="block text-gray-900 font-black text-[40px] tracking-tight" style={UI}>{b.headlinePart1}</span>
            <span className="block text-gray-800 font-light italic text-[36px]" style={SERIF}>{b.headlinePart2}</span>
          </div>
          <a href={b.ctaUrl} className="inline-flex items-center gap-1 mt-3 text-[11px] text-gray-700 hover:text-gray-900 font-bold tracking-widest transition-colors" style={UI}>{b.ctaText}</a>
        </div>
      </div>

    </section>
  );
};

// ─── Registry Entry ───────────────────────────────────────────────────────────

export const CampaignGridEntry: SectionRegistryEntry<CampaignGridConfig, CampaignGridData> = {
  sectionType:    'campaign_grid',
  component:      CampaignGridSection,
  parseConfig,
  defaultConfig:  DEFAULT,
  validateConfig,
  resolveData,
  defaultData:    { products: [], heroImg: '' },
  meta: {
    label:            'Campaign Grid',
    supportsPreview:  true,
    dataRequirements: ['products'],
  },
};
