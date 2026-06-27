import React from 'react';
import type { BlockRenderProps } from '../BlockRenderer';

/**
 * ProductCardBlock — Sprint 5
 *
 * This block configures card APPEARANCE (image ratio, hover effect, etc.).
 * It does not render a card itself — the FeaturedCollectionSection reads
 * these settings and applies them to each ProductCard it renders.
 *
 * In the inspector, selecting this block shows card appearance settings.
 * In the preview, the block is not directly visible (its settings propagate
 * to the parent section's product grid rendering).
 */
const ProductCardBlock: React.FC<BlockRenderProps> = () => {
  // Intentionally renders nothing — settings consumed by parent FeaturedCollectionSection
  return null;
};

export default ProductCardBlock;
