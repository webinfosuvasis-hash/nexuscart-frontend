/**
 * Unknown — fallback for unregistered node types.
 * Production: renders nothing (never crashes the page).
 * Preview:    shows a visible amber chip so developers notice.
 */

import React from 'react';
import type { NodeProps } from '../types';

const Unknown: React.FC<NodeProps> = ({ node, ctx }) => {
  if (!ctx.isPreview) return null;
  return (
    <div
      data-node-id={node.id}
      data-node-type={`unknown:${node.type}`}
      style={{
        padding:      '8px 12px',
        margin:       '4px 0',
        border:       '1.5px dashed #F59E0B',
        borderRadius: 6,
        background:   'rgba(245,158,11,0.06)',
        fontSize:     11,
        color:        '#F59E0B',
        fontFamily:   'JetBrains Mono, monospace',
      }}
    >
      Unknown primitive: <strong>{node.type}</strong>
      {' '}<span style={{ opacity: 0.6 }}>(id: {node.id})</span>
    </div>
  );
};

export default Unknown;
