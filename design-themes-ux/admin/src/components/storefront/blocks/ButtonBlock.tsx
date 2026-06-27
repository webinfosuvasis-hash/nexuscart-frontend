import React from 'react';
import type { BlockRenderProps } from '../BlockRenderer';

const ButtonBlock: React.FC<BlockRenderProps> = ({ block, themeConfig }) => {
  const {
    label        = 'Shop now',
    link,
    style        = 'primary',
    size         = 'md',
    fullWidth    = false,
    borderRadius = 'rounded',
    openNewTab   = false,
    padding      = {},
  } = block.settings;

  const primary = themeConfig.colors.primary ?? '#4f46e5';

  const sizeMap = {
    sm: { px: '16px', py: '8px',  fs: '12px' },
    md: { px: '24px', py: '12px', fs: '14px' },
    lg: { px: '32px', py: '16px', fs: '16px' },
  };
  const sz  = sizeMap[size as keyof typeof sizeMap] ?? sizeMap.md;

  const radMap = { pill: '999px', rounded: '8px', square: '0' };
  const rad    = radMap[borderRadius as keyof typeof radMap] ?? '8px';

  const baseStyle: React.CSSProperties = {
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    paddingTop:     sz.py,
    paddingBottom:  sz.py,
    paddingLeft:    sz.px,
    paddingRight:   sz.px,
    fontSize:       sz.fs,
    fontWeight:     600,
    fontFamily:     'var(--nx-font-body, Inter, sans-serif)',
    borderRadius:   rad,
    cursor:         'pointer',
    textDecoration: 'none',
    transition:     'opacity 0.15s',
    width:          fullWidth ? '100%' : undefined,
  };

  const styleMap: Record<string, React.CSSProperties> = {
    primary:   { background: primary, color: '#fff', border: 'none' },
    secondary: { background: 'rgba(255,255,255,0.15)', color: '#fff', backdropFilter: 'blur(4px)', border: 'none' },
    outline:   { background: 'transparent', color: '#fff', border: '2px solid #fff' },
    link:      { background: 'transparent', color: primary, textDecoration: 'underline', padding: 0 },
  };

  const combinedStyle = { ...baseStyle, ...(styleMap[style] ?? styleMap.primary) };

  // Use <a> when a link is provided (real navigation intent)
  // In preview mode, clicks are intercepted by PreviewEditorBridge — safe to keep href
  const element = link ? (
    <a
      href={link}
      target={openNewTab ? '_blank' : '_self'}
      rel={openNewTab ? 'noopener noreferrer' : undefined}
      style={combinedStyle}
      onClick={(e) => e.preventDefault()}  // prevented in preview; real storefront won't have this
    >
      {label}
    </a>
  ) : (
    <button style={{ ...combinedStyle, border: combinedStyle.border ?? 'none' }}>
      {label}
    </button>
  );

  // Block-level padding wraps the button (spacing around, not inside the element)
  const hasWrapPadding = padding.top || padding.bottom || padding.left || padding.right;
  if (!hasWrapPadding) return element;

  return (
    <div style={{
      paddingTop:    padding.top    ? `${padding.top}px`    : undefined,
      paddingBottom: padding.bottom ? `${padding.bottom}px` : undefined,
      paddingLeft:   padding.left   ? `${padding.left}px`   : undefined,
      paddingRight:  padding.right  ? `${padding.right}px`  : undefined,
      display:       fullWidth ? 'block' : 'inline-block',
    }}>
      {element}
    </div>
  );
};

export default ButtonBlock;
