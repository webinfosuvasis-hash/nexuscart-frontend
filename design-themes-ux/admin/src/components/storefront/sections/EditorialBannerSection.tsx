/**
 * EditorialBannerSection
 * The "New Arrival" script font editorial divider.
 * Settings:
 *   scriptText   large script/handwriting text (default "New Arrival")
 *   subtitle     red subtitle text
 *   bg           background color
 *   showFloral   decorative flower element (default true)
 */

import React from 'react';
import type { SectionDoc } from '@/admin/editor/types';

const EditorialBannerSection: React.FC<{ section: SectionDoc }> = ({ section }) => {
  const s          = section.settings;
  const scriptText = (s.scriptText as string) ?? 'New Arrival';
  const subtitle   = (s.subtitle   as string) ?? 'Select from the latest collection';
  const bg         = (s.bg         as string) ?? '#fdf8f3';
  const accentColor= (s.accentColor as string) ?? '#cc3300';
  const pt         = Number(s.paddingTop    ?? 24);
  const pb         = Number(s.paddingBottom ?? 24);

  return (
    <div
      data-section-type="editorial_banner"
      style={{
        background:  bg,
        padding:     `${pt}px 24px ${pb}px`,
        display:     'flex',
        alignItems:  'center',
        justifyContent: 'center',
        gap:         24,
        position:    'relative',
        overflow:    'hidden',
      }}
    >
      {/* Script text */}
      <span style={{
        fontFamily:  '"Dancing Script", "Pacifico", cursive, serif',
        fontSize:    52,
        color:       '#1a1a1a',
        lineHeight:  1,
        fontWeight:  700,
      }}>
        {scriptText}
      </span>

      {/* Vertical divider */}
      <div style={{ width: 1, height: 48, background: '#d1d5db' }} />

      {/* Subtitle */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 13, color: '#9ca3af', marginBottom: 2 }}>
          Select from the
        </span>
        <span style={{ fontSize: 16, fontWeight: 700, color: accentColor }}>
          {subtitle}
        </span>
      </div>

      {/* Decorative flowers (CSS only — no external images needed) */}
      <div style={{
        position:   'absolute',
        right:      32,
        top:        '50%',
        transform:  'translateY(-50%)',
        fontSize:   40,
        opacity:    0.6,
        userSelect: 'none',
        pointerEvents: 'none',
      }}>
        🌸🌷🌸
      </div>
    </div>
  );
};

export default EditorialBannerSection;
