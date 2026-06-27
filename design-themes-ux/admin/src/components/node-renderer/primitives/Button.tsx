import React from 'react';
import type { NodeProps } from '../types';
import { resolveFieldBinding } from '../bindingResolver';

const STYLE_MAP: Record<string, React.CSSProperties> = {
  primary:  { background: 'var(--nx-violet-600, #7C3AED)', color: '#fff', border: 'none' },
  outline:  { background: 'transparent', color: 'inherit', border: '2px solid currentColor' },
  ghost:    { background: 'transparent', color: 'inherit', border: 'none' },
  link:     { background: 'transparent', color: 'inherit', border: 'none', textDecoration: 'underline', padding: 0 },
  secondary:{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' },
};

const SIZE_MAP: Record<string, React.CSSProperties> = {
  sm: { padding: '6px 14px',  fontSize: 12, borderRadius: 6 },
  md: { padding: '10px 20px', fontSize: 14, borderRadius: 8 },
  lg: { padding: '14px 28px', fontSize: 16, borderRadius: 10 },
};

const Button: React.FC<NodeProps> = ({ node, ctx, style }) => {
  const s      = node.settings;
  const label  = String(resolveFieldBinding(s.label ?? 'Button', ctx));
  const href   = String(resolveFieldBinding(s.link  ?? s.href ?? '#', ctx));
  const variant = (s.style as string) ?? 'primary';
  const size    = (s.size  as string) ?? 'md';

  const btnStyle: React.CSSProperties = {
    display:    'inline-flex',
    alignItems: 'center',
    cursor:     'pointer',
    fontWeight: 600,
    transition: 'opacity 150ms',
    textDecoration: 'none',
    ...(STYLE_MAP[variant] ?? STYLE_MAP.primary),
    ...(SIZE_MAP[size]     ?? SIZE_MAP.md),
    ...style,
  };

  return (
    <a
      data-node-id={node.id}
      data-node-type="button"
      href={href}
      style={btnStyle}
    >
      {label}
    </a>
  );
};

export default Button;
