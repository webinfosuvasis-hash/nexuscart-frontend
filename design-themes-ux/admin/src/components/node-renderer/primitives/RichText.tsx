import React from 'react';
import type { NodeProps } from '../types';
import { resolveFieldBinding } from '../bindingResolver';

const RichText: React.FC<NodeProps> = ({ node, ctx, style }) => {
  const html = String(resolveFieldBinding(node.settings.html ?? node.settings.text ?? '', ctx));
  return (
    <div
      data-node-id={node.id}
      data-node-type="richtext"
      style={style}
      className="nx-richtext"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default RichText;
