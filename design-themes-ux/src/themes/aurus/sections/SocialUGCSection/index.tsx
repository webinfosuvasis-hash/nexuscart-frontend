/**
 * SocialUGCSection registry entry — aligned with SocialUGCEditor config schema.
 *
 * Config fields (set in the Homepage Builder admin):
 *   mosaicImages[0] → slot 1: tall left image (row-span-2)
 *   mosaicImages[1..6] → slots 2-7: right 3×2 grid
 *
 * Fallback chain per image slot:
 *   1. config.mosaicImages[slot].image  (merchant-uploaded in admin)
 *   2. API product image (store's own products)
 *   3. context.demoAssets (Unsplash demo images in dev)
 *
 * sectionType: 'social_ugc'
 */

import React from 'react';
import { mergeWithDefaults, safeParseJson, validResult } from '../shared/pipeline';
import { UI, SERIF } from '@/themes/aurus/constants';
import type {
  SectionRegistryEntry,
  SectionComponentProps,
  DataResolver,
  ValidationResult,
} from '@/themes/registry/types';
import type { StorefrontProductsResponse } from '@/lib/storefrontApi';

// ─── Types — must match SocialUGCEditor's config schema exactly ───────────────

export interface UGCImage {
  slot:    number;
  image:   string;
  alt:     string;
  linkUrl: string;
}

export interface SocialUGCConfig {
  backgroundColor: string;
  label:           string;
  headlineL1:      string;
  prizeText:       string;
  subText:         string;
  mosaicImages:    UGCImage[];   // 7 slots: [0]=hero, [1-6]=grid
  hashtagText:     string;
  handle:          string;
  textColor:       string;
}

export interface SocialUGCData {
  // Fallback images for empty mosaic slots — fetched from API or demo assets.
  // Index aligns with mosaicImages slot index (0 = hero slot, 1-6 = grid slots).
  fallbackImages: Array<{ id: string; image: string }>;
}

// ─── Defaults (match SocialUGCEditor's DEFAULT) ───────────────────────────────

const DEFAULT_MOSAIC: UGCImage[] = [1,2,3,4,5,6,7].map(slot => ({
  slot, image: '', alt: '', linkUrl: '',
}));

const DEFAULT: SocialUGCConfig = {
  backgroundColor: '#0F0A14',
  label:           'Aurus Xpression',
  headlineL1:      'Share your #MyAurusStory and',
  prizeText:       'win jewellery worth up to ₹15,000',
  subText:         'Tag us on Instagram and get featured on our page',
  mosaicImages:    DEFAULT_MOSAIC,
  hashtagText:     '#MyAurusStory',
  handle:          '@aurus',
  textColor:       '#A78BFA',
};

// ─── Config pipeline ──────────────────────────────────────────────────────────

function parseConfig(raw: unknown): SocialUGCConfig {
  const parsed = safeParseJson(raw) as Partial<SocialUGCConfig>;
  const merged = mergeWithDefaults(parsed, DEFAULT);
  // Preserve merchant-uploaded mosaic images array when it has the expected length
  if (
    parsed.mosaicImages &&
    Array.isArray(parsed.mosaicImages) &&
    parsed.mosaicImages.length === 7
  ) {
    merged.mosaicImages = parsed.mosaicImages;
  }
  return merged;
}

function validateConfig(config: SocialUGCConfig): ValidationResult<SocialUGCConfig> {
  return validResult(config);
}

// ─── Data Resolver ────────────────────────────────────────────────────────────
// Only fetches fallback images — used for mosaic slots that have no uploaded image.

const resolveData: DataResolver<SocialUGCConfig, SocialUGCData> = async (
  config,
  context,
) => {
  // Count how many mosaic slots are empty (need fallbacks)
  const emptyCount = config.mosaicImages.filter(m => !m.image).length;
  if (emptyCount === 0) return { fallbackImages: [] };

  const cacheKey = 'products:ugc:7';
  let fallbackImages: SocialUGCData['fallbackImages'];

  if (context.sharedCache.has(cacheKey)) {
    fallbackImages = context.sharedCache.get(cacheKey) as SocialUGCData['fallbackImages'];
  } else {
    try {
      const result = await context.fetchStorefront<StorefrontProductsResponse>(
        '/storefront/products?limit=7',
      );
      const apiProducts = (result.products ?? []).map(p => ({ id: p.id, image: p.image }));
      fallbackImages = apiProducts.some(p => p.image)
        ? apiProducts
        : context.demoAssets.getProductImages(7);
    } catch {
      fallbackImages = context.demoAssets.getProductImages(7);
    }
    context.sharedCache.set(cacheKey, fallbackImages);
  }

  return { fallbackImages };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve the final image URL for a mosaic slot: config image → API fallback → empty */
function slotImage(
  mosaic: UGCImage,
  idx: number,
  fallbacks: SocialUGCData['fallbackImages'],
): string {
  return mosaic.image || fallbacks[idx % Math.max(fallbacks.length, 1)]?.image || '';
}

/** Wrap a mosaic image in a link if linkUrl is configured, or a plain div otherwise */
function SlotWrapper({
  mosaic,
  className,
  children,
}: {
  mosaic: UGCImage;
  className: string;
  children: React.ReactNode;
}): React.ReactElement {
  if (mosaic.linkUrl) {
    return (
      <a href={mosaic.linkUrl} className={className} aria-label={mosaic.alt || undefined}>
        {children}
      </a>
    );
  }
  return <div className={className}>{children}</div>;
}

// ─── Component ────────────────────────────────────────────────────────────────

const SocialUGCSection: React.FC<SectionComponentProps<SocialUGCConfig, SocialUGCData>> = ({
  config,
  data,
}) => {
  const { fallbackImages } = data;
  const slots = config.mosaicImages;

  // slot[0] → hero (left col, row-span-2)
  // slot[1..6] → grid (right 3 cols × 2 rows)
  const heroSlot  = slots[0] ?? DEFAULT_MOSAIC[0];
  const gridSlots = slots.slice(1, 7);

  return (
    <section className="py-14" style={{ background: config.backgroundColor }}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="text-center mb-8">
          <p
            className="text-[10px] tracking-[0.45em] uppercase mb-3"
            style={{ ...UI, color: config.textColor }}
          >
            {config.label}
          </p>
          <h3 className="text-white text-2xl sm:text-3xl font-light" style={SERIF}>
            {config.headlineL1}
            <br />
            <span className="font-semibold" style={{ color: config.textColor }}>
              {config.prizeText}
            </span>
          </h3>
          <p className="text-gray-500 text-sm mt-3" style={UI}>{config.subText}</p>
        </div>

        {/* Photo grid: 4 cols × 2 rows */}
        <div className="grid grid-cols-4 grid-rows-2 gap-2" style={{ height: '380px' }}>

          {/* Slot 1 — hero, spans both rows */}
          <SlotWrapper mosaic={heroSlot} className="row-span-2 overflow-hidden rounded-lg cursor-pointer group">
            {slotImage(heroSlot, 0, fallbackImages) && (
              <img
                src={slotImage(heroSlot, 0, fallbackImages)}
                alt={heroSlot.alt || 'lifestyle'}
                className="w-full h-full object-cover object-center opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500"
              />
            )}
          </SlotWrapper>

          {/* Slots 2-7 — fill right 3×2 grid */}
          {gridSlots.map((slot, idx) => (
            <SlotWrapper
              key={slot.slot}
              mosaic={slot}
              className="overflow-hidden rounded-lg cursor-pointer group"
            >
              {slotImage(slot, idx + 1, fallbackImages) && (
                <img
                  src={slotImage(slot, idx + 1, fallbackImages)}
                  alt={slot.alt || ''}
                  loading="lazy"
                  className="w-full h-full object-cover opacity-55 group-hover:opacity-85 transition-opacity duration-300"
                />
              )}
            </SlotWrapper>
          ))}
        </div>

        {/* Footer */}
        <p
          className="text-center text-[12px] mt-6 tracking-wide"
          style={{ ...UI, color: config.textColor }}
        >
          Use <strong>{config.hashtagText}</strong> on Instagram to be featured
        </p>

      </div>
    </section>
  );
};

// ─── Registry Entry ───────────────────────────────────────────────────────────

export const SocialUGCEntry: SectionRegistryEntry<SocialUGCConfig, SocialUGCData> = {
  sectionType:   'social_ugc',
  component:     SocialUGCSection,
  parseConfig,
  defaultConfig: DEFAULT,
  validateConfig,
  resolveData,
  defaultData:   { fallbackImages: [] },
  meta: {
    label:            'Social UGC',
    supportsPreview:  true,
    dataRequirements: ['products'],
  },
};
