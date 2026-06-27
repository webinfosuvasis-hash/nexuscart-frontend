/**
 * ProductGallery — P6
 * Main image + thumbnail strip + hover zoom.
 * Reads product images from ProductPageContext.
 */
import React, { useState } from 'react';
import { ZoomIn } from 'lucide-react';
import type { NodeProps } from '../types';
import { useProductPageOptional } from '@/contexts/ProductPageContext';

const ProductGallery: React.FC<NodeProps> = ({ node, ctx, style }) => {
  const pdp = useProductPageOptional();
  const s   = node.settings;

  // Determine images: from context (real product) or from settings (static config)
  const images: string[] = pdp
    ? [pdp.effectiveImage, ...(pdp.product.images ?? []).filter(img => img !== pdp.effectiveImage)]
    : ((s.images as string[]) ?? []);

  const [active,   setActive]   = useState(0);
  const [zoomed,   setZoomed]   = useState(false);
  const [zoomPos,  setZoomPos]  = useState({ x: 50, y: 50 });

  const showZoom      = s.showZoom !== false;
  const thumbPosition = (s.thumbPosition as string) ?? 'bottom'; // 'bottom' | 'left'
  const imageRatio    = (s.imageRatio  as string) ?? '1/1';
  const isLeft        = thumbPosition === 'left';

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!showZoom) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width)  * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    setZoomPos({ x, y });
  };

  const currentImg = images[active];

  if (images.length === 0) {
    return (
      <div data-node-id={node.id} data-node-type="product_gallery" style={style}>
        <div style={{ aspectRatio: imageRatio, background: '#f3f4f6', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#9ca3af', fontSize: 13 }}>
          {ctx.isPreview ? 'No product images' : ''}
        </div>
      </div>
    );
  }

  return (
    <div
      data-node-id={node.id}
      data-node-type="product_gallery"
      style={{ display: 'flex', flexDirection: isLeft ? 'row' : 'column', gap: 12, ...style }}
    >
      {/* Thumbnails — left or bottom */}
      {images.length > 1 && (
        <div style={{
          display:       'flex',
          flexDirection: isLeft ? 'column' : 'row',
          gap:           8,
          order:         isLeft ? 0 : 2,
          flexShrink:    0,
          overflowX:     isLeft ? 'visible' : 'auto',
          overflowY:     isLeft ? 'auto'    : 'visible',
          maxHeight:     isLeft ? 480 : 'none',
        }}>
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              style={{
                width:        isLeft ? 72 : 64,
                height:       isLeft ? 72 : 64,
                borderRadius: 6,
                overflow:     'hidden',
                border:       i === active ? '2px solid #1a1a1a' : '2px solid transparent',
                padding:      0,
                cursor:       'pointer',
                flexShrink:   0,
                background:   '#f3f4f6',
              }}
            >
              <img
                src={img}
                alt={`View ${i + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* Main image */}
      <div
        style={{ flex: 1, position: 'relative', cursor: showZoom ? 'zoom-in' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setZoomed(true)}
        onMouseLeave={() => setZoomed(false)}
      >
        <div style={{ aspectRatio: imageRatio, overflow: 'hidden', borderRadius: 8, background: '#f9fafb' }}>
          <img
            src={currentImg}
            alt={pdp?.product.name ?? 'Product'}
            style={{
              width:         '100%',
              height:        '100%',
              objectFit:     'cover',
              transition:    'transform 300ms ease',
              transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
              transform:     zoomed && showZoom ? 'scale(1.8)' : 'scale(1)',
            }}
          />
        </div>
        {showZoom && !zoomed && (
          <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.4)',
            borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ZoomIn size={15} style={{ color: '#fff' }} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductGallery;
