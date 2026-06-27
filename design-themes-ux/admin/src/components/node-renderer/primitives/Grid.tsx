import React from 'react';
import type { NodeProps } from '../types';

/** Grid — CSS grid with configurable columns/rows/gap. */
const Grid: React.FC<NodeProps> = ({ node, style, children }) => {
  const s    = node.settings;
  const cols = Number(s.gridCols ?? 3);
  const gridStyle: React.CSSProperties = {
    display:             'grid',
    gridTemplateColumns: s.autoFit
      ? `repeat(auto-fit, minmax(${s.minColW ?? 200}px, 1fr))`
      : `repeat(${cols}, 1fr)`,
    gap:                 s.gap !== undefined ? `${s.gap}px` : '24px',
    ...style,
  };
  return (
    <div data-node-id={node.id} data-node-type="grid" style={gridStyle}>
      {children}
    </div>
  );
};

export default Grid;
