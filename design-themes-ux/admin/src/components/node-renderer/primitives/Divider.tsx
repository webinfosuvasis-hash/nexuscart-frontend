import React from 'react';
import type { NodeProps } from '../types';

const Divider: React.FC<NodeProps> = ({ node }) => {
  const s  = node.settings;
  const mt = Number(s.mt ?? 16);
  const mb = Number(s.mb ?? 16);
  return (
    <div data-node-id={node.id} data-node-type="divider"
      style={{ paddingTop: mt, paddingBottom: mb }}>
      <hr style={{
        border:    'none',
        borderTop: `${s.bw ?? 1}px ${s.bs ?? 'solid'} ${s.bc ?? '#e5e7eb'}`,
        opacity:   s.opacity !== undefined ? Number(s.opacity) / 100 : 1,
        margin:    0,
      }} />
    </div>
  );
};

export default Divider;
