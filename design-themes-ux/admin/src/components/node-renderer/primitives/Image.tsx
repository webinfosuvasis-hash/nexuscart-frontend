import React from 'react';
import type { NodeProps } from '../types';
import { resolveFieldBinding } from '../bindingResolver';

const Image: React.FC<NodeProps> = ({ node, ctx, style }) => {
  const s   = node.settings;
  const src = String(resolveFieldBinding(s.src ?? s.url ?? '', ctx));
  const alt = String(resolveFieldBinding(s.alt ?? s.altText ?? '', ctx));

  if (!src) {
    // Placeholder in preview; invisible in production
    if (!ctx.isPreview) return null;
    return (
      <div data-node-id={node.id} data-node-type="image"
        style={{ background: 'rgba(255,255,255,0.05)', aspectRatio: '16/9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#6B6B80', fontSize: 12, borderRadius: 4, ...style }}>
        Image
      </div>
    );
  }

  return (
    <img
      data-node-id={node.id}
      data-node-type="image"
      src={src}
      alt={alt}
      loading="lazy"
      style={{
        display:   'block',
        maxWidth:  '100%',
        height:    'auto',
        objectFit: (s.fit as any) ?? 'cover',
        ...style,
      }}
    />
  );
};

export default Image;
