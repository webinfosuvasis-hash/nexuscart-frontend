/**
 * BrandStorySection
 * Simple text section with logo, title, paragraph.
 * eCraftIndia: "A Home For All Handcrafted Items" description section.
 */

import React from 'react';
import type { SectionDoc } from '@/admin/editor/types';

const BrandStorySection: React.FC<{ section: SectionDoc }> = ({ section }) => {
  const s     = section.settings;
  const bg    = (s.bg    as string) ?? '#ffffff';
  const title = (s.title as string) ?? '';
  const body  = (s.body  as string) ?? '';
  const pt    = Number(s.paddingTop    ?? 32);
  const pb    = Number(s.paddingBottom ?? 32);

  return (
    <div
      data-section-type="brand_story"
      style={{ background: bg, padding: `${pt}px 24px ${pb}px` }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {title && (
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 12 }}>
            {title}
          </h2>
        )}
        {body && (
          <p style={{ fontSize: 13, lineHeight: 1.8, color: '#6b7280', margin: 0 }}>
            {body}
          </p>
        )}
      </div>
    </div>
  );
};

export default BrandStorySection;
