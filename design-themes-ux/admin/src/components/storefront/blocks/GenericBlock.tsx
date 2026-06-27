import React from 'react';
import type { BlockRenderProps } from '../BlockRenderer';

/**
 * GenericBlock — Sprint 5
 *
 * Fallback for block types that don't have a dedicated component.
 * Shows the block type name as a placeholder chip so developers can identify
 * unmapped blocks without a hard crash.
 */
const GenericBlock: React.FC<BlockRenderProps> = ({ block }) => (
  <div style={{
    display:      'inline-flex',
    alignItems:   'center',
    gap:          6,
    padding:      '4px 10px',
    borderRadius: 6,
    background:   '#f1f5f9',
    border:       '1px dashed #cbd5e1',
    fontSize:     11,
    color:        '#64748b',
    fontFamily:   'monospace',
  }}>
    <span style={{ opacity: 0.5 }}>block:</span> {block.type}
  </div>
);

export default GenericBlock;
