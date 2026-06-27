/**
 * ProductGrid — Sprint 10 (architecture stub)
 *
 * Full data binding resolves at compile time (Sprint 15 island compiler).
 * In Sprint 10 we wire the architecture: the component receives pre-resolved
 * `node.settings.resolvedItems` from the compile pipeline, or renders a
 * placeholder when running in the editor preview.
 *
 * Data flow (Sprint 15+):
 *   Compile pipeline fetches collection → injects items into node.settings
 *   → ProductGrid renders resolved items → children repeat per item
 *
 * For now: render resolved items if present, else preview placeholder.
 */

import React from 'react';
import type { NodeProps } from '../types';

const PLACEHOLDER_PRODUCTS = [
  { id: '1', title: 'Product 1', price: '₹999',  image: null },
  { id: '2', title: 'Product 2', price: '₹1,299', image: null },
  { id: '3', title: 'Product 3', price: '₹799',  image: null },
  { id: '4', title: 'Product 4', price: '₹1,499', image: null },
];

const ProductGrid: React.FC<NodeProps> = ({ node, ctx, style, children }) => {
  const s       = node.settings;
  const cols    = Number(s.gridCols ?? s.columnsDesktop ?? 4);
  const items   = (s.resolvedItems as any[]) ?? (ctx.isPreview ? PLACEHOLDER_PRODUCTS : []);
  const limit   = Number(s.limit ?? items.length);

  const gridStyle: React.CSSProperties = {
    display:             'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap:                 s.gap !== undefined ? `${s.gap}px` : '24px',
    ...style,
  };

  if (items.length === 0 && !ctx.isPreview) return null;

  return (
    <div data-node-id={node.id} data-node-type="product_grid">
      {/* Section header: children handle title/view-all blocks */}
      {children}
      {/* Product grid */}
      <div style={gridStyle}>
        {items.slice(0, limit).map((item: any) => (
          <a key={item.id} href={item.url ?? '#'}
            style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ aspectRatio: '1/1', background: '#f3f4f6', borderRadius: 8,
              marginBottom: 8, overflow: 'hidden' }}>
              {item.image
                ? <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #e5e7eb, #d1d5db)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#9ca3af', fontSize: 11 }}>
                    {item.title}
                  </div>
              }
            </div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>{item.title}</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#374151' }}>{item.price}</p>
          </a>
        ))}
      </div>
    </div>
  );
};

export default ProductGrid;
