import React, { useState, useEffect } from 'react';
import { UI } from '@/themes/aurus/constants';
import { inr } from '@/context/StoreContext';
import { FILTER_ACCENT, FILTER_HAIRLINE, FILTER_INK } from './filterTokens';
import type { PriceFacet } from '@/lib/storefrontApi';

interface FilterPriceProps {
  facet: PriceFacet;
  onApply: (min?: number, max?: number) => void;
}

/** Dual-range price slider — bounds (min/max) are always derived live from the current catalog, never hardcoded. */
const FilterPrice: React.FC<FilterPriceProps> = ({ facet, onApply }) => {
  const { min: boundMin, max: boundMax } = facet;
  const [localMin, setLocalMin] = useState(facet.selectedMin ?? boundMin);
  const [localMax, setLocalMax] = useState(facet.selectedMax ?? boundMax);

  useEffect(() => {
    setLocalMin(facet.selectedMin ?? boundMin);
    setLocalMax(facet.selectedMax ?? boundMax);
  }, [facet.selectedMin, facet.selectedMax, boundMin, boundMax]);

  if (boundMin >= boundMax) return null;

  return (
    <div style={{ padding: '14px 0 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: FILTER_INK, ...UI }}>{inr(localMin)}</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: FILTER_INK, ...UI }}>{inr(localMax)}</span>
      </div>
      <div style={{ position: 'relative', height: 3, background: FILTER_HAIRLINE, borderRadius: 2, marginBottom: 16 }}>
        <div
          style={{
            position: 'absolute', height: 3, borderRadius: 2, background: FILTER_ACCENT,
            left: `${((localMin - boundMin) / (boundMax - boundMin)) * 100}%`,
            right: `${100 - ((localMax - boundMin) / (boundMax - boundMin)) * 100}%`,
          }}
        />
      </div>
      <input
        type="range" min={boundMin} max={boundMax} value={localMin}
        aria-label="Minimum price"
        onChange={(e) => setLocalMin(Math.min(Number(e.target.value), localMax - 1))}
        onMouseUp={() => onApply(localMin, localMax)}
        onTouchEnd={() => onApply(localMin, localMax)}
        className="w-full"
        style={{ accentColor: FILTER_ACCENT }}
      />
      <input
        type="range" min={boundMin} max={boundMax} value={localMax}
        aria-label="Maximum price"
        onChange={(e) => setLocalMax(Math.max(Number(e.target.value), localMin + 1))}
        onMouseUp={() => onApply(localMin, localMax)}
        onTouchEnd={() => onApply(localMin, localMax)}
        className="w-full"
        style={{ accentColor: FILTER_ACCENT }}
      />
    </div>
  );
};

export default FilterPrice;
