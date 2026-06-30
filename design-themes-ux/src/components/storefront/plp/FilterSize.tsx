import React from 'react';
import { UI } from '@/themes/aurus/constants';
import type { FacetOption } from '@/lib/storefrontApi';

interface FilterSizeProps {
  options: FacetOption[];
  onToggle: (value: string) => void;
}

const FilterSize: React.FC<FilterSizeProps> = ({ options, onToggle }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 0 16px' }}>
    {options.map((opt) => (
      <button
        key={opt.value}
        onClick={() => !opt.disabled && onToggle(opt.value)}
        disabled={opt.disabled}
        style={{
          minWidth: 40, height: 36, padding: '0 10px',
          border: opt.selected ? '2px solid #7C3AED' : '1.5px solid #D1D5DB',
          background: opt.selected ? '#F5F0FF' : '#FFFFFF',
          color: opt.selected ? '#7C3AED' : opt.disabled ? '#BBBBBB' : '#444444',
          borderRadius: 6, fontSize: 13, fontWeight: 600,
          cursor: opt.disabled ? 'default' : 'pointer',
          opacity: opt.disabled ? 0.45 : 1,
          ...UI,
        }}
      >
        {opt.label}
      </button>
    ))}
    {options.length === 0 && <span style={{ fontSize: 12, color: '#999', ...UI }}>No sizes available</span>}
  </div>
);

export default FilterSize;
