import React from 'react';
import { UI } from '@/themes/aurus/constants';
import { FILTER_ACCENT, FILTER_ACCENT_SOFT, FILTER_MUTED, FILTER_TEXT } from './filterTokens';
import type { FacetOption } from '@/lib/storefrontApi';

interface FilterSizeProps {
  options: FacetOption[];
  onToggle: (value: string) => void;
}

const FilterSize: React.FC<FilterSizeProps> = ({ options, onToggle }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, padding: '13px 0 18px' }}>
    {options.map((opt) => (
      <button
        key={opt.value}
        onClick={() => !opt.disabled && onToggle(opt.value)}
        disabled={opt.disabled}
        style={{
          minWidth: 42, height: 36, padding: '0 11px',
          border: opt.selected ? `1.5px solid ${FILTER_ACCENT}` : '1.5px solid #DCE8E3',
          background: opt.selected ? FILTER_ACCENT_SOFT : '#FFFFFF',
          color: opt.selected ? FILTER_ACCENT : opt.disabled ? '#BBBBBB' : FILTER_TEXT,
          borderRadius: 7, fontSize: 12.5, fontWeight: 600,
          cursor: opt.disabled ? 'default' : 'pointer',
          opacity: opt.disabled ? 0.45 : 1,
          transition: 'all 0.12s',
          ...UI,
        }}
      >
        {opt.label}
      </button>
    ))}
    {options.length === 0 && <span style={{ fontSize: 12, color: FILTER_MUTED, ...UI }}>No sizes available</span>}
  </div>
);

export default FilterSize;
