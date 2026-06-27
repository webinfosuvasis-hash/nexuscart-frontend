import React from 'react';
import type { BlockInstance } from '@/services/storefrontService';

// ─── Block component interface ────────────────────────────────────────────────

export interface BlockRenderProps {
  block:        BlockInstance;
  sectionId:    string;
  sectionType:  string;
  themeConfig:  { colors: Record<string, string>; typography: Record<string, any>; layout: Record<string, any> };
  storeName:    string;
}

// ─── Lazy imports — each block is its own module ─────────────────────────────
// Importing inline (not lazy) to keep the preview bundle self-contained
// and avoid flash-of-missing-content during loading.

import HeadingBlock        from './blocks/HeadingBlock';
import ParagraphBlock      from './blocks/ParagraphBlock';
import ButtonBlock         from './blocks/ButtonBlock';
import ImageBlock          from './blocks/ImageBlock';
import LogoBlock           from './blocks/LogoBlock';
import MenuBlock           from './blocks/MenuBlock';
import ProductCardBlock    from './blocks/ProductCardBlock';
import CollectionTitleBlock from './blocks/CollectionTitleBlock';
import ViewAllButtonBlock  from './blocks/ViewAllButtonBlock';
import CopyrightBlock      from './blocks/CopyrightBlock';
import GenericBlock        from './blocks/GenericBlock';

// ─── Block registry ───────────────────────────────────────────────────────────

const BLOCK_REGISTRY: Record<string, React.ComponentType<BlockRenderProps>> = {
  heading:          HeadingBlock,
  paragraph:        ParagraphBlock,
  text:             ParagraphBlock,    // alias
  button:           ButtonBlock,
  image:            ImageBlock,
  logo:             LogoBlock,
  menu:             MenuBlock,
  product_card:     ProductCardBlock,
  collection_title: CollectionTitleBlock,
  view_all_button:  ViewAllButtonBlock,
  copyright:        CopyrightBlock,
};

// ─── BlockRenderer ────────────────────────────────────────────────────────────

interface BlockRendererProps {
  block:        BlockInstance;
  sectionId:    string;
  sectionType:  string;
  themeConfig:  BlockRenderProps['themeConfig'];
  storeName:    string;
}

/**
 * BlockRenderer — Sprint 5
 *
 * Looks up the correct block component from BLOCK_REGISTRY and renders it
 * wrapped with `data-nexuscart-block` and `data-block-type` attributes.
 *
 * These attributes are required for the PreviewEditorBridge (Sprint 7-8)
 * to calculate bounding boxes and identify clicked elements in the canvas.
 *
 * Invisible blocks are rendered as `display: contents` so they still
 * contribute to the DOM (bounding boxes exist) but are not visible.
 */
const BlockRenderer: React.FC<BlockRendererProps> = ({
  block, sectionId, sectionType, themeConfig, storeName,
}) => {
  if (!block.isVisible) return null;

  const BlockComponent = BLOCK_REGISTRY[block.type] ?? GenericBlock;
  const props: BlockRenderProps = { block, sectionId, sectionType, themeConfig, storeName };

  return (
    <div
      data-nexuscart-block={block.id}
      data-block-type={block.type}
      data-block-section={sectionId}
      style={{ position: 'relative' }}
    >
      <BlockComponent {...props} />
    </div>
  );
};

export { BLOCK_REGISTRY };
export default BlockRenderer;
