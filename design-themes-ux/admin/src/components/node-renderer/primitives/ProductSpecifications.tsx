/**
 * ProductSpecifications — P6
 * Renders product.attributes as a key-value table or accordion.
 * Essential for Electronics (specs), Furniture (dimensions), Jewelry (material).
 */
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { NodeProps } from '../types';
import { useProductPageOptional } from '@/contexts/ProductPageContext';

const ProductSpecifications: React.FC<NodeProps> = ({ node, ctx, style }) => {
  const pdp    = useProductPageOptional();
  const s      = node.settings;
  const layout = (s.layout as string) ?? 'table'; // 'table' | 'accordion'
  const label  = (s.label  as string) ?? 'Specifications';
  const [open, setOpen] = useState(true);

  // Attributes from product, or static from settings
  const attrs: { name: string; values: string[] }[] =
    pdp?.product.attributes ?? (s.attributes as any[]) ?? [];

  // Also include SKU / Weight / Dimensions from product if no attributes
  const rows: { key: string; value: string }[] =
    attrs.length > 0
      ? attrs.map((a) => ({ key: a.name, value: a.values.join(', ') }))
      : pdp?.product
        ? [
            pdp.product.sku        && { key: 'SKU',      value: pdp.product.sku },
            pdp.product.weight     && { key: 'Weight',   value: `${pdp.product.weight}g` },
            pdp.product.brand      && { key: 'Brand',    value: pdp.product.brand },
            pdp.product.category   && { key: 'Category', value: pdp.product.category },
          ].filter(Boolean) as { key: string; value: string }[]
        : [];

  if (rows.length === 0 && !ctx.isPreview) return null;

  return (
    <div data-node-id={node.id} data-node-type="product_specifications" style={style}>
      {layout === 'accordion' ? (
        <>
          <button
            onClick={() => setOpen((o) => !o)}
            style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0', border: 'none', background: 'transparent',
              borderTop: '1px solid #e5e7eb', borderBottom: open ? 'none' : '1px solid #e5e7eb',
              cursor: 'pointer', fontSize: 15, fontWeight: 600, color: '#1a1a1a',
            }}
          >
            {label}
            <ChevronDown size={18} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '200ms' }} />
          </button>
          {open && <SpecTable rows={rows} ctx={ctx} />}
        </>
      ) : (
        <>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#1a1a1a' }}>{label}</p>
          <SpecTable rows={rows} ctx={ctx} />
        </>
      )}
    </div>
  );
};

const SpecTable: React.FC<{ rows: { key: string; value: string }[]; ctx: any }> = ({ rows, ctx }) => {
  if (rows.length === 0) {
    return ctx.isPreview ? (
      <p style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>No specifications — add attributes to this product</p>
    ) : null;
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? '#f9fafb' : '#fff' }}>
            <td style={{ padding: '9px 12px', fontWeight: 600, color: '#374151', width: '40%', borderBottom: '1px solid #f3f4f6' }}>
              {row.key}
            </td>
            <td style={{ padding: '9px 12px', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default ProductSpecifications;
