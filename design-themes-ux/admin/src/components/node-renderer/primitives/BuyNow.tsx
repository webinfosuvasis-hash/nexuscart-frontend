import React from 'react';
import { Zap } from 'lucide-react';
import type { NodeProps } from '../types';
import { useProductPageOptional } from '@/contexts/ProductPageContext';

const BuyNow: React.FC<NodeProps> = ({ node, style }) => {
  const pdp  = useProductPageOptional();
  const s    = node.settings;

  const label   = (s.label as string) ?? 'Buy Now';
  const inStock = pdp?.inStock ?? true;

  return (
    <button
      data-node-id={node.id}
      data-node-type="buy_now"
      disabled={!inStock}
      onClick={() => pdp?.buyNow()}
      style={{
        flex:           1,
        padding:        '14px 24px',
        borderRadius:   Number(s.radius ?? 8),
        fontSize:       15,
        fontWeight:     700,
        cursor:         inStock ? 'pointer' : 'not-allowed',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            8,
        transition:     'all 200ms',
        background:     inStock ? '#7C3AED' : '#d1d5db',
        color:          '#fff',
        border:         'none',
        opacity:        inStock ? 1 : 0.7,
        ...style,
      }}
    >
      <Zap size={18} />
      {label}
    </button>
  );
};

export default BuyNow;
