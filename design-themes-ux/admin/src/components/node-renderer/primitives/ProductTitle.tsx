import React from 'react';
import type { NodeProps } from '../types';
import { useProductPageOptional } from '@/contexts/ProductPageContext';
import { resolveFieldBinding } from '../bindingResolver';

const ProductTitle: React.FC<NodeProps> = ({ node, ctx, style }) => {
  const pdp  = useProductPageOptional();
  const s    = node.settings;
  const name = pdp?.product.name
    ?? String(resolveFieldBinding(s.text ?? '{{ product.name }}', ctx));

  const Tag = ((s.level as string) ?? 'h1') as keyof JSX.IntrinsicElements;

  return (
    <Tag
      data-node-id={node.id}
      data-node-type="product_title"
      style={{ margin: 0, lineHeight: 1.25, fontWeight: 700, ...style }}
    >
      {name || (ctx.isPreview ? 'Product Name' : '')}
    </Tag>
  );
};

export default ProductTitle;
