import React from 'react';
import { ShoppingBag, Check } from 'lucide-react';
import type { NodeProps } from '../types';
import { useProductPageOptional } from '@/contexts/ProductPageContext';

const AddToCart: React.FC<NodeProps> = ({ node, style }) => {
  const pdp = useProductPageOptional();
  const s   = node.settings;

  const label    = (s.label    as string) ?? 'Add to Cart';
  const outLabel = (s.outLabel as string) ?? 'Out of Stock';
  const inStock  = pdp?.inStock  ?? true;
  const added    = pdp?.cartAdded ?? false;
  const variant  = (s.variant  as string) ?? 'filled'; // filled | outline

  const isFilled = variant === 'filled';

  return (
    <button
      data-node-id={node.id}
      data-node-type="add_to_cart"
      disabled={!inStock}
      onClick={() => pdp?.addToCart()}
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
        background:     isFilled ? (inStock ? '#1a1a1a' : '#d1d5db') : 'transparent',
        color:          isFilled ? '#fff' : '#1a1a1a',
        border:         isFilled ? 'none' : '2px solid #1a1a1a',
        opacity:        inStock ? 1 : 0.7,
        ...style,
      }}
    >
      {added ? <Check size={18} /> : <ShoppingBag size={18} />}
      {!inStock ? outLabel : added ? 'Added!' : label}
    </button>
  );
};

export default AddToCart;
