/**
 * VariantSelector — P6
 * Groups product.variants by option name (Size, Color, Material…)
 * and renders swatches or pill buttons for each.
 */
import React from 'react';
import type { NodeProps } from '../types';
import { useProductPageOptional } from '@/contexts/ProductPageContext';

// Group variants into { optionName → Set<optionValue> }
function groupOptions(variants: { options: Record<string, string> }[]) {
  const map = new Map<string, Set<string>>();
  variants.forEach(({ options }) => {
    Object.entries(options).forEach(([key, val]) => {
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(val);
    });
  });
  return map;
}

// Find the variant that matches all current selections
function findVariant(
  variants: { id: string; options: Record<string, string>; price: number; stock: number; image?: string }[],
  selections: Record<string, string>,
) {
  return variants.find((v) =>
    Object.entries(selections).every(([k, val]) => v.options[k] === val),
  ) ?? null;
}

const VariantSelector: React.FC<NodeProps> = ({ node, ctx, style }) => {
  const pdp = useProductPageOptional();
  const s   = node.settings;

  const variants   = pdp?.product.variants ?? [];
  const swatchType = (s.swatchType as string) ?? 'pill';  // 'pill' | 'swatch' | 'select'

  const [selections, setSelections] = React.useState<Record<string, string>>({});

  const optionGroups = groupOptions(variants);

  const select = (key: string, val: string) => {
    const next = { ...selections, [key]: val };
    setSelections(next);
    if (pdp) {
      const matched = findVariant(variants as any, next);
      pdp.setVariant(matched as any);
    }
  };

  if (variants.length === 0) {
    if (!ctx.isPreview) return null;
    return (
      <div data-node-id={node.id} data-node-type="variant_selector"
        style={{ padding: '12px', border: '1px dashed #d1d5db', borderRadius: 8, color: '#9ca3af', fontSize: 13, ...style }}>
        No variants — single SKU product
      </div>
    );
  }

  return (
    <div data-node-id={node.id} data-node-type="variant_selector" style={{ ...style }}>
      {Array.from(optionGroups.entries()).map(([optionName, values]) => (
        <div key={optionName} style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
            {optionName}
            {selections[optionName] && (
              <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>
                — {selections[optionName]}
              </span>
            )}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Array.from(values).map((val) => {
              const isSelected = selections[optionName] === val;
              // Color swatch: if val looks like a hex color or color name
              const isColor    = /^#[0-9a-f]{3,6}$/i.test(val) || /^[a-z]+$/i.test(val);
              const useColor   = swatchType === 'swatch' && isColor;

              return useColor ? (
                <button
                  key={val}
                  onClick={() => select(optionName, val)}
                  title={val}
                  style={{
                    width:      36, height: 36, borderRadius: '50%',
                    background: val,
                    border:     isSelected ? '2px solid #1a1a1a' : '2px solid transparent',
                    outline:    isSelected ? '2px solid #1a1a1a' : 'none',
                    outlineOffset: 2,
                    cursor:     'pointer',
                    padding:    0,
                  }}
                />
              ) : (
                <button
                  key={val}
                  onClick={() => select(optionName, val)}
                  style={{
                    padding:      '6px 16px',
                    borderRadius: 6,
                    fontSize:     13,
                    fontWeight:   isSelected ? 600 : 400,
                    cursor:       'pointer',
                    background:   isSelected ? '#1a1a1a' : '#f9fafb',
                    color:        isSelected ? '#fff'    : '#374151',
                    border:       isSelected ? '1px solid #1a1a1a' : '1px solid #d1d5db',
                    transition:   'all 150ms',
                  }}
                >
                  {val}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default VariantSelector;
