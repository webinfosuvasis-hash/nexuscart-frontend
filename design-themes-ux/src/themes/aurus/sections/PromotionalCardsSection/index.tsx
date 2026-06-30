/**
 * PromotionalCardsSection registry entry.
 *
 * 4-page carousel of 3 gradient promo cards per page.
 * sectionType: 'promotional_cards'
 */

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { mergeWithDefaults, safeParseJson, validResult } from '../shared/pipeline';
import { UI } from '@/themes/aurus/constants';
import type {
  SectionRegistryEntry,
  SectionComponentProps,
  DataResolver,
  ValidationResult,
} from '@/themes/registry/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PromoCard {
  gradientFrom: string;
  gradientTo: string;
  label: string;
  headline: string;
  ctaText: string;
  ctaUrl: string;
  ctaStyle: 'rounded' | 'square';
  icon?: string;
}

export interface PromotionalCardsConfig {
  pages: PromoCard[][];
}

// ─── Default config ───────────────────────────────────────────────────────────

const DEFAULT: PromotionalCardsConfig = {
  pages: [
    // Page 1
    [
      {
        gradientFrom: '#2D0A52',
        gradientTo: '#5B21B6',
        label: 'AURUS TREASURE CHEST',
        headline: 'Get your 10th instalment FREE',
        ctaText: 'Enrol Now',
        ctaUrl: '/treasure-chest',
        ctaStyle: 'square',
        icon: '💎',
      },
      {
        gradientFrom: '#00BFA5',
        gradientTo: '#00897B',
        label: 'ONE OF A KIND',
        headline: 'Silver Jewellery',
        ctaText: 'Shop Now',
        ctaUrl: '/jewellery/silver',
        ctaStyle: 'rounded',
      },
      {
        gradientFrom: '#9A6B00',
        gradientTo: '#D4A017',
        label: 'GOLD EXCHANGE PROGRAM',
        headline: 'Enjoy 0% Deduction on your exchange value',
        ctaText: 'Calculate Your Gold Value',
        ctaUrl: '/gold-exchange',
        ctaStyle: 'square',
        icon: '🪙',
      },
    ],
    // Page 2
    [
      {
        gradientFrom: '#BE185D',
        gradientTo: '#9D174D',
        label: 'GIFTING MADE EASY',
        headline: 'Birthday Gifts Starting ₹999',
        ctaText: 'Shop Gifts',
        ctaUrl: '/gifting',
        ctaStyle: 'rounded',
      },
      {
        gradientFrom: '#F9A8D4',
        gradientTo: '#EC4899',
        label: 'WEDDING SEASON',
        headline: 'Complete the Look',
        ctaText: 'Shop Bridal',
        ctaUrl: '/jewellery/bridal',
        ctaStyle: 'rounded',
      },
      {
        gradientFrom: '#065F46',
        gradientTo: '#059669',
        label: 'DAILY WEAR DROPS',
        headline: 'New Every Week',
        ctaText: 'Shop Now',
        ctaUrl: '/jewellery/daily-wear',
        ctaStyle: 'rounded',
      },
    ],
    // Page 3
    [
      {
        gradientFrom: '#1E1B4B',
        gradientTo: '#4338CA',
        label: 'DIAMOND SPECIAL',
        headline: 'Flat 100% Off Making Charges',
        ctaText: 'Shop Diamonds',
        ctaUrl: '/jewellery/diamonds',
        ctaStyle: 'rounded',
      },
      {
        gradientFrom: '#92400E',
        gradientTo: '#D97706',
        label: '9KT GOLD',
        headline: 'Starting ₹5,000',
        ctaText: 'Explore Now',
        ctaUrl: '/jewellery/gold',
        ctaStyle: 'rounded',
      },
      {
        gradientFrom: '#374151',
        gradientTo: '#6B7280',
        label: 'PLATINUM COLLECTION',
        headline: 'Rare. Pure. Precious.',
        ctaText: 'Discover',
        ctaUrl: '/jewellery/platinum',
        ctaStyle: 'rounded',
      },
    ],
    // Page 4
    [
      {
        gradientFrom: '#0F766E',
        gradientTo: '#6D28D9',
        label: 'REFERRAL OFFER',
        headline: 'Get ₹500 on Each Referral',
        ctaText: 'Refer Now',
        ctaUrl: '/referral',
        ctaStyle: 'rounded',
      },
      {
        gradientFrom: '#14532D',
        gradientTo: '#15803D',
        label: 'FESTIVAL SPECIAL',
        headline: 'Upto 50% Off Silver',
        ctaText: 'Shop Now',
        ctaUrl: '/jewellery/silver',
        ctaStyle: 'rounded',
      },
      {
        gradientFrom: '#1E3A5F',
        gradientTo: '#1D4ED8',
        label: 'CORPORATE GIFTING',
        headline: 'Bulk Orders Available',
        ctaText: 'Enquire Now',
        ctaUrl: '/corporate-gifting',
        ctaStyle: 'rounded',
      },
    ],
  ],
};

function parseConfig(raw: unknown): PromotionalCardsConfig {
  const parsed = safeParseJson(raw) as Partial<PromotionalCardsConfig>;
  return mergeWithDefaults(parsed, DEFAULT);
}

function validateConfig(
  config: PromotionalCardsConfig,
): ValidationResult<PromotionalCardsConfig> {
  return validResult(config);
}

// ─── Data Resolver ────────────────────────────────────────────────────────────

// No external data needed for this section.
const resolveData: DataResolver<PromotionalCardsConfig, Record<string, never>> = async () => {
  return {};
};

// ─── Component ────────────────────────────────────────────────────────────────

const PromotionalCardsSection: React.FC<
  SectionComponentProps<PromotionalCardsConfig, Record<string, never>>
> = ({ config }) => {
  const [page, setPage] = useState(0);
  const currentPage = config.pages[page] ?? [];

  return (
    <div className="mx-6 sm:mx-8 mt-4 bg-white rounded-2xl pt-4 pb-4">
      <div className="flex gap-3 px-4">
        {currentPage.map((card, idx) => (
          <div
            key={idx}
            className="flex-1 rounded-2xl p-6 flex flex-col justify-between overflow-hidden relative"
            style={{
              minHeight: '190px',
              background: `linear-gradient(135deg, ${card.gradientFrom} 0%, ${card.gradientTo} 100%)`,
            }}
          >
            {card.icon && (
              <div className="absolute top-4 right-4 text-[40px] leading-none select-none opacity-80">
                {card.icon}
              </div>
            )}
            <div>
              <p
                className="text-[9px] font-black uppercase tracking-[0.25em]"
                style={{ ...UI, color: 'rgba(255,255,255,0.7)' }}
              >
                {card.label}
              </p>
              <h3
                className="text-white text-[20px] font-bold mt-1.5 leading-snug max-w-[200px]"
                style={UI}
              >
                {card.headline}
              </h3>
            </div>
            <div>
              <button
                className={`text-[12px] font-bold px-5 py-2 mt-3 bg-white text-gray-900 hover:bg-gray-100 transition-colors ${
                  card.ctaStyle === 'rounded' ? 'rounded-full' : ''
                }`}
                style={UI}
                onClick={() => { window.location.href = card.ctaUrl; }}
              >
                {card.ctaText}
              </button>
              <p className="text-[9px] mt-2" style={{ ...UI, color: 'rgba(255,255,255,0.35)' }}>
                Terms &amp; Condition Apply
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation: pill counter + arrows */}
      <div className="relative flex items-center justify-center px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          {config.pages.map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`rounded-full transition-all duration-300 ${
                i === page
                  ? 'bg-gray-800 text-white text-[10px] font-bold px-2.5 py-[4px] leading-none'
                  : 'w-[7px] h-[7px] bg-gray-300 hover:bg-gray-500'
              }`}
              style={i === page ? UI : {}}
              aria-label={i === page ? undefined : `Go to page ${i + 1}`}
            >
              {i === page ? `${i + 1}/${config.pages.length}` : ''}
            </button>
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
            onClick={() => setPage(p => Math.min(config.pages.length - 1, p + 1))}
            disabled={page >= config.pages.length - 1}
            className="w-9 h-9 rounded-full bg-purple-800 hover:bg-purple-900 text-white flex items-center justify-center disabled:opacity-35 transition-colors"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Registry Entry ───────────────────────────────────────────────────────────

export const PromotionalCardsEntry: SectionRegistryEntry<
  PromotionalCardsConfig,
  Record<string, never>
> = {
  sectionType: 'promotional_cards',
  component: PromotionalCardsSection,
  parseConfig,
  defaultConfig: DEFAULT,
  validateConfig,
  resolveData,
  defaultData: {},
  meta: {
    label: 'Promotional Cards',
    supportsPreview: true,
    dataRequirements: [],
  },
};
