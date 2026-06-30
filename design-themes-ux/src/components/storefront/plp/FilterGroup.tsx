import React, { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { UI } from '@/themes/aurus/constants';
import FilterCheckbox from './FilterCheckbox';
import type { FacetOption } from '@/lib/storefrontApi';

const PINK = '#E91E8C';

interface FilterGroupProps {
  label: string;
  options: FacetOption[];
  onToggle: (value: string) => void;
  open: boolean;
  onToggleOpen: () => void;
  /** Number of items to show before "N More" — defaults to 4, matching the original design. */
  visibleCount?: number;
  /** Shows an inline search-within-options box — useful once a group has many values (e.g. Brand). */
  searchable?: boolean;
}

/** Collapsible accordion section listing a facet's checkbox options — preserves the original AurusListing FilterSection chrome. */
const FilterGroup: React.FC<FilterGroupProps> = ({ label, options, onToggle, open, onToggleOpen, visibleCount = 4, searchable }) => {
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => (query.trim() ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())) : options),
    [options, query],
  );
  const visible = showAll || query.trim() ? filtered : filtered.slice(0, visibleCount);
  const remaining = filtered.length - visibleCount;

  if (options.length === 0) return null;

  return (
    <div style={{ borderBottom: '1px solid #F0F0F0', paddingTop: 2 }}>
      <button
        onClick={onToggleOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 0 14px', background: 'none', border: 'none', cursor: 'pointer', ...UI,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: '#222222', letterSpacing: '0.01em', ...UI }}>
          {label}
        </span>
        {!open && <ChevronDown style={{ width: 15, height: 15, color: '#999999', flexShrink: 0 }} />}
      </button>

      {open && (
        <div style={{ paddingBottom: 16 }}>
          {searchable && options.length > 8 && (
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <Search style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#AAAAAA' }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}`}
                style={{ width: '100%', padding: '7px 8px 7px 26px', fontSize: 12, border: '1px solid #E5E5E5', borderRadius: 6, outline: 'none', ...UI }}
              />
            </div>
          )}

          {visible.map((opt) => (
            <FilterCheckbox
              key={opt.value}
              label={opt.label}
              count={opt.count}
              selected={opt.selected}
              disabled={opt.disabled}
              onToggle={() => onToggle(opt.value)}
            />
          ))}
          {visible.length === 0 && (
            <p style={{ fontSize: 12, color: '#999', padding: '6px 0', ...UI }}>No matches</p>
          )}

          {remaining > 0 && !showAll && !query.trim() && (
            <button
              onClick={() => setShowAll(true)}
              style={{ marginTop: 6, fontSize: 12, color: PINK, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, ...UI }}
            >
              <span style={{ fontSize: 13 }}>↓</span> {remaining} More
            </button>
          )}
          {showAll && remaining > 0 && (
            <button
              onClick={() => setShowAll(false)}
              style={{ marginTop: 6, fontSize: 12, color: PINK, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, ...UI }}
            >
              <span style={{ fontSize: 13 }}>↑</span> Show Less
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterGroup;
