/**
 * CollectionGrid — Sprint 10 (architecture stub)
 * Same pattern as ProductGrid. Renders pre-resolved collections or placeholder.
 */

import React from 'react';
import type { NodeProps } from '../types';

const PLACEHOLDER_COLLECTIONS = [
  { id: '1', title: 'Category 1', image: null },
  { id: '2', title: 'Category 2', image: null },
  { id: '3', title: 'Category 3', image: null },
  { id: '4', title: 'Category 4', image: null },
];

const CollectionGrid: React.FC<NodeProps> = ({ node, ctx, style }) => {
  const s     = node.settings;
  const cols  = Number(s.gridCols ?? 4);
  const items = (s.resolvedItems as any[]) ?? (ctx.isPreview ? PLACEHOLDER_COLLECTIONS : []);

  const gridStyle: React.CSSProperties = {
    display:             'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap:                 s.gap !== undefined ? `${s.gap}px` : '16px',
    ...style,
  };

  if (items.length === 0 && !ctx.isPreview) return null;

  return (
    <div data-node-id={node.id} data-node-type="collection_grid" style={gridStyle}>
      {items.map((item: any) => (
        <a key={item.id} href={item.url ?? '#'}
          style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
          <div style={{ aspectRatio: '1/1', background: '#f3f4f6', borderRadius: 8,
            marginBottom: 8, overflow: 'hidden' }}>
            {item.image
              ? <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #e5e7eb, #d1d5db)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#6b7280', fontSize: 12, fontWeight: 600 }}>
                  {item.title}
                </div>
            }
          </div>
          <p style={{ margin: 0, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#111827' }}>
            {item.title}
          </p>
        </a>
      ))}
    </div>
  );
};

export default CollectionGrid;
