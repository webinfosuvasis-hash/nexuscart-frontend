import React from 'react';
import type { BlockRenderProps } from '../BlockRenderer';

const ASPECT_RATIO_MAP: Record<string, string | undefined> = {
  'natural': undefined,
  '1/1':    '1 / 1',
  '3/4':    '3 / 4',
  '4/3':    '4 / 3',
  '16/9':   '16 / 9',
};

const WIDTH_MAP: Record<string, string> = {
  sm:   '240px',
  md:   '480px',
  lg:   '720px',
  full: '100%',
};

const ImageBlock: React.FC<BlockRenderProps> = ({ block }) => {
  const {
    image,
    altText      = '',
    aspectRatio  = 'natural',
    width        = 'full',
    borderRadius = 0,
    link,
    padding      = {},
  } = block.settings;

  const src = typeof image === 'string' ? image : (image as any)?.url;
  if (!src) return null;

  const maxW = WIDTH_MAP[width] ?? '100%';
  const ar   = ASPECT_RATIO_MAP[aspectRatio];

  const img = (
    <img
      src={src}
      alt={altText}
      loading="lazy"
      style={{
        width:        '100%',
        height:       ar ? undefined : 'auto',
        display:      'block',
        borderRadius: borderRadius ? `${borderRadius}px` : undefined,
        aspectRatio:  ar,
        objectFit:    ar ? 'cover' : undefined,
      }}
    />
  );

  return (
    <div style={{
      maxWidth:      maxW,
      paddingTop:    padding.top    ? `${padding.top}px`    : undefined,
      paddingBottom: padding.bottom ? `${padding.bottom}px` : undefined,
    }}>
      {link ? <a href={link} onClick={(e) => e.preventDefault()} style={{ display: 'block' }}>{img}</a> : img}
    </div>
  );
};

export default ImageBlock;
