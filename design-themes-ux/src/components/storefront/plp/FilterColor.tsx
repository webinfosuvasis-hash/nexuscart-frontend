import React from 'react';
import { UI } from '@/themes/aurus/constants';
import type { FacetOption } from '@/lib/storefrontApi';

/** Best-effort CSS color for known color-name facet values; falls back to a neutral swatch. */
const COLOR_SWATCH: Record<string, string> = {
  Red: '#DC2626', Pink: '#EC4899', Blue: '#2563EB', Green: '#16A34A',
  Black: '#111111', White: '#FFFFFF', Cream: '#F5E6CA', Mustard: '#D9A521',
  Maroon: '#7F1D1D', Wine: '#5B1A1A',
};

interface FilterColorProps {
  options: FacetOption[];
  onToggle: (value: string) => void;
}

const FilterColor: React.FC<FilterColorProps> = ({ options, onToggle }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '12px 0 16px' }}>
    {options.map((opt) => {
      const swatch = COLOR_SWATCH[opt.label] ?? '#D4D4D4';
      return (
        <button
          key={opt.value}
          onClick={() => !opt.disabled && onToggle(opt.value)}
          disabled={opt.disabled}
          title={`${opt.label} (${opt.count})`}
          style={{
            width: 30, height: 30, borderRadius: '50%', background: swatch,
            border: opt.selected ? '2.5px solid #7C3AED' : '1.5px solid #E5E5E5',
            boxShadow: opt.selected ? '0 0 0 2px #fff inset' : undefined,
            cursor: opt.disabled ? 'default' : 'pointer',
            opacity: opt.disabled ? 0.35 : 1,
            position: 'relative', flexShrink: 0,
          }}
        >
          {opt.selected && (
            <svg width="12" height="9" viewBox="0 0 11 8" fill="none" style={{ position: 'absolute', inset: 0, margin: 'auto' }}>
              <path d="M1 4L4 7L10 1" stroke={swatch === '#FFFFFF' || swatch === '#F5E6CA' ? '#111' : '#fff'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      );
    })}
    {options.length === 0 && <span style={{ fontSize: 12, color: '#999', ...UI }}>No colors available</span>}
  </div>
);

export default FilterColor;
