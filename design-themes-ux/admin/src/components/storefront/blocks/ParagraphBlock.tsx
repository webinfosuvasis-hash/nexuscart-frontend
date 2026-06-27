import React from 'react';
import type { BlockRenderProps } from '../BlockRenderer';
import { renderRichText } from '@/utils/richText';

const ParagraphBlock: React.FC<BlockRenderProps> = ({ block, themeConfig }) => {
  const { text = '', textColor, textSize = 'md', padding = {} } = block.settings;

  const color    = textColor ?? themeConfig.colors.text ?? '#374151';
  const sizeMap  = { sm: '0.875rem', md: '1rem', lg: '1.125rem' };
  const fontSize = sizeMap[textSize as keyof typeof sizeMap] ?? '1rem';

  // Block mode preserves headings, lists, and paragraph structure from the doc.
  // <div> is used instead of <p> because block-mode content can contain block
  // elements (h1-h3, ul, ol) which are not valid inside <p>.
  const html = renderRichText(text, 'block');

  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        margin:        0,
        fontSize,
        color,
        lineHeight:    1.7,
        fontFamily:    'var(--nx-font-body, Inter, sans-serif)',
        paddingTop:    padding.top    ? `${padding.top}px`    : undefined,
        paddingBottom: padding.bottom ? `${padding.bottom}px` : undefined,
      }}
    />
  );
};

export default ParagraphBlock;
