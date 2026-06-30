import React, { useEffect, useMemo, useState } from 'react';
import { UI } from '@/themes/aurus/constants';
import type { ProductVariant } from '@/lib/storefrontApi';

interface VariantSelectorProps {
  variants: ProductVariant[];
  onChange: (variant: ProductVariant | null) => void;
}

/**
 * Derives distinct option axes (color, size, ...) generically from
 * `variant.options` keys instead of hardcoding "fabric"/"size" — works for
 * any attribute combination a store's variants happen to use. Selecting a
 * full combination resolves the matching ProductVariant (price/stock/image);
 * combinations with zero stock across all matching variants are disabled.
 */
const VariantSelector: React.FC<VariantSelectorProps> = ({ variants, onChange }) => {
  const axes = useMemo(() => {
    const keys = new Set<string>();
    variants.forEach((v) => Object.keys(v.options).forEach((k) => keys.add(k)));
    return Array.from(keys);
  }, [variants]);

  const valuesByAxis = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const axis of axes) {
      const set = new Set<string>();
      variants.forEach((v) => { if (v.options[axis]) set.add(v.options[axis]); });
      map[axis] = Array.from(set).sort();
    }
    return map;
  }, [axes, variants]);

  const [selected, setSelected] = useState<Record<string, string>>({});

  // Pre-select the first in-stock variant's combination so price/stock reflect a real SKU by default.
  useEffect(() => {
    if (variants.length === 0) return;
    const firstInStock = variants.find((v) => v.stock > 0) ?? variants[0];
    setSelected(firstInStock.options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants]);

  const resolvedVariant = useMemo(() => {
    if (axes.length === 0) return null;
    if (!axes.every((axis) => selected[axis])) return null;
    return variants.find((v) => axes.every((axis) => v.options[axis] === selected[axis])) ?? null;
  }, [axes, selected, variants]);

  useEffect(() => { onChange(resolvedVariant); }, [resolvedVariant, onChange]);

  const isAvailable = (axis: string, value: string): boolean =>
    variants.some((v) =>
      v.options[axis] === value &&
      v.stock > 0 &&
      axes.filter((a) => a !== axis).every((a) => !selected[a] || v.options[a] === selected[a]),
    );

  if (variants.length === 0) return null;

  return (
    <>
      {axes.map((axis) => (
        <div key={axis} className="mt-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-600 mb-3" style={UI}>{axis}</p>
          <div className="flex flex-wrap gap-2">
            {valuesByAxis[axis].map((value) => {
              const isSel = selected[axis] === value;
              const available = isAvailable(axis, value);
              return (
                <button
                  key={value}
                  disabled={!available}
                  onClick={() => setSelected((prev) => ({ ...prev, [axis]: value }))}
                  className={`px-4 h-10 text-[12px] border transition-all duration-150 font-medium rounded-sm ${
                    !available
                      // Unavailable always keeps the disabled/strikethrough look, even if
                      // it's the currently-selected value (e.g. the only in-stock fallback
                      // selection still resolves to an out-of-stock combination) — a thin
                      // ring distinguishes "selected but unavailable" from "just unavailable".
                      ? `border-gray-200 text-gray-300 line-through cursor-not-allowed ${isSel ? 'ring-1 ring-gray-400 ring-offset-1' : ''}`
                      : isSel
                      ? 'border-purple-700 bg-purple-700 text-white'
                      : 'border-gray-300 text-gray-700 hover:border-purple-400 hover:text-purple-700'
                  }`}
                  style={UI}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
};

export default VariantSelector;
