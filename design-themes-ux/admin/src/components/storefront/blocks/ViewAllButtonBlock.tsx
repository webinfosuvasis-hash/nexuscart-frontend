import React from 'react';
import type { BlockRenderProps } from '../BlockRenderer';
import { ArrowRight } from 'lucide-react';

const ViewAllButtonBlock: React.FC<BlockRenderProps> = ({ block, themeConfig }) => {
  const { label = 'View all', link = '/collections', style = 'link' } = block.settings;
  const primary = themeConfig.colors.primary ?? '#4f46e5';

  if (style === 'outline') {
    return (
      <a href={link} onClick={(e) => e.preventDefault()}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 16px', border: `1px solid ${primary}`, borderRadius: 8, color: primary, fontSize: 13, fontWeight: 600, textDecoration: 'none', fontFamily: 'var(--nx-font-body)' }}>
        {label} <ArrowRight size={14} />
      </a>
    );
  }

  return (
    <a href={link} onClick={(e) => e.preventDefault()}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: themeConfig.colors.text ?? '#374151', fontSize: 13, fontWeight: 600, textDecoration: 'none', fontFamily: 'var(--nx-font-body)' }}>
      {label} <ArrowRight size={14} />
    </a>
  );
};

export default ViewAllButtonBlock;
