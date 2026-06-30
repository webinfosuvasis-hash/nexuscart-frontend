import React, { useState, useEffect } from 'react';
import { UI } from '@/themes/aurus/constants';
import { inr } from '@/context/StoreContext';
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
    <div style={{ padding: '12px 0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: '#444', ...UI }}>{inr(localMin)}</span>
        <span style={{ fontSize: 12, color: '#444', ...UI }}>{inr(localMax)}</span>
      </div>
      <div style={{ position: 'relative', height: 4, background: '#EEEEEE', borderRadius: 2, marginBottom: 14 }}>
        <div
          style={{
            position: 'absolute', height: 4, borderRadius: 2, background: '#7C3AED',
            left: `${((localMin - boundMin) / (boundMax - boundMin)) * 100}%`,
            right: `${100 - ((localMax - boundMin) / (boundMax - boundMin)) * 100}%`,
          }}
        />
      </div>
      <input
        type="range" min={boundMin} max={boundMax} value={localMin}
        onChange={(e) => setLocalMin(Math.min(Number(e.target.value), localMax - 1))}
        onMouseUp={() => onApply(localMin, localMax)}
        onTouchEnd={() => onApply(localMin, localMax)}
        className="w-full"
        style={{ accentColor: '#7C3AED' }}
      />
      <input
        type="range" min={boundMin} max={boundMax} value={localMax}
        onChange={(e) => setLocalMax(Math.max(Number(e.target.value), localMin + 1))}
        onMouseUp={() => onApply(localMin, localMax)}
        onTouchEnd={() => onApply(localMin, localMax)}
        className="w-full"
        style={{ accentColor: '#7C3AED' }}
      />
    </div>
  );
};

export default FilterPrice;
