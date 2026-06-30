import React from 'react';
import { UI } from '@/themes/aurus/constants';

const PURPLE_COUNT = '#7B59C0';

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
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0', cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.4 : 1,
    }}
  >
    <div style={{
      width: 18, height: 18, flexShrink: 0,
      border: selected ? '2px solid #7C3AED' : '1.5px solid #CCCCCC',
      borderRadius: 3,
      background: selected ? '#7C3AED' : '#FFFFFF',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.12s',
    }}>
      {selected && (
        <svg width="10" height="7" viewBox="0 0 11 8" fill="none">
          <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
    <span style={{ fontSize: 13, color: '#444444', flex: 1, lineHeight: 1.5, ...UI }}>{label}</span>
    <span style={{ fontSize: 11, color: PURPLE_COUNT, flexShrink: 0, ...UI }}>({count})</span>
  </div>
);

export default FilterCheckbox;
