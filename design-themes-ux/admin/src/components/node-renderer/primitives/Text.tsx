/**
 * Text — plain paragraph / body copy node.
 *
 * Distinct from Heading (semantic h1–h6) and RichText (HTML content).
 * Text is a single-line or multi-line run of styled plain text.
 * It supports {{ binding }} interpolation via bindingResolver.
 */

import React from 'react';
import type { NodeProps } from '../types';
import { resolveFieldBinding } from '../bindingResolver';

const Text: React.FC<NodeProps> = ({ node, ctx, style }) => {
  const s     = node.settings;
  const text  = String(resolveFieldBinding(s.text ?? '', ctx));
  const Tag   = (s.inline === true ? 'span' : 'p') as 'p' | 'span';

  return (
    <Tag
      data-node-id={node.id}
      data-node-type="text"
      style={{ margin: 0, ...style }}
    >
      {text}
    </Tag>
  );
};

export default Text;
