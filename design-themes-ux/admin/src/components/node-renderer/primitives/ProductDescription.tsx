import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { NodeProps } from '../types';
import { useProductPageOptional } from '@/contexts/ProductPageContext';

const ProductDescription: React.FC<NodeProps> = ({ node, ctx, style }) => {
  const pdp         = useProductPageOptional();
  const s           = node.settings;
  const html        = pdp?.product.description
    ?? (s.html as string)
    ?? (ctx.isPreview ? '<p>Product description will appear here.</p>' : '');
  const collapsible = Boolean(s.collapsible ?? false);
  const label       = (s.label as string) ?? 'Description';
  const [open, setOpen] = useState(!collapsible);

  return (
    <div data-node-id={node.id} data-node-type="product_description" style={style}>
      {collapsible && (
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
      )}
      {(!collapsible || open) && (
        <div
          className="nx-richtext"
          style={{ fontSize: 14, lineHeight: 1.7, color: '#374151' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
};

export default ProductDescription;
