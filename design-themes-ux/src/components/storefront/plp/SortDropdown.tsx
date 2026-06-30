import React from 'react';
import { ChevronDown } from 'lucide-react';
import { UI } from '@/themes/aurus/constants';
import type { SortOption } from '@/lib/storefrontApi';

interface SortDropdownProps {
  options: { value: SortOption; label: string }[];
  value:   SortOption | undefined;
  onChange: (value: SortOption) => void;
}

/** Sort selector — preserves the original AurusListing "Sort By" control markup. */
const SortDropdown: React.FC<SortDropdownProps> = ({ options, value, onChange }) => {
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <div className="relative flex-shrink-0">
      <div className="flex items-center gap-1 text-[13px] font-medium text-purple-700 cursor-pointer select-none" style={UI}>
        Sort By: <span className="font-semibold">{current?.label ?? 'Featured'}</span>
        <ChevronDown className="w-4 h-4 text-purple-700" />
      </div>
      <select
        value={current?.value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        style={UI}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
};

export default SortDropdown;
