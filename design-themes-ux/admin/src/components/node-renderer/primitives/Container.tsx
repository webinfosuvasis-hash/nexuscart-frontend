import React from 'react';
import type { NodeProps } from '../types';

/** Container — full-featured wrapper. Default display: block. */
const Container: React.FC<NodeProps> = ({ node, style, children }) => (
  <div
    data-node-id={node.id}
    data-node-type="container"
    style={{ display: 'block', ...style }}
  >
    {children}
  </div>
);

export default Container;
