/**
 * ProductMosaicSection
 * Asymmetric product category showcase grid.
 * eCraftIndia layout: left 2×3 mini-grid + right tall featured image,
 * then bottom row of category thumbnails.
 *
 * Settings:
 *   bg           background (default #fff)
 *   items[]      { label, image, link, featured? }
 *                featured=true → spans full right column height
 *   paddingTop / paddingBottom
 */

import React from 'react';
import type { SectionDoc } from '@/admin/editor/types';

interface MosaicItem {
  label:     string;
  image?:    string;
  link?:     string;
  featured?: boolean;   // spans full right column
  color?:    string;
}

const FALLBACK_COLORS = [
  '#fef3c7', '#dbeafe', '#f3e8ff', '#dcfce7',
  '#fde68a', '#e0e7ff', '#fee2e2', '#d1fae5',
];

const MosaicCell: React.FC<{
  item:    MosaicItem;
  idx:     number;
  height?: number | string;
  style?:  React.CSSProperties;
}> = ({ item, idx, height = 140, style }) => (
  <a
    href={item.link ?? '#'}
    style={{
      display:        'block',
      textDecoration: 'none',
      borderRadius:   8,
      overflow:       'hidden',
      position:       'relative',
      height,
      background:     item.color ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
      ...style,
    }}
  >
    {item.image && (
      <img
        src={item.image}
        alt={item.label}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        loading="lazy"
      />
    )}
    {/* Gradient overlay + label */}
    <div style={{
      position:   'absolute',
      bottom:     0, left: 0, right: 0,
      padding:    '24px 12px 10px',
      background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)',
    }}>
      <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{item.label}</span>
    </div>
  </a>
);

const ProductMosaicSection: React.FC<{ section: SectionDoc }> = ({ section }) => {
  const s     = section.settings;
  const items = (s.items as MosaicItem[]) ?? [];
  const bg    = (s.bg as string) ?? '#ffffff';
  const pt    = Number(s.paddingTop   ?? 16);
  const pb    = Number(s.paddingBottom ?? 32);

  const featured = items.find((i) => i.featured);
  const regular  = items.filter((i) => !i.featured);

  if (items.length === 0) {
    return (
      <div data-section-type="product_mosaic"
        style={{ background: bg, padding: `${pt}px 32px ${pb}px`, color: '#9ca3af', textAlign: 'center' }}>
        Add mosaic items in the inspector
      </div>
    );
  }

  return (
    <div data-section-type="product_mosaic"
      style={{ background: bg, padding: `${pt}px 0 ${pb}px` }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>

        {/* Main mosaic: left grid + right featured */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          {/* Left: 2×N grid of regular items */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {regular.slice(0, 6).map((item, i) => (
              <MosaicCell key={i} item={item} idx={i} height={140} />
            ))}
          </div>

          {/* Right: featured tall image */}
          {featured && (
            <MosaicCell item={featured} idx={99} height="100%"
              style={{ minHeight: 292 }} />
          )}
        </div>

        {/* Bottom row of items */}
        {regular.length > 6 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(regular.length - 6, 4)}, 1fr)`, gap: 8 }}>
            {regular.slice(6, 10).map((item, i) => (
              <MosaicCell key={i} item={item} idx={i + 6} height={130} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductMosaicSection;
