/**
 * CollectionCirclesSection
 * Horizontal row of circular category thumbnails with label below.
 * Used in eCraftIndia-style handicraft / Indian ecommerce homepages.
 *
 * Settings:
 *   title?        section heading (optional)
 *   items[]       { label, image, link } — one circle per item
 *   bg            background color (default #fff)
 *   circleSize    circle diameter in px (default 100)
 *   columns       max visible on desktop (default 8, scroll on mobile)
 *   paddingTop / paddingBottom
 */

import React from 'react';
import type { SectionDoc } from '@/admin/editor/types';

interface CircleItem {
  label: string;
  image?: string;
  link?:  string;
  color?: string; // fallback bg if no image
}

const FALLBACK_COLORS = [
  '#f3e8ff', '#fef3c7', '#dbeafe', '#dcfce7',
  '#fee2e2', '#f0fdf4', '#fdf2f8', '#fffbeb',
];

const CollectionCirclesSection: React.FC<{ section: SectionDoc }> = ({ section }) => {
  const s          = section.settings;
  const items      = (s.items as CircleItem[]) ?? [];
  const bg         = (s.bg as string) ?? '#ffffff';
  const circleSize = Number(s.circleSize ?? 100);
  const pt         = Number(s.paddingTop  ?? 32);
  const pb         = Number(s.paddingBottom ?? 32);
  const title      = s.title as string | undefined;

  if (items.length === 0) {
    return (
      <div data-section-type="collection_circles"
        style={{ background: bg, padding: `${pt}px 32px ${pb}px`, textAlign: 'center', color: '#9ca3af' }}>
        Add circle items in the inspector
      </div>
    );
  }

  return (
    <div data-section-type="collection_circles"
      style={{ background: bg, padding: `${pt}px 0 ${pb}px` }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        {title && (
          <h2 style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, marginBottom: 20, color: '#1a1a1a' }}>
            {title}
          </h2>
        )}

        {/* Scrollable on mobile, centered on desktop */}
        <div style={{
          display:             'flex',
          gap:                 24,
          overflowX:           'auto',
          justifyContent:      items.length <= 6 ? 'center' : 'flex-start',
          paddingBottom:       8,
          scrollbarWidth:      'none',
          msOverflowStyle:     'none',
        }}>
          {items.map((item, i) => (
            <a
              key={i}
              href={item.link ?? '#'}
              style={{
                display:       'flex',
                flexDirection: 'column',
                alignItems:    'center',
                gap:            10,
                textDecoration: 'none',
                flexShrink:    0,
                minWidth:      circleSize + 16,
                cursor:        'pointer',
              }}
            >
              {/* Circle */}
              <div style={{
                width:        circleSize,
                height:       circleSize,
                borderRadius: '50%',
                overflow:     'hidden',
                background:   item.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
                border:       '2px solid #e5e7eb',
                flexShrink:   0,
                transition:   'transform 200ms, box-shadow 200ms',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.label}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    loading="lazy"
                  />
                ) : (
                  <div style={{
                    width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600, color: '#6b7280', textAlign: 'center', padding: 8,
                  }}>
                    {item.label.slice(0, 2)}
                  </div>
                )}
              </div>

              {/* Label */}
              <span style={{
                fontSize:   12,
                fontWeight: 600,
                color:      '#374151',
                textAlign:  'center',
                lineHeight: 1.3,
                maxWidth:   circleSize + 16,
              }}>
                {item.label}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CollectionCirclesSection;
