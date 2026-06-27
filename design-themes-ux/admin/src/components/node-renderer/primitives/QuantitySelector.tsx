import React from 'react';
import { Minus, Plus } from 'lucide-react';
import type { NodeProps } from '../types';
import { useProductPageOptional } from '@/contexts/ProductPageContext';

const QuantitySelector: React.FC<NodeProps> = ({ node, style }) => {
  const pdp = useProductPageOptional();
  const s   = node.settings;

  const quantity   = pdp?.quantity  ?? 1;
  const min        = Number(s.min   ?? 1);
  const max        = Number(s.max   ?? 99);
  const setQty     = pdp?.setQuantity;

  const dec = () => setQty?.(Math.max(min, quantity - 1));
  const inc = () => setQty?.(Math.min(max, quantity + 1));

  const btnStyle: React.CSSProperties = {
    width: 36, height: 36, borderRadius: 6,
    border: '1px solid #d1d5db', background: '#fff',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, color: '#374151',
  };

  return (
    <div
      data-node-id={node.id}
      data-node-type="quantity_selector"
      style={{ display: 'flex', alignItems: 'center', gap: 0, ...style }}
    >
      <button onClick={dec} disabled={quantity <= min}
        style={{ ...btnStyle, borderRadius: '6px 0 0 6px', opacity: quantity <= min ? 0.4 : 1 }}>
        <Minus size={14} />
      </button>
      <div style={{
        width: 48, height: 36, border: '1px solid #d1d5db', borderLeft: 'none', borderRight: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 600, color: '#1a1a1a',
      }}>
        {quantity}
      </div>
      <button onClick={inc} disabled={quantity >= max}
        style={{ ...btnStyle, borderRadius: '0 6px 6px 0', opacity: quantity >= max ? 0.4 : 1 }}>
        <Plus size={14} />
      </button>
    </div>
  );
};

export default QuantitySelector;
