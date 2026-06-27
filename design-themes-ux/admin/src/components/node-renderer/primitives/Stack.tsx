import React from 'react';
import type { NodeProps } from '../types';

/** Stack — flex col/row with uniform gap. Preset of Container. */
const Stack: React.FC<NodeProps> = ({ node, style, children }) => {
  const s = node.settings;
  const stackStyle: React.CSSProperties = {
    display:       'flex',
    flexDirection: (s.flexDir as any) ?? 'column',
    gap:           s.gap !== undefined ? `${s.gap}px` : '16px',
    alignItems:    (s.align as any) ?? 'stretch',
    ...style,
  };
  return (
    <div data-node-id={node.id} data-node-type="stack" style={stackStyle}>
      {children}
    </div>
  );
};

export default Stack;
