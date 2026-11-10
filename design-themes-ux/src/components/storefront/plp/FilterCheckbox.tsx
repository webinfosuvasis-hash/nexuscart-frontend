import React from 'react';
import { UI } from '@/themes/aurus/constants';
import { FILTER_ACCENT, FILTER_MUTED, FILTER_TEXT } from './filterTokens';

interface FilterCheckboxProps {
  label:    string;
  count:    number;
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

/** Single checkbox row used inside FilterGroup — preserves the original AurusListing checkbox markup/styling. */
const FilterCheckbox: React.FC<FilterCheckboxProps> = ({ label, count, selected, disabled, onToggle }) => (
  <div
    onClick={disabled ? undefined : onToggle}
    style={{
      display: 'flex', alignItems: 'center', gap: 11,
      padding: '9px 2px', margin: '0 -2px', borderRadius: 6,
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      transition: 'background-color 0.12s',
    }}
    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = '#F3F8F6'; }}
    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
  >
    <div style={{
      width: 17, height: 17, flexShrink: 0,
      border: selected ? `1.5px solid ${FILTER_ACCENT}` : '1.5px solid #C9D6D0',
      borderRadius: 4,
      background: selected ? FILTER_ACCENT : '#FFFFFF',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.12s',
    }}>
      {selected && (
        <svg width="10" height="7" viewBox="0 0 11 8" fill="none">
          <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
    <span style={{ fontSize: 13, color: FILTER_TEXT, flex: 1, lineHeight: 1.5, ...UI }}>{label}</span>
    <span style={{ fontSize: 11, color: FILTER_MUTED, flexShrink: 0, ...UI }}>{count}</span>
  </div>
);

export default FilterCheckbox;
