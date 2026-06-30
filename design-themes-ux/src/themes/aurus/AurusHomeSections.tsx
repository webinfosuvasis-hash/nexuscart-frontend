/**
 * AurusHomeSections — Aurus homepage sections 2-17 (hardcoded V1 implementations).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * PURPOSE
 * ═══════════════════════════════════════════════════════════════════════════════
 * Extracted from AurusHome.tsx to enable the single-render strategy:
 *   - AurusHome V1 = AurusHeader + V1 Hero + <AurusHomeSections />
 *   - AurusHomeV2   = AurusHeader + V2 Hero (registry) + <AurusHomeSections skipTypes={registered} />
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * MIGRATION LIFECYCLE
 * ═══════════════════════════════════════════════════════════════════════════════
 * Phase S1A: all 16 sections render from here (none registered yet)
 * Phase S1B: featured_products, campaign_grid, collections moved to registry
 *            → those 3 sections are passed in skipTypes; startFrom/stopBefore
 *              allow AurusHomeV2 to interleave them at their correct positions
 * Phase S1C: all remaining sections registered; this file is deleted entirely
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * VISUAL OUTPUT
 * ═══════════════════════════════════════════════════════════════════════════════
 * Pixel-identical to AurusHome.tsx sections 2–17. Zero visual change.
 * Only data sources and control flow were moved; JSX is unchanged.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, inr } from '@/context/StoreContext';
import { PRODUCTS, CATEGORIES, HERO_IMAGES, THEME_META } from '@/data/products';
import {
  MapPin, RotateCcw, Home, ChevronLeft, ChevronRight,
  Shield, Star, Video, Store, Phone,
} from 'lucide-react';
import CartDrawer from '@/components/CartDrawer';
import { UI, SERIF } from './constants';

// ─── Module-level constants (moved from AurusHome) ────────────────────────────

const BANNER_SLIDE_2 = 'https://images.unsplash.com/photo-1761125135357-99cbe52a6271?auto=format&fit=crop&w=800&h=1100&q=85';

const COLLECTIONS_DATA = [
  { name: 'दश्ता', sub: 'Dashta · Heritage Edit', idx: 0 },
  { name: 'Leher', sub: 'The dance of waves', idx: 1 },
  { name: 'Adaa', sub: 'BY AURUS', idx: 2 },
  { name: 'aneka', sub: 'MANY FORMS, ONE ESSENCE', idx: 3 },
  { name: 'Eternity', sub: 'Luxury, woven in brilliance', idx: 4 },
];

const CATEGORY_ICONS = [
  'Wedding Rings', 'Solitaire Pendants', 'Bestselling Styles',
  'New Styles For You', 'Daily Wear Drops', 'Gold Rings',
  'Diamond Earrings', 'Mangalsutra',
];

const TRUST = [
  [Shield, 'Authentic Fabrics', 'Certified handloom & pure weaves'],
  [RotateCcw, '15-Day Returns', 'Easy & hassle-free'],
  [Star, 'Free Shipping', 'On all orders above ₹999'],
  [Phone, '24/7 Support', 'Always here for you'],
];

// ─── Ordered list of section types in this component ─────────────────────────
// Used by startFrom / stopBefore range logic.

const SECTION_ORDER = [
  'featured_products',
  'campaign_grid',
  'category_discovery',
  'category_icons',
  'trust_badges',
  'collections',
  'bridal_section',
  'editorial_banners',
  'store_locator',
  'try_at_home',
  'gift_registry',
  'promotional_cards',
  'expert_help',
  'social_ugc',
  'newsletter',
] as const;

type AurusSectionSlot = typeof SECTION_ORDER[number];

function slotIndex(type: AurusSectionSlot): number {
  return SECTION_ORDER.indexOf(type);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AurusHomeSectionsProps {
  /**
   * Section types already rendered by the data-driven registry.
   * Sections in this set are skipped here to prevent double-render.
   * Used in the fallback/loading path (full-page render).
   */
  skipTypes?: ReadonlySet<string>;
  /**
   * Only render sections from this type onwards (inclusive).
   * Kept for backward compatibility — superseded by renderOnly in Phase S2.
   */
  startFrom?: AurusSectionSlot;
  /**
   * Stop rendering before this type (exclusive).
   * Kept for backward compatibility — superseded by renderOnly in Phase S2.
   */
  stopBefore?: AurusSectionSlot;
  /**
   * Phase S2+: When set, renders ONLY this one section type.
   * Used by AurusHomeV2 to iterate sections in dynamic API sortOrder:
   *   resolvedSections.map(s => <AurusHomeSections renderOnly={s.sectionType} />)
   * Footer and CartDrawer are NOT rendered when renderOnly is set.
   */
  renderOnly?: string;
  /**
   * Phase S2+: When true, renders ONLY the footer block + CartDrawer.
   * Used as the final element in AurusHomeV2 to ensure footer always appears last.
   * No section content is rendered when this prop is set.
   */
  renderFooterAndCart?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

const AurusHomeSections: React.FC<AurusHomeSectionsProps> = ({
  skipTypes,
  startFrom,
  stopBefore,
  renderOnly,
  renderFooterAndCart = false,
}) => {
  const products = PRODUCTS.aurus;
  const cats     = CATEGORIES.aurus;
  const meta     = THEME_META.aurus;
  const heroImg  = HERO_IMAGES.aurus;

  // ── Carousel state ──────────────────────────────────────────────────────────

  const [polkiIdx,  setPolkiIdx]  = useState(0);
  const polkiVisible = 4;
  const polkiMax   = Math.max(0, products.length - polkiVisible);

  const [bannerPg,  setBannerPg]  = useState(0);
  const BANNER_TOTAL = 2;

  const [c1Idx, setC1Idx] = useState(0);
  const cVisible = 4;
  const cMax     = Math.max(0, products.length - cVisible);

  const [promoPage, setPromoPage] = useState(0);
  const PROMO_TOTAL = 4;

  // ── Render gate ─────────────────────────────────────────────────────────────

  function show(type: AurusSectionSlot): boolean {
    // renderFooterAndCart mode: render no sections, only footer/cart
    if (renderFooterAndCart) return false;
    // renderOnly mode: render ONLY the specified section type
    if (renderOnly !== undefined) return type === renderOnly;
    // Full-page / range mode (original behavior)
    if (skipTypes?.has(type)) return false;
    const idx = slotIndex(type);
    if (startFrom !== undefined && idx < slotIndex(startFrom)) return false;
    if (stopBefore !== undefined && idx >= slotIndex(stopBefore)) return false;
    return true;
  }

  // Footer + CartDrawer render when:
  //   - renderFooterAndCart is explicitly requested, OR
  //   - full-page mode (neither renderOnly nor renderFooterAndCart is set)
  // They do NOT render in renderOnly mode (each section renders without footer).
  const showFooterAndCart = renderFooterAndCart || renderOnly === undefined;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 2 — FEATURED PRODUCTS (Polki Brand Section)
          Left: dark editorial image | Right: lavender product carousel
      ════════════════════════════════════════════════════════════════════ */}
      {show('featured_products') && (
        <section className="flex flex-col md:flex-row mx-6 sm:mx-8 mb-6 rounded-2xl overflow-hidden" style={{ minHeight: '380px' }}>
          <div className="md:w-[42%] w-full relative bg-[#0A0714] overflow-hidden min-h-[300px] md:min-h-0 flex-shrink-0">
            <img src={BANNER_SLIDE_2} alt="Festive Collection" className="absolute inset-0 w-full h-full object-cover object-center" draggable={false} />
            <div className="absolute inset-0 bg-black/15" />
          </div>
          <div className="flex-1 w-full bg-white px-5 sm:px-6 pt-5 pb-5 flex flex-col justify-between overflow-hidden">
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
                <button onClick={() => setPolkiIdx(i => Math.max(0, i - 1))} disabled={polkiIdx === 0} className="w-9 h-9 rounded-full bg-[#3D0F6E] hover:bg-[#2D0852] text-white flex items-center justify-center disabled:opacity-35 transition-colors" aria-label="Previous products">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPolkiIdx(i => Math.min(polkiMax, i + 1))} disabled={polkiIdx >= polkiMax} className="w-9 h-9 rounded-full bg-[#3D0F6E] hover:bg-[#2D0852] text-white flex items-center justify-center disabled:opacity-35 transition-colors" aria-label="Next products">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <button className="bg-[#3D0F6E] hover:bg-[#2D0852] text-white text-[13px] font-bold px-12 py-3 transition-colors tracking-wide rounded-full" style={UI} onClick={() => setPolkiIdx(0)}>
                Shop Now
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 3 — CAMPAIGN GRID (3-panel: Pink | Teal | Cream)
      ════════════════════════════════════════════════════════════════════ */}
      {show('campaign_grid') && (
        <section className="grid grid-cols-2 grid-rows-2 mx-6 sm:mx-8 mt-4 rounded-2xl overflow-hidden bg-white gap-3 p-3" style={{ height: '492px' }}>
          <div className="row-span-2 relative bg-[#F2899D] overflow-hidden rounded-xl flex flex-col justify-between p-5">
            <div className="flex items-start justify-between relative z-10 flex-shrink-0">
              <div>
                <p className="text-white text-[17px] font-black tracking-[0.05em]" style={UI}>SHAYA</p>
                <p className="text-white/90 text-[12px] font-medium tracking-wide" style={UI}>by AURUS</p>
              </div>
              <p className="text-gray-800 text-[12px] font-medium text-right leading-snug" style={UI}>Crafted in<br /><strong>925 Silver</strong></p>
            </div>
            <div className="absolute grid grid-cols-2 gap-2 pointer-events-none" style={{ top: 68, left: 12, right: 12, bottom: 140 }}>
              {[products[0], products[1], products[2], products[3]].map((p, i) => (
                <div key={i} className="w-full h-full rounded-xl overflow-hidden">
                  <img src={p.image} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <div className="relative z-10 flex-shrink-0 pt-3" style={{ background: 'linear-gradient(to top, #F2899D 70%, transparent)' }}>
              <h3 className="text-gray-900 text-[24px] font-semibold leading-tight" style={UI}>Big Sale Alert</h3>
              <p className="text-gray-900 text-[40px] font-black leading-none mt-0.5" style={UI}>Upto 50% Off</p>
              <p className="text-gray-800 text-[13px] mt-1" style={UI}>on Silver Jewellery</p>
            </div>
            <p className="absolute bottom-3 left-5 text-gray-700/60 text-[10px] z-10" style={UI}>TCA</p>
          </div>
          <div className="relative overflow-hidden rounded-xl flex" style={{ background: 'linear-gradient(135deg, #6DC5B0 0%, #3FA090 50%, #2D8B7A 100%)' }}>
            <div className="relative w-[45%] h-full overflow-hidden flex-shrink-0">
              <img src={heroImg} alt="SHAYA Diamonds model" className="absolute inset-0 w-full h-full object-cover object-top" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#3FA090]/60" />
            </div>
            <div className="flex-1 flex flex-col justify-between p-4 pl-3">
              <p className="text-white font-black text-[13px] tracking-wide" style={UI}>SHAYA DIAMONDS</p>
              <div>
                <h3 className="text-white text-[28px] font-black leading-none" style={UI}>FLAT 10% OFF<span className="text-[16px]">*</span></h3>
                <p className="text-white/85 text-[11px] mt-0.5" style={UI}>on MRP of all Designs</p>
                <div className="flex gap-1 mt-2">
                  <img src={products[0].image} alt="" className="w-12 h-12 object-contain rounded bg-white/20" />
                  <img src={products[2].image} alt="" className="w-12 h-12 object-contain rounded bg-white/20" />
                  <img src={products[4].image} alt="" className="w-12 h-12 object-contain rounded bg-white/20" />
                </div>
                <p className="text-white/80 text-[10px] mt-2 leading-snug font-medium" style={UI}>Natural Diamonds in<br /><span className="text-white font-bold">925 Silver from ₹5000</span></p>
              </div>
              <p className="text-white/40 text-[9px]" style={UI}>*TCA</p>
            </div>
          </div>
          <div className="relative bg-[#F0E6D4] overflow-hidden rounded-xl flex items-center justify-between px-7 py-5">
            <div className="absolute top-2 right-2 flex items-end gap-2">
              <img src={products[5].image} alt="" className="w-[64px] h-[64px] object-contain pointer-events-none" style={{ mixBlendMode: 'multiply' }} />
              <img src={products[3].image} alt="" className="w-[80px] h-[80px] object-contain pointer-events-none" style={{ mixBlendMode: 'multiply' }} />
            </div>
            <div>
              <p className="text-gray-600 text-[11px] mb-1 tracking-wide" style={UI}>More Earrings, More Fun!</p>
              <div className="leading-none">
                <span className="block text-gray-900 font-black text-[40px] tracking-tight" style={UI}>LATEST</span>
                <span className="block text-gray-800 font-light italic text-[36px]" style={SERIF}>Designs</span>
              </div>
              <a href="#shop" className="inline-flex items-center gap-1 mt-3 text-[11px] text-gray-700 hover:text-gray-900 font-bold tracking-widest transition-colors" style={UI}>SHOP NOW ▶</a>
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 4 — CATEGORY DISCOVERY
      ════════════════════════════════════════════════════════════════════ */}
      {show('category_discovery') && (
        <section className="mx-10 sm:mx-16 mt-4 rounded-2xl bg-[#F5EEFF] border border-[#DDD0F5] px-6 py-12">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 text-center" style={{ width: '130px' }}>
              <div className="mx-auto w-[72px] h-[72px] rounded-2xl flex items-center justify-center text-[44px] leading-none select-none" style={{ background: 'linear-gradient(135deg, #C084FC 0%, #9333EA 50%, #7C3AED 100%)', boxShadow: '0 4px 14px rgba(124,58,237,0.35)' }}>🎁</div>
              <p className="text-gray-700 text-[12px] font-semibold mt-2.5 leading-snug" style={UI}>Gift Her Style</p>
            </div>
            <div className="flex-1 min-w-0 overflow-x-auto">
              <div className="flex gap-4 pb-0.5">
                {[
                  { label: 'WEDDING BANDS', imgIdx: 1 }, { label: 'EVERYDAY PENDANTS', imgIdx: 4 },
                  { label: 'BESTSELLING STYLES', imgIdx: 0 }, { label: 'NEW STYLES FOR KIDS', imgIdx: 5 },
                  { label: 'DAILYWEAR HOOPS', imgIdx: 2 }, { label: 'NOSE PINS', imgIdx: 6 },
                  { label: 'GOLD RINGS', imgIdx: 7 }, { label: 'MANGALSUTRA', imgIdx: 3 },
                ].map(item => (
                  <a key={item.label} href="#shop" className="flex-shrink-0 group text-center" style={{ width: '158px' }}>
                    <div className="aspect-square rounded-2xl overflow-hidden bg-white shadow-sm group-hover:shadow-md transition-all duration-200 border border-[#EEE8F8]">
                      <img src={products[item.imgIdx % products.length].image} alt={item.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-400" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-700 mt-2.5 leading-snug group-hover:text-gray-900 transition-colors" style={UI}>{item.label}</p>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 5 — CATEGORY ICONS
      ════════════════════════════════════════════════════════════════════ */}
      {show('category_icons') && (
        <section className="border-b border-gray-100 bg-white py-7">
          <div className="max-w-[1280px] mx-auto px-4">
            <div className="overflow-x-auto">
              <div className="flex gap-7 sm:gap-10 w-max mx-auto py-1">
                {CATEGORY_ICONS.map((cat, i) => (
                  <a key={cat} href="#shop" className="flex flex-col items-center gap-2.5 group w-[70px] text-center flex-shrink-0">
                    <div className="w-[58px] h-[58px] sm:w-[64px] sm:h-[64px] rounded-full overflow-hidden border-2 border-gray-200 group-hover:border-purple-500 transition-colors duration-300 bg-purple-50">
                      <img src={cats[i % cats.length].img} alt={cat} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-400" />
                    </div>
                    <p className="text-[11px] text-gray-700 group-hover:text-purple-700 leading-tight transition-colors font-medium">{cat}</p>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 6 — TRUST BADGE BAR
      ════════════════════════════════════════════════════════════════════ */}
      {show('trust_badges') && (
        <section className="bg-purple-50 border-b border-purple-100 mt-4 mb-10">
          <div className="max-w-[1280px] mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-purple-100">
              {TRUST.map(([Icon, title, sub]: any, i) => (
                <div key={i} className="flex items-center gap-3 px-4 sm:px-7 py-4">
                  <Icon className="w-5 h-5 text-purple-600 flex-shrink-0" strokeWidth={1.5} />
                  <div>
                    <p className="text-[12.5px] font-semibold text-gray-800">{title}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 7 — COLLECTIONS
      ════════════════════════════════════════════════════════════════════ */}
      {show('collections') && (
        <section id="collections" style={{ background: '#EDE9FE' }} className="py-10 sm:py-12">
          <h2 className="text-center text-[26px] font-bold text-gray-900 mb-6 tracking-tight" style={UI}>Aurus Collections</h2>
          <div className="px-2 sm:px-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1">
              {COLLECTIONS_DATA.map(col => (
                <a key={col.name} href="#shop" className="group relative overflow-hidden rounded-lg block" style={{ aspectRatio: '3 / 5' }}>
                  <img src={products[col.idx]?.image ?? cats[col.idx % cats.length].img} alt={col.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.35) 40%, transparent 70%)' }} />
                  <div className="absolute bottom-0 left-0 right-0 px-4 pb-7">
                    <p className="text-white leading-none" style={{ ...SERIF, fontSize: 34, fontWeight: 400, fontStyle: 'italic', textShadow: '0 2px 14px rgba(0,0,0,0.55)', letterSpacing: '-0.01em' }}>{col.name}</p>
                    <p className="text-white/65 mt-1.5 leading-none" style={{ ...UI, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}>{col.sub}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
          <div className="text-center mt-7">
            <a href="#shop" className="inline-block bg-purple-700 hover:bg-purple-800 text-white px-10 py-3 text-[13px] font-bold tracking-[0.1em] uppercase transition-colors rounded-sm" style={UI}>VIEW ALL COLLECTIONS</a>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 8 — BRIDAL SECTION
      ════════════════════════════════════════════════════════════════════ */}
      {show('bridal_section') && (
        <section className="mx-6 sm:mx-8 mt-4 rounded-2xl overflow-hidden flex flex-col md:flex-row" style={{ minHeight: '370px' }}>
          <div className="md:w-1/2 relative overflow-hidden min-h-[260px] md:min-h-0" style={{ background: '#F9E4D4' }}>
            <img src={heroImg} alt="For the bride squad" className="absolute inset-0 w-full h-full object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#F9C4A0]/60 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            <div className="absolute bottom-10 left-8 z-10">
              <p className="text-white text-[24px] font-light leading-snug drop-shadow-md" style={SERIF}>For the bride squad</p>
              <p className="text-white text-[24px] font-light leading-snug drop-shadow-md" style={SERIF}>&amp; all the <em>wedding glam</em></p>
            </div>
            <a href="#shop" className="absolute bottom-4 left-8 z-10 text-white text-[11px] font-bold tracking-[0.12em] uppercase flex items-center gap-1 drop-shadow-md" style={UI}>SHOP NOW ▶</a>
          </div>
          <div className="md:w-1/2 bg-[#EDE0FF] flex flex-col justify-between p-5">
            <div className="flex gap-3 overflow-hidden">
              {products.slice(c1Idx, c1Idx + 4).map((p, i) => (
                <Link key={p.id} to={`/products/${p.id}`} className="flex-shrink-0 group flex-1 min-w-0">
                  <div className={`aspect-square rounded-xl overflow-hidden bg-white transition-all duration-200 ${i === 0 ? 'border-2 border-purple-600 shadow-md' : 'border border-purple-100 shadow-sm group-hover:border-purple-400'}`}>
                    <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-400" />
                  </div>
                  <div className="mt-2.5 px-0.5">
                    <p className="text-[14px] font-bold text-gray-900" style={UI}>{inr(p.price)}</p>
                    <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-2 leading-snug" style={UI}>{p.name}</p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-2">
                <button onClick={() => setC1Idx(i => Math.max(0, i - 1))} disabled={c1Idx === 0} className="w-9 h-9 rounded-full bg-purple-800 hover:bg-purple-900 text-white flex items-center justify-center disabled:opacity-35 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setC1Idx(i => Math.min(cMax, i + 1))} disabled={c1Idx >= cMax} className="w-9 h-9 rounded-full bg-purple-800 hover:bg-purple-900 text-white flex items-center justify-center disabled:opacity-35 transition-colors"><ChevronRight className="w-4 h-4" /></button>
              </div>
              <a href="#shop" className="bg-purple-800 hover:bg-purple-900 text-white text-[13px] font-bold px-10 py-3 transition-colors rounded-full" style={UI}>Shop Now</a>
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 9 — EDITORIAL BANNER CAROUSEL (3-panel)
      ════════════════════════════════════════════════════════════════════ */}
      {show('editorial_banners') && (
        <section className="mx-6 sm:mx-8 mt-4 rounded-2xl overflow-hidden bg-white">
          <div className="flex gap-3 p-3" style={{ minHeight: '300px' }}>
            {bannerPg === 0 ? <>
              <div className="flex-1 relative rounded-xl overflow-hidden bg-[#EEE6FF] flex flex-col justify-between p-6">
                <div className="absolute top-4 right-3 w-[55%] h-[75%] pointer-events-none">
                  <img src={products[1].image} alt="" className="absolute top-0 right-0 w-[80%] object-contain" style={{ mixBlendMode: 'multiply' }} />
                  <img src={products[3].image} alt="" className="absolute bottom-0 right-4 w-[60%] object-contain" style={{ mixBlendMode: 'multiply' }} />
                </div>
                <div className="relative z-10 mt-auto pt-24">
                  <h3 className="text-gray-900 text-[26px] font-semibold leading-none" style={UI}>9KT Gold</h3>
                  <p className="text-gray-700 text-[13px] mt-1.5 leading-snug" style={UI}>Because <em>everyday</em> moments deserve gold</p>
                  <button className="mt-4 bg-gray-900 hover:bg-gray-700 text-white text-[11px] font-bold px-5 py-2.5 tracking-wide transition-colors" style={UI}>STARTING AT ₹5000</button>
                  <p className="text-gray-400 text-[9px] mt-2" style={UI}>TCA</p>
                </div>
              </div>
              <div className="flex-1 relative rounded-xl overflow-hidden flex flex-col justify-between p-6" style={{ background: 'linear-gradient(145deg, #D4836A 0%, #C96A4F 60%, #B85A3F 100%)' }}>
                <div className="absolute top-3 right-2 w-[60%] h-[70%] pointer-events-none">
                  <img src={products[0].image} alt="" className="absolute top-0 right-0 w-[70%] object-contain opacity-90" />
                  <img src={products[2].image} alt="" className="absolute bottom-0 right-6 w-[55%] object-contain opacity-80" />
                </div>
                <div className="relative z-10 mt-auto pt-20">
                  <h3 className="text-white text-[24px] font-semibold leading-tight" style={SERIF}>Golden Hour Styles</h3>
                  <p className="text-white/85 text-[13px] mt-1.5" style={UI}>The <em>summer</em> your style got prettier!</p>
                  <button className="mt-4 bg-gray-900 hover:bg-gray-700 text-white text-[11px] font-bold px-6 py-2.5 tracking-wide transition-colors rounded-full" style={UI}>SHOP NOW</button>
                </div>
              </div>
              <div className="flex-1 relative rounded-xl overflow-hidden bg-[#F5EAE0] flex flex-col justify-between p-6">
                <div className="absolute top-3 right-0 w-[65%] h-[65%] pointer-events-none">
                  <img src={products[5].image} alt="" className="absolute top-0 right-2 w-[75%] object-contain" style={{ mixBlendMode: 'multiply' }} />
                  <img src={products[7].image} alt="" className="absolute bottom-0 right-0 w-[55%] object-contain" style={{ mixBlendMode: 'multiply' }} />
                </div>
                <div className="relative z-10 mt-auto pt-24">
                  <h3 className="text-gray-900 text-[24px] font-semibold leading-tight" style={SERIF}>Pretty in <span className="text-purple-600">purple,</span></h3>
                  <p className="text-gray-800 text-[22px] font-semibold" style={SERIF}>powerful in shine</p>
                  <a href="#shop" className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-gray-800 hover:text-gray-600 tracking-widest transition-colors" style={UI}>SHOP NOW ▶</a>
                </div>
              </div>
            </> : <>
              <div className="flex-1 relative rounded-xl overflow-hidden bg-[#E0F4EC] flex flex-col justify-between p-6">
                <div className="absolute top-3 right-3 w-[55%] h-[70%] pointer-events-none"><img src={products[4].image} alt="" className="absolute top-0 right-0 w-[80%] object-contain" style={{ mixBlendMode: 'multiply' }} /></div>
                <div className="relative z-10 mt-auto pt-24"><h3 className="text-gray-900 text-[26px] font-semibold" style={UI}>Diamond Studded</h3><p className="text-gray-700 text-[13px] mt-1.5" style={UI}>Elegance in every facet</p><button className="mt-4 bg-gray-900 text-white text-[11px] font-bold px-5 py-2.5 tracking-wide rounded-full" style={UI}>SHOP DIAMONDS</button></div>
              </div>
              <div className="flex-1 relative rounded-xl overflow-hidden flex flex-col justify-between p-6" style={{ background: 'linear-gradient(145deg, #4A1D96 0%, #6D28D9 100%)' }}>
                <div className="absolute top-3 right-3 w-[55%] h-[70%] pointer-events-none"><img src={products[6].image} alt="" className="absolute top-0 right-0 w-[80%] object-contain opacity-80" /></div>
                <div className="relative z-10 mt-auto pt-24"><h3 className="text-white text-[26px] font-semibold" style={SERIF}>Midnight Collection</h3><p className="text-white/80 text-[13px] mt-1.5" style={UI}>Bold, dark, and brilliant</p><button className="mt-4 bg-white text-purple-900 text-[11px] font-bold px-6 py-2.5 tracking-wide" style={UI}>EXPLORE</button></div>
              </div>
              <div className="flex-1 relative rounded-xl overflow-hidden bg-[#FFF0F5] flex flex-col justify-between p-6">
                <div className="absolute top-3 right-3 w-[55%] h-[70%] pointer-events-none"><img src={products[2].image} alt="" className="absolute top-0 right-0 w-[80%] object-contain" style={{ mixBlendMode: 'multiply' }} /></div>
                <div className="relative z-10 mt-auto pt-24"><h3 className="text-gray-900 text-[26px] font-semibold" style={SERIF}>Rose Gold Edit</h3><p className="text-gray-700 text-[13px] mt-1.5" style={UI}>Soft tones, strong style</p><a href="#shop" className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 tracking-widest" style={UI}>SHOP NOW ▶</a></div>
              </div>
            </>}
          </div>
          <div className="relative flex items-center justify-center px-4 pb-4">
            <div className="flex items-center gap-2">
              {Array.from({ length: BANNER_TOTAL }).map((_, i) => (
                <button key={i} onClick={() => setBannerPg(i)} className={`transition-all duration-300 rounded-full ${i === bannerPg ? 'w-7 h-[7px] bg-gray-800' : 'w-[7px] h-[7px] bg-gray-400 hover:bg-gray-600'}`} />
              ))}
            </div>
            <div className="absolute right-4 bottom-0 flex gap-2">
              <button onClick={() => setBannerPg(p => Math.max(0, p - 1))} disabled={bannerPg === 0} className="w-9 h-9 rounded-full bg-purple-800 hover:bg-purple-900 text-white flex items-center justify-center disabled:opacity-35 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setBannerPg(p => Math.min(BANNER_TOTAL - 1, p + 1))} disabled={bannerPg >= BANNER_TOTAL - 1} className="w-9 h-9 rounded-full bg-purple-800 hover:bg-purple-900 text-white flex items-center justify-center disabled:opacity-35 transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 10 — STORE LOCATOR (split panel)
      ════════════════════════════════════════════════════════════════════ */}
      {show('store_locator') && (
        <section className="mx-6 sm:mx-8 mt-4 rounded-2xl overflow-hidden flex flex-col md:flex-row" style={{ minHeight: '340px' }}>
          <div className="md:w-1/2 relative overflow-hidden min-h-[240px] md:min-h-0 bg-gray-900">
            <img src={heroImg} alt="Find a store near you" className="absolute inset-0 w-full h-full object-cover object-center" />
            <div className="absolute inset-0 bg-black/15" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-14 h-14 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center border border-white/50">
                <div className="w-0 h-0 ml-1" style={{ borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: '16px solid white' }} />
              </div>
            </div>
          </div>
          <div className="md:w-1/2 flex flex-col items-center justify-center px-10 py-12 bg-[#FDEAE0]">
            <h2 className="text-[28px] sm:text-[30px] font-bold text-center leading-snug" style={{ ...UI, color: '#2D1B6E' }}>Find your favorite designs<br />at a Store Nearby</h2>
            <div className="mt-8 w-full max-w-[420px]">
              <div className="flex items-center bg-white rounded-full border border-gray-200 px-4 py-3.5 shadow-sm">
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mr-2.5" />
                <input type="text" placeholder="Enter Pincode or City" className="flex-1 text-[14px] outline-none text-gray-600 placeholder-gray-400 bg-transparent" style={UI} />
                <button className="text-[13px] font-bold ml-3 flex-shrink-0 hover:opacity-70 transition-opacity" style={{ ...UI, color: '#E8630A' }}>CHANGE</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 11 — TRY AT HOME + VIDEO CALL (dual service cards)
      ════════════════════════════════════════════════════════════════════ */}
      {show('try_at_home') && (
        <div className="mx-6 sm:mx-8 mt-4 grid grid-cols-2 gap-4">
          <div className="relative rounded-2xl overflow-hidden group cursor-pointer" style={{ minHeight: '380px' }}>
            <img src={heroImg} alt="Try at Home" className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
            <div className="absolute bottom-8 left-7 right-7 z-10">
              <h3 className="text-white text-[26px] font-bold leading-snug" style={UI}>Unsure About<br />What Design to Pick?</h3>
              <button className="mt-5 bg-[#3A3A3A]/80 hover:bg-[#1A1A1A] backdrop-blur-sm text-white text-[11px] font-bold px-6 py-3 tracking-[0.14em] uppercase transition-all duration-200 rounded-sm" style={UI}>BOOK A TRIAL AT HOME</button>
            </div>
          </div>
          <div className="relative rounded-2xl overflow-hidden group cursor-pointer" style={{ minHeight: '380px' }}>
            <img src={heroImg} alt="View Designs on Live Video Call" className="absolute inset-0 w-full h-full object-cover object-right group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-purple-950/85 via-purple-900/40 to-purple-800/15" />
            <div className="absolute bottom-8 left-7 right-7 z-10">
              <h3 className="text-white text-[26px] font-bold leading-snug" style={UI}>View Designs on<br />Live Video Call</h3>
              <button className="mt-5 bg-[#3A3A3A]/80 hover:bg-[#1A1A1A] backdrop-blur-sm text-white text-[11px] font-bold px-6 py-3 tracking-[0.14em] uppercase transition-all duration-200 rounded-sm" style={UI}>SCHEDULE A VIDEO CALL</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 12 — GIFT REGISTRY
      ════════════════════════════════════════════════════════════════════ */}
      {show('gift_registry') && (
        <section className="max-w-[1280px] mx-auto px-4 sm:px-5 py-10">
          <div className="rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-[1fr_220px_1fr]" style={{ background: 'linear-gradient(135deg, #F5F0FF 0%, #EDE9FE 55%, #FAF0FF 100%)' }}>
            <div className="px-8 py-12 md:py-14 flex flex-col justify-center">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-purple-400" style={UI}>Celebrate Together</p>
              <h2 className="text-[32px] font-light text-gray-900 mt-1.5 leading-tight" style={SERIF}>Create Your<br/>Gift Registry</h2>
              <p className="text-[13px] text-gray-500 mt-3 leading-loose max-w-[290px]" style={UI}>Curate your perfect wishlist for every special moment. Your loved ones will always know exactly what makes you happy.</p>
              <div className="flex flex-wrap gap-1.5 mt-7">
                {['🤝 Wedding','🪔 Puja','✨ Party','💼 Office','🎁 Gift'].map(o => (
                  <span key={o} className="text-[10.5px] font-semibold bg-white/70 hover:bg-white text-purple-700 border border-purple-200 hover:border-purple-400 px-2.5 py-0.5 rounded-full cursor-default select-none transition-all duration-200 hover:scale-105 hover:shadow-sm inline-block" style={UI}>{o}</span>
                ))}
              </div>
              <Link to="/registry" className="inline-block mt-6 bg-purple-700 hover:bg-purple-800 text-white px-7 py-2.5 rounded-full text-[13px] font-bold tracking-wide transition-colors self-start" style={UI}>Start Your Registry →</Link>
              <div className="mt-3" style={UI}>
                <p className="text-[10px] text-purple-400 font-normal">★★★★★ Trusted by 8,500+ families</p>
                <p className="text-[9.5px] text-gray-300 mt-0.5">Perfect for Weddings, Anniversaries &amp; Festivals</p>
              </div>
            </div>
            <div className="hidden md:flex items-center justify-center relative border-x border-purple-200/10 py-10">
              <div className="absolute w-[180px] h-[180px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.15) 0%, transparent 70%)', transform: 'translateY(-16px)' }} />
              <span className="text-[64px] relative z-10 drop-shadow-sm select-none" style={{ transform: 'translateY(-16px)' }}>🎁</span>
              <span className="absolute top-[22%] left-[20%] text-[20px] opacity-75 drop-shadow-sm select-none">💍</span>
              <span className="absolute top-[20%] right-[20%] text-[18px] opacity-70 select-none">🎀</span>
              <span className="absolute bottom-[24%] left-[18%] text-[18px] opacity-65 select-none">❤️</span>
              <span className="absolute bottom-[22%] right-[18%] text-[16px] opacity-60 select-none">💎</span>
              <span className="absolute top-[47%] left-[10%] text-[11px] opacity-45 select-none">✨</span>
              <span className="absolute top-[47%] right-[10%] text-[11px] opacity-45 select-none">✨</span>
            </div>
            <div className="px-8 py-12 md:py-14 flex flex-col justify-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-purple-400 mb-6" style={UI}>How it works</p>
              <div className="space-y-0">
                {([
                  { icon: '📝', label: 'Create Registry', sub: 'Pick your occasion & add your wishlist' },
                  { icon: '🔗', label: 'Share with Family', sub: 'Send a link or share via WhatsApp' },
                  { icon: '🛍', label: 'Friends Gift You', sub: 'They buy directly from your list' },
                  { icon: '✅', label: 'Track Gifts', sub: "See what's been gifted in real time" },
                ]).map((step, i, arr) => (
                  <div key={step.label}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-purple-100 flex items-center justify-center text-[18px] flex-shrink-0">{step.icon}</div>
                      <div className="pt-0.5">
                        <p className="text-[12.5px] font-bold text-gray-800 leading-none" style={UI}>{step.label}</p>
                        <p className="text-[10.5px] text-gray-400 mt-0.5 leading-snug" style={UI}>{step.sub}</p>
                      </div>
                    </div>
                    {i < arr.length - 1 && <div className="ml-[19px] w-px h-6 bg-purple-200 my-1.5" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 13 — PROMOTIONAL CARDS CAROUSEL (4 pages of 3)
      ════════════════════════════════════════════════════════════════════ */}
      {show('promotional_cards') && (
        <div className="mx-6 sm:mx-8 mt-4 bg-white rounded-2xl pt-4 pb-4">
          <div className="flex gap-3 px-4">
            {promoPage === 0 && <>
              <div className="flex-1 rounded-2xl p-6 flex flex-col justify-between overflow-hidden relative" style={{ minHeight: '190px', background: 'linear-gradient(135deg, #2D0A52 0%, #5B21B6 100%)' }}>
                <div className="absolute top-4 right-4 text-[40px] leading-none select-none opacity-80">💎</div>
                <div><p className="text-yellow-300 text-[9px] font-black uppercase tracking-[0.25em]" style={UI}>AURUS TREASURE CHEST</p><h3 className="text-white text-[20px] font-bold mt-1.5 leading-snug max-w-[200px]" style={UI}>Get your 10th instalment FREE</h3></div>
                <div><button className="bg-white text-gray-900 hover:bg-gray-100 text-[12px] font-bold px-5 py-2 rounded-sm transition-colors mt-3" style={UI}>Enrol Now</button><p className="text-white/35 text-[9px] mt-2" style={UI}>Terms &amp; Condition Apply</p></div>
              </div>
              <div className="flex-1 rounded-2xl p-6 flex flex-col justify-between overflow-hidden relative" style={{ minHeight: '190px', background: 'linear-gradient(135deg, #00BFA5 0%, #00897B 100%)' }}>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-white/20 text-[64px] font-black tracking-tighter leading-none select-none" style={UI}>SHAYA</div>
                <div><p className="text-white/70 text-[9px] font-black uppercase tracking-[0.25em]" style={UI}>ONE OF A KIND</p><h3 className="text-white text-[26px] font-bold mt-1.5" style={UI}>Silver Jewellery</h3></div>
                <div><button className="bg-white text-gray-900 hover:bg-gray-100 text-[12px] font-bold px-5 py-2 rounded-full transition-colors mt-3" style={UI}>Shop Now</button><p className="text-white/35 text-[9px] mt-2" style={UI}>Terms &amp; Condition Apply</p></div>
              </div>
              <div className="flex-1 rounded-2xl p-6 flex flex-col justify-between overflow-hidden relative" style={{ minHeight: '190px', background: 'linear-gradient(135deg, #9A6B00 0%, #D4A017 100%)' }}>
                <div className="absolute top-3 right-3 text-[44px] leading-none select-none opacity-75">🪙</div>
                <div><p className="text-yellow-200 text-[9px] font-black uppercase tracking-[0.25em]" style={UI}>GOLD EXCHANGE PROGRAM</p><h3 className="text-white text-[18px] font-bold mt-1.5 leading-snug max-w-[220px]" style={UI}>Enjoy 0% Deduction on your exchange value</h3></div>
                <div><button className="bg-white text-gray-900 hover:bg-gray-100 text-[12px] font-bold px-5 py-2 rounded-sm transition-colors mt-3 whitespace-nowrap" style={UI}>Calculate Your Gold Value</button><p className="text-white/35 text-[9px] mt-2" style={UI}>Terms &amp; Condition Apply</p></div>
              </div>
            </>}
            {promoPage === 1 && <>
              <div className="flex-1 rounded-2xl p-6 flex flex-col justify-between" style={{ minHeight:'190px', background:'linear-gradient(135deg,#BE185D 0%,#9D174D 100%)' }}><div><p className="text-pink-200 text-[9px] font-black uppercase tracking-[0.25em]" style={UI}>GIFTING MADE EASY</p><h3 className="text-white text-[22px] font-bold mt-1.5" style={UI}>Birthday Gifts Starting ₹999</h3></div><div><button className="bg-white text-gray-900 text-[12px] font-bold px-5 py-2 rounded-full mt-3" style={UI}>Shop Gifts</button><p className="text-white/35 text-[9px] mt-2" style={UI}>Terms &amp; Condition Apply</p></div></div>
              <div className="flex-1 rounded-2xl p-6 flex flex-col justify-between" style={{ minHeight:'190px', background:'linear-gradient(135deg,#F9A8D4 0%,#EC4899 100%)' }}><div><p className="text-white/70 text-[9px] font-black uppercase tracking-[0.25em]" style={UI}>WEDDING SEASON</p><h3 className="text-white text-[22px] font-bold mt-1.5" style={UI}>Complete the Look</h3></div><div><button className="bg-white text-gray-900 text-[12px] font-bold px-5 py-2 rounded-full mt-3" style={UI}>Shop Bridal</button><p className="text-white/35 text-[9px] mt-2" style={UI}>Terms &amp; Condition Apply</p></div></div>
              <div className="flex-1 rounded-2xl p-6 flex flex-col justify-between" style={{ minHeight:'190px', background:'linear-gradient(135deg,#065F46 0%,#059669 100%)' }}><div><p className="text-emerald-200 text-[9px] font-black uppercase tracking-[0.25em]" style={UI}>DAILY WEAR DROPS</p><h3 className="text-white text-[22px] font-bold mt-1.5" style={UI}>New Every Week</h3></div><div><button className="bg-white text-gray-900 text-[12px] font-bold px-5 py-2 rounded-full mt-3" style={UI}>Shop Now</button><p className="text-white/35 text-[9px] mt-2" style={UI}>Terms &amp; Condition Apply</p></div></div>
            </>}
            {promoPage === 2 && <>
              <div className="flex-1 rounded-2xl p-6 flex flex-col justify-between" style={{ minHeight:'190px', background:'linear-gradient(135deg,#1E1B4B 0%,#4338CA 100%)' }}><div><p className="text-indigo-300 text-[9px] font-black uppercase tracking-[0.25em]" style={UI}>DIAMOND SPECIAL</p><h3 className="text-white text-[22px] font-bold mt-1.5" style={UI}>Flat 100% Off Making Charges</h3></div><div><button className="bg-white text-gray-900 text-[12px] font-bold px-5 py-2 rounded-full mt-3" style={UI}>Shop Diamonds</button><p className="text-white/35 text-[9px] mt-2" style={UI}>Terms &amp; Condition Apply</p></div></div>
              <div className="flex-1 rounded-2xl p-6 flex flex-col justify-between" style={{ minHeight:'190px', background:'linear-gradient(135deg,#92400E 0%,#D97706 100%)' }}><div><p className="text-yellow-200 text-[9px] font-black uppercase tracking-[0.25em]" style={UI}>9KT GOLD</p><h3 className="text-white text-[22px] font-bold mt-1.5" style={UI}>Starting ₹5,000</h3></div><div><button className="bg-white text-gray-900 text-[12px] font-bold px-5 py-2 rounded-full mt-3" style={UI}>Explore Now</button><p className="text-white/35 text-[9px] mt-2" style={UI}>Terms &amp; Condition Apply</p></div></div>
              <div className="flex-1 rounded-2xl p-6 flex flex-col justify-between" style={{ minHeight:'190px', background:'linear-gradient(135deg,#374151 0%,#6B7280 100%)' }}><div><p className="text-gray-300 text-[9px] font-black uppercase tracking-[0.25em]" style={UI}>PLATINUM COLLECTION</p><h3 className="text-white text-[22px] font-bold mt-1.5" style={UI}>Rare. Pure. Precious.</h3></div><div><button className="bg-white text-gray-900 text-[12px] font-bold px-5 py-2 rounded-full mt-3" style={UI}>Discover</button><p className="text-white/35 text-[9px] mt-2" style={UI}>Terms &amp; Condition Apply</p></div></div>
            </>}
            {promoPage === 3 && <>
              <div className="flex-1 rounded-2xl p-6 flex flex-col justify-between" style={{ minHeight:'190px', background:'linear-gradient(135deg,#0F766E 0%,#6D28D9 100%)' }}><div><p className="text-teal-200 text-[9px] font-black uppercase tracking-[0.25em]" style={UI}>REFERRAL OFFER</p><h3 className="text-white text-[22px] font-bold mt-1.5" style={UI}>Get ₹500 on Each Referral</h3></div><div><button className="bg-white text-gray-900 text-[12px] font-bold px-5 py-2 rounded-full mt-3" style={UI}>Refer Now</button><p className="text-white/35 text-[9px] mt-2" style={UI}>Terms &amp; Condition Apply</p></div></div>
              <div className="flex-1 rounded-2xl p-6 flex flex-col justify-between" style={{ minHeight:'190px', background:'linear-gradient(135deg,#14532D 0%,#15803D 100%)' }}><div><p className="text-green-200 text-[9px] font-black uppercase tracking-[0.25em]" style={UI}>FESTIVAL SPECIAL</p><h3 className="text-white text-[22px] font-bold mt-1.5" style={UI}>Upto 50% Off Silver</h3></div><div><button className="bg-white text-gray-900 text-[12px] font-bold px-5 py-2 rounded-full mt-3" style={UI}>Shop Now</button><p className="text-white/35 text-[9px] mt-2" style={UI}>Terms &amp; Condition Apply</p></div></div>
              <div className="flex-1 rounded-2xl p-6 flex flex-col justify-between" style={{ minHeight:'190px', background:'linear-gradient(135deg,#1E3A5F 0%,#1D4ED8 100%)' }}><div><p className="text-blue-200 text-[9px] font-black uppercase tracking-[0.25em]" style={UI}>CORPORATE GIFTING</p><h3 className="text-white text-[22px] font-bold mt-1.5" style={UI}>Bulk Orders Available</h3></div><div><button className="bg-white text-gray-900 text-[12px] font-bold px-5 py-2 rounded-full mt-3" style={UI}>Enquire Now</button><p className="text-white/35 text-[9px] mt-2" style={UI}>Terms &amp; Condition Apply</p></div></div>
            </>}
          </div>
          <div className="relative flex items-center justify-center px-4 pt-3 pb-1">
            <div className="flex items-center gap-2">
              {Array.from({ length: PROMO_TOTAL }).map((_, i) => (
                <button key={i} onClick={() => setPromoPage(i)} className={`rounded-full transition-all duration-300 ${i === promoPage ? 'bg-gray-800 text-white text-[10px] font-bold px-2.5 py-[4px] leading-none' : 'w-[7px] h-[7px] bg-gray-300 hover:bg-gray-500'}`} style={i === promoPage ? UI : {}}>{i === promoPage ? `${i + 1}/${PROMO_TOTAL}` : ''}</button>
              ))}
            </div>
            <div className="absolute right-4 bottom-0 flex gap-2">
              <button onClick={() => setPromoPage(p => Math.max(0, p - 1))} disabled={promoPage === 0} className="w-9 h-9 rounded-full bg-purple-800 hover:bg-purple-900 text-white flex items-center justify-center disabled:opacity-35 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPromoPage(p => Math.min(PROMO_TOTAL - 1, p + 1))} disabled={promoPage >= PROMO_TOTAL - 1} className="w-9 h-9 rounded-full bg-purple-800 hover:bg-purple-900 text-white flex items-center justify-center disabled:opacity-35 transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 14 — EXPERT HELP (Store Locator + Services dark panel)
      ════════════════════════════════════════════════════════════════════ */}
      {show('expert_help') && (
        <section className="bg-[#FAFAF8] border-t border-gray-200 py-12">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-5">
            <div className="relative rounded-sm overflow-hidden min-h-[200px]">
              <img src={products[6].image} alt="store" className="w-full h-full object-cover opacity-50 absolute inset-0" />
              <div className="absolute inset-0 bg-[#1a1230]/70" />
              <div className="relative z-10 p-8 flex flex-col h-full justify-between min-h-[200px]">
                <div>
                  <p className="text-purple-300 text-[10px] tracking-[0.35em] uppercase font-semibold" style={UI}>300+ Stores Across India</p>
                  <h3 className="text-white text-2xl font-light mt-2 leading-snug" style={SERIF}>Find your favourite designs<br />at a Store Nearby</h3>
                </div>
                <a href="#" className="inline-flex items-center gap-2 mt-6 bg-white text-purple-900 hover:bg-purple-50 px-5 py-2.5 text-[12px] font-bold tracking-wide transition-colors rounded-sm self-start" style={UI}>
                  <Store className="w-4 h-4" />Find a Store
                </a>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="bg-[#4A1D96] text-white rounded-sm p-7 flex items-center gap-5 flex-1">
                <div className="flex-1">
                  <p className="text-purple-200 text-[10px] tracking-[0.3em] uppercase font-semibold" style={UI}>Expert Help</p>
                  <h4 className="text-lg font-semibold mt-1 leading-snug" style={UI}>Unsure About What Design to Pick?</h4>
                  <a href="#" className="inline-block mt-3 border border-white/50 text-white hover:bg-white/20 px-4 py-1.5 text-[11px] font-semibold rounded-sm transition-colors" style={UI}>Get Help →</a>
                </div>
                <Home className="w-10 h-10 text-purple-300 flex-shrink-0" strokeWidth={1} />
              </div>
              <div className="bg-[#1B4D3E] text-white rounded-sm p-7 flex items-center gap-5 flex-1">
                <div className="flex-1">
                  <p className="text-emerald-300 text-[10px] tracking-[0.3em] uppercase font-semibold" style={UI}>Live Video</p>
                  <h4 className="text-lg font-semibold mt-1 leading-snug" style={UI}>View Designs in Live Video Call</h4>
                  <a href="#" className="inline-block mt-3 border border-white/50 text-white hover:bg-white/20 px-4 py-1.5 text-[11px] font-semibold rounded-sm transition-colors" style={UI}>Book Call →</a>
                </div>
                <Video className="w-10 h-10 text-emerald-300 flex-shrink-0" strokeWidth={1} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 15 — SOCIAL / UGC (#MyAurusStory)
      ════════════════════════════════════════════════════════════════════ */}
      {show('social_ugc') && (
        <section className="bg-[#0F0A14] py-14">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
            <div className="text-center mb-8">
              <p className="text-purple-400 text-[10px] tracking-[0.45em] uppercase mb-3" style={UI}>Aurus Xpression</p>
              <h3 className="text-white text-2xl sm:text-3xl font-light" style={SERIF}>Share your <span className="text-purple-400 font-medium">#MyAurusStory</span> and<br />win jewellery worth up to <span className="text-purple-300 font-semibold">₹15,000</span></h3>
              <p className="text-gray-500 text-sm mt-3" style={UI}>Tag us on Instagram and get featured on our page</p>
            </div>
            <div className="grid grid-cols-4 grid-rows-2 gap-2" style={{ height: '380px' }}>
              <div className="row-span-2 overflow-hidden rounded-lg cursor-pointer group">
                <img src={heroImg} alt="lifestyle" className="w-full h-full object-cover object-center opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500" />
              </div>
              {products.slice(0, 3).map(p => (
                <div key={p.id} className="overflow-hidden rounded-lg cursor-pointer group">
                  <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-cover opacity-55 group-hover:opacity-85 transition-opacity duration-300" />
                </div>
              ))}
              {products.slice(3, 6).map(p => (
                <div key={`b-${p.id}`} className="overflow-hidden rounded-lg cursor-pointer group">
                  <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-cover opacity-55 group-hover:opacity-85 transition-opacity duration-300" />
                </div>
              ))}
            </div>
            <p className="text-center text-purple-400 text-[12px] mt-6 tracking-wide" style={UI}>Use <strong>#MyAurusStory</strong> on Instagram to be featured</p>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 16 — NEWSLETTER / AURUS INSIDER
      ════════════════════════════════════════════════════════════════════ */}
      {show('newsletter') && (
        <section className="bg-gradient-to-br from-purple-900 via-purple-800 to-purple-600 py-14">
          <div className="max-w-[560px] mx-auto px-4 text-center">
            <p className="text-purple-300 text-[10px] tracking-[0.45em] uppercase font-semibold" style={UI}>Exclusive Access</p>
            <h3 className="text-white text-2xl sm:text-3xl font-light mt-3" style={SERIF}>Join Aurus Insider</h3>
            <p className="text-purple-200 text-[13px] mt-3 leading-relaxed" style={UI}>Get exclusive offers, early access to new collections, and personalised jewellery recommendations.</p>
            <div className="flex flex-col sm:flex-row gap-3 mt-7">
              <input placeholder="Enter your email address" className="flex-1 px-4 py-3 rounded-sm text-[13px] outline-none text-gray-900 placeholder-gray-400 border-2 border-transparent focus:border-purple-300" style={UI} />
              <button className="bg-white text-purple-900 hover:bg-purple-50 px-7 py-3 text-[13px] font-bold tracking-wide transition-colors rounded-sm flex-shrink-0" style={UI}>JOIN NOW</button>
            </div>
            <p className="text-purple-400 text-[11px] mt-4" style={UI}>By subscribing, you agree to our Privacy Policy</p>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          FOOTER + CART DRAWER
          Conditional: renders in full-page mode or when renderFooterAndCart=true.
          Skipped when renderOnly is set (individual section render mode).
      ════════════════════════════════════════════════════════════════════ */}
      {showFooterAndCart && <footer className="bg-white border-t border-gray-200" style={UI}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <h4 className="text-xl font-bold text-gray-900 tracking-[0.12em]" style={SERIF}>{meta.brand.toUpperCase()}</h4>
            <p className="text-[9px] text-gray-400 tracking-[0.25em] uppercase mt-0.5">Fine Jewellery</p>
            <p className="text-gray-500 text-xs mt-3 leading-relaxed">{meta.tagline}</p>
            <div className="flex gap-2 mt-5">
              {['IG', 'FB', 'TW', 'YT', 'PT'].map(s => (
                <a key={s} href="#" className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-[9px] font-bold text-gray-600 hover:bg-purple-700 hover:text-white transition-colors">{s}</a>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              {['App Store', 'Google Play'].map(s => (
                <a key={s} href="#" className="text-[10px] text-gray-600 border border-gray-300 rounded px-2.5 py-1.5 hover:border-purple-500 hover:text-purple-600 transition-colors">{s}</a>
              ))}
            </div>
          </div>
          {([
            ['Jewellery', ['Rings', 'Earrings', 'Necklaces', 'Bracelets', 'Pendants', 'Bangles', 'Mangalsutra', 'Nose Pins']],
            ['Collections', ['Latest Designs', 'Bestsellers', 'Diamond', 'Gold', 'Platinum', 'Gemstone', 'Solitaire', 'Rose Gold']],
            ['Services', ['Try at Home', 'Video Consultation', 'Track Order', 'Return Policy', 'EMI Options', 'Gold Exchange', 'Gift Cards']],
            ['Company', ['Our Story', 'Blog', 'Press', 'Stores', 'Careers', 'Contact Us', 'FAQ', 'Privacy Policy']],
          ] as [string, string[]][]).map(([heading, links]) => (
            <div key={heading}>
              <h5 className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-900 mb-4">{heading}</h5>
              <ul className="space-y-2">{links.map(l => (<li key={l}><a href="#" className="text-[12px] text-gray-500 hover:text-purple-700 transition-colors">{l}</a></li>))}</ul>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 py-4 px-4 sm:px-6">
          <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-gray-400">© 2026 {meta.brand} – Fine Jewellery. All rights reserved.</p>
            <div className="flex items-center gap-2">
              {['Visa', 'Mastercard', 'UPI', 'GPay', 'PhonePe', 'NetBanking', 'EMI'].map(p => (
                <span key={p} className="text-[10px] text-gray-500 border border-gray-200 rounded px-1.5 py-0.5 font-medium">{p}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>}

      {showFooterAndCart && <CartDrawer accentClass="bg-purple-800" fontClass="font-sans" />}
    </>
  );
};

export default AurusHomeSections;
