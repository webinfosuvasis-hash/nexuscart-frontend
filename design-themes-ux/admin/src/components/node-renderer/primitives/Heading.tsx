import React from 'react';
import type { NodeProps } from '../types';
import { resolveFieldBinding } from '../bindingResolver';

const TAG_MAP: Record<string, keyof JSX.IntrinsicElements> = {
  h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6',
};

const Heading: React.FC<NodeProps> = ({ node, ctx, style }) => {
  const s   = node.settings;
  const tag = TAG_MAP[(s.level as string)?.toLowerCase() ?? ''] ?? 'h2';
  const Tag = tag as keyof JSX.IntrinsicElements;
  const text = String(resolveFieldBinding(s.text ?? '', ctx));

  return (
    <Tag
      data-node-id={node.id}
      data-node-type="heading"
      style={style}
      dangerouslySetInnerHTML={{ __html: text }}
    />
  );
};

export default Heading;
