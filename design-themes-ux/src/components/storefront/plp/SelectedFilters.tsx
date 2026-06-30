import React from 'react';
import { UI } from '@/themes/aurus/constants';
import type { ActiveFilterChip } from '@/hooks/useFilters';

interface SelectedFiltersProps {
  chips: ActiveFilterChip[];
  onRemove: (chip: ActiveFilterChip) => void;
}

/** Row of removable filter chips — preserves the original AurusListing applied-filter pill markup. */
const SelectedFilters: React.FC<SelectedFiltersProps> = ({ chips, onRemove }) => (
  <>
    {chips.map((chip) => {
      const display = chip.label.charAt(0).toUpperCase() + chip.label.slice(1);
      return (
        <span
          key={`${chip.paramKey}-${chip.value}`}
          className="flex items-center gap-1.5 bg-white border border-gray-500 text-[13px] text-gray-800 rounded-full px-3.5 py-[6px] cursor-default select-none"
          style={UI}
        >
          {display}
          <button
            onClick={() => onRemove(chip)}
            className="text-gray-500 hover:text-gray-900 transition-colors leading-none ml-0.5 text-[15px] font-light"
            aria-label={`Remove ${display} filter`}
          >
            ×
          </button>
        </span>
      );
    })}
  </>
);

export default SelectedFilters;
