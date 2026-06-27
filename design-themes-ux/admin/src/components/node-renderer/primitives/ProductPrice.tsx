import React from 'react';
import type { NodeProps } from '../types';
import { useProductPageOptional } from '@/contexts/ProductPageContext';
import { formatCanvasPrice } from '@/hooks/useCanvasProducts';

const ProductPrice: React.FC<NodeProps> = ({ node, ctx, style }) => {
  const pdp = useProductPageOptional();
  const s   = node.settings;

  const price       = pdp?.effectivePrice    ?? (Number(s.price)        || 0);
  const compare     = pdp?.comparePrice      ?? (s.comparePrice ? Number(s.comparePrice) : undefined);
  const discount    = pdp?.discountPct       ?? 0;
  const showBadge   = s.showDiscountBadge !== false && discount > 0;
  const currency    = (s.currency as string) ?? 'INR';

  const fmt = (n: number) => formatCanvasPrice(n, currency);

  return (
    <div
      data-node-id={node.id}
      data-node-type="product_price"
      style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, ...style }}
    >
      {/* Current price */}
      <span style={{
        fontSize:   Number(s.priceSize ?? 28),
        fontWeight: 700,
        color:      (s.priceColor as string) ?? '#1a1a1a',
      }}>
        {fmt(price)}
      </span>

      {/* Compare / original price */}
      {compare && compare > price && (
        <span style={{
          fontSize:       Number(s.compareSize ?? 18),
          color:          '#9ca3af',
          textDecoration: 'line-through',
        }}>
          {fmt(compare)}
        </span>
      )}

      {/* Discount badge */}
      {showBadge && (
        <span style={{
          fontSize:     12,
          fontWeight:   700,
          color:        '#fff',
          background:   (s.badgeColor as string) ?? '#16a34a',
          borderRadius: 4,
          padding:      '2px 8px',
        }}>
          {discount}% OFF
        </span>
      )}
    </div>
  );
};

export default ProductPrice;
