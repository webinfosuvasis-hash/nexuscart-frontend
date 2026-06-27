import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { NodeProps } from '../types';
import { useProductPageOptional } from '@/contexts/ProductPageContext';

const Breadcrumb: React.FC<NodeProps> = ({ node, ctx, style }) => {
  const pdp = useProductPageOptional();
  const s   = node.settings;

  const sep   = (s.separator as string) ?? '/';
  const items: { label: string; href?: string }[] =
    pdp?.product
      ? [
          { label: 'Home', href: '/' },
          pdp.product.category ? { label: pdp.product.category, href: `/collections/${pdp.product.categoryId ?? 'all'}` } : null,
          { label: pdp.product.name },
        ].filter(Boolean) as { label: string; href?: string }[]
      : (s.items as { label: string; href?: string }[]) ?? [
          { label: 'Home', href: '/' },
          { label: 'Products', href: '/collections' },
          { label: ctx.isPreview ? 'Product Name' : '' },
        ];

  return (
    <nav
      data-node-id={node.id}
      data-node-type="breadcrumb"
      aria-label="Breadcrumb"
      style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, ...style }}
    >
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            sep === '/' || sep === '>'
              ? <ChevronRight size={12} style={{ color: '#9ca3af' }} />
              : <span style={{ color: '#9ca3af', fontSize: 13 }}>{sep}</span>
          )}
          {item.href && i < items.length - 1 ? (
            <a href={item.href} style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#1a1a1a')}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.color = '#6b7280')}>
              {item.label}
            </a>
          ) : (
            <span style={{ fontSize: 13, color: '#1a1a1a', fontWeight: i === items.length - 1 ? 500 : 400 }}>
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumb;
