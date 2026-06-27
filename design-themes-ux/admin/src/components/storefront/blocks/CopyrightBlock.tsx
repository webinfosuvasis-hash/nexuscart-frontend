import React from 'react';
import type { BlockRenderProps } from '../BlockRenderer';

const CopyrightBlock: React.FC<BlockRenderProps> = ({ block, storeName }) => {
  const { text = '© {{year}} {{store_name}}. All rights reserved.', textColor = '#9ca3af' } = block.settings;
  const resolved = text
    .replace(/\{\{year\}\}/g,       String(new Date().getFullYear()))
    .replace(/\{\{store_name\}\}/g, storeName);

  return (
    <p style={{ margin: 0, fontSize: 12, color: textColor, fontFamily: 'var(--nx-font-body)' }}>
      {resolved}
    </p>
  );
};

export default CopyrightBlock;
