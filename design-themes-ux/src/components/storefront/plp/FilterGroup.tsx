import React, { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { UI } from '@/themes/aurus/constants';
import FilterCheckbox from './FilterCheckbox';
import { FILTER_ACCENT, FILTER_HAIRLINE, FILTER_INK, FILTER_MUTED } from './filterTokens';
import type { FacetOption } from '@/lib/storefrontApi';

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
    <div style={{ borderBottom: `1px solid ${FILTER_HAIRLINE}`, paddingTop: 3 }}>
      <button
        onClick={onToggleOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '17px 0 15px', background: 'none', border: 'none', cursor: 'pointer', ...UI,
        }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 600, color: FILTER_INK, letterSpacing: '0.06em', textTransform: 'uppercase', ...UI }}>
          {label}
        </span>
        <ChevronDown
          style={{
            width: 15, height: 15, color: FILTER_MUTED, flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s',
          }}
        />
      </button>

      {open && (
        <div style={{ paddingBottom: 18 }}>
          {searchable && options.length > 8 && (
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Search style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: FILTER_MUTED }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}`}
                style={{ width: '100%', padding: '8px 10px 8px 28px', fontSize: 12.5, border: `1px solid ${FILTER_HAIRLINE}`, borderRadius: 7, outline: 'none', color: FILTER_INK, background: '#FCFEFD', ...UI }}
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
            <p style={{ fontSize: 12, color: FILTER_MUTED, padding: '6px 0', ...UI }}>No matches</p>
          )}

          {remaining > 0 && !showAll && !query.trim() && (
            <button
              onClick={() => setShowAll(true)}
              style={{ marginTop: 8, fontSize: 12, color: FILTER_ACCENT, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5, ...UI }}
            >
              <span style={{ fontSize: 13 }}>↓</span> {remaining} More
            </button>
          )}
          {showAll && remaining > 0 && (
            <button
              onClick={() => setShowAll(false)}
              style={{ marginTop: 8, fontSize: 12, color: FILTER_ACCENT, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5, ...UI }}
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
