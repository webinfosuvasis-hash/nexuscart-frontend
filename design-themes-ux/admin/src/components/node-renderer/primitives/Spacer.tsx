import React from 'react';
import type { NodeProps } from '../types';

const Spacer: React.FC<NodeProps> = ({ node, style }) => (
  <div
    data-node-id={node.id}
    data-node-type="spacer"
    aria-hidden="true"
    style={{ width: '100%', flexShrink: 0, height: `${node.settings.h ?? 48}px`, ...style }}
  />
);

export default Spacer;
