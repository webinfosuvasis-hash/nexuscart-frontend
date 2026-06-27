import React from 'react';
import type { BlockRenderProps } from '../BlockRenderer';

// Demo nav items — real menu data requires the Menu Builder (Sprint 9-10)
const DEMO_LINKS = ['Home', 'Catalog', 'Contact'];

const MenuBlock: React.FC<BlockRenderProps> = ({ block, themeConfig }) => {
  const { linkSize = 14 } = block.settings;
  const color = themeConfig.colors.text ?? '#1a1a1a';

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      {DEMO_LINKS.map((label) => (
        <a
          key={label}
          href={`/${label.toLowerCase()}`}
          style={{
            fontSize:       linkSize,
            fontWeight:     500,
            color,
            textDecoration: 'none',
            fontFamily:     'var(--nx-font-body)',
          }}
          onClick={(e) => e.preventDefault()}
        >
          {label}
        </a>
      ))}
    </nav>
  );
};

export default MenuBlock;
