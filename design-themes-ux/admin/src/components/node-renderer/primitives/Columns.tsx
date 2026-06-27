import React from 'react';
import type { NodeProps, Breakpoint } from '../types';

/** Columns — explicit ratio columns using CSS grid fractions. */
const Columns: React.FC<NodeProps> = ({ node, ctx, style, children }) => {
  const s         = node.settings;
  const ratioStr  = String(s.ratios ?? '1,1');
  const fractions = ratioStr.split(',').map((n) => `${n.trim()}fr`).join(' ');
  const stackOn   = (s.stackOn as string) ?? 'mobile';
  const bp        = ctx.breakpoint as Breakpoint;
  const shouldStack =
    stackOn === 'never'  ? false :
    stackOn === 'tablet' ? (bp === 'mobile' || bp === 'tablet') :
    bp === 'mobile';

  const colStyle: React.CSSProperties = {
    display:             'grid',
    gridTemplateColumns: shouldStack ? '1fr' : fractions,
    gap:                 s.gap !== undefined ? `${s.gap}px` : '24px',
    ...style,
  };
  return (
    <div data-node-id={node.id} data-node-type="columns" style={colStyle}>
      {children}
    </div>
  );
};

export default Columns;
