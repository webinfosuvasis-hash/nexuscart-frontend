import React from 'react';
import type { BlockRenderProps } from '../BlockRenderer';

const CollectionTitleBlock: React.FC<BlockRenderProps> = ({ block, themeConfig }) => {
  const { text = 'Products', textColor, alignment = 'left' } = block.settings;
  const color = textColor ?? themeConfig.colors.text ?? '#0f172a';

  return (
    <h2 style={{
      margin:     0,
      fontSize:   '1.5rem',
      fontWeight: 700,
      color,
      fontFamily: 'var(--nx-font-heading)',
      textAlign:  alignment,
    }}>
      {text}
    </h2>
  );
};

export default CollectionTitleBlock;
