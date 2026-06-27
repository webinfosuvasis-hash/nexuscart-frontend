import React from 'react';
import type { BlockRenderProps } from '../BlockRenderer';
import { ShoppingBag } from 'lucide-react';

const LogoBlock: React.FC<BlockRenderProps> = ({ block, themeConfig, storeName }) => {
  const { image, altText, width = 120 } = block.settings;
  const src = typeof image === 'string' ? image : image?.url;
  const primary = themeConfig.colors.primary ?? '#4f46e5';

  if (src) {
    return (
      <a href="/" style={{ display: 'inline-block' }}>
        <img src={src} alt={altText ?? storeName} style={{ height: 36, width: 'auto', maxWidth: width }} />
      </a>
    );
  }

  return (
    <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ShoppingBag size={15} color="#fff" />
      </div>
      <span style={{ fontWeight: 700, fontSize: 15, color: themeConfig.colors.text ?? '#1a1a1a', fontFamily: 'var(--nx-font-heading)' }}>
        {storeName}
      </span>
    </a>
  );
};

export default LogoBlock;
