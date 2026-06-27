import React from 'react';
import type { BlockRenderProps } from '../BlockRenderer';
import { renderRichText } from '@/utils/richText';

const TAG_MAP: Record<string, keyof JSX.IntrinsicElements> = {
  h1: 'h1', h2: 'h2', h3: 'h3', subheading: 'h4',
};

const SIZE_MAP: Record<string, string> = {
  h1: '2.75rem', h2: '2rem', h3: '1.5rem', subheading: '1.125rem',
};

const HeadingBlock: React.FC<BlockRenderProps> = ({ block, themeConfig }) => {
  const {
    text             = 'Heading',
    typographyPreset = 'h2',
    textColor,
    width            = 'fit',
    maxWidth         = 'normal',
    padding          = {},
    background       = false,
    bgColor          = '#000000',
  } = block.settings;

  const Tag      = TAG_MAP[typographyPreset] ?? 'h2';
  const fontSize = SIZE_MAP[typographyPreset] ?? '2rem';
  const color    = textColor ?? themeConfig.colors.text ?? '#1a1a1a';

  const maxWMap = { narrow: 480, normal: 720, wide: 960 };
  const mw      = width === 'fill' ? '100%' : `${maxWMap[maxWidth as keyof typeof maxWMap] ?? 720}px`;

  // renderRichText handles both TiptapDoc (JSON) and legacy HTML strings.
  // Inline mode strips the outer <p> wrapper so content is valid inside the Tag.
  const html = renderRichText(text, 'inline');

  return (
    <Tag
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        margin:        0,
        fontSize,
        fontWeight:    700,
        color,
        fontFamily:    'var(--nx-font-heading, Inter, sans-serif)',
        lineHeight:    1.2,
        maxWidth:      mw,
        background:    background ? bgColor : undefined,
        paddingTop:    padding.top    ? `${padding.top}px`    : undefined,
        paddingBottom: padding.bottom ? `${padding.bottom}px` : undefined,
        paddingLeft:   (background && !padding.left)  ? '12px' : padding.left  ? `${padding.left}px`  : undefined,
        paddingRight:  (background && !padding.right) ? '12px' : padding.right ? `${padding.right}px` : undefined,
        borderRadius:  background ? 4 : undefined,
        display:       'block',
      }}
    />
  );
};

export default HeadingBlock;
