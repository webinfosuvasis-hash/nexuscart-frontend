import React from 'react';
import type { SectionRenderProps } from '../SectionRenderer';
import BlockRenderer from '../BlockRenderer';

const HEIGHT_MAP: Record<string, string> = {
  auto: 'auto',
  sm:   '400px',
  md:   '520px',
  lg:   '680px',
  full: '100vh',
};

const ALIGN_MAP: Record<string, React.CSSProperties> = {
  left:   { alignItems: 'flex-start', textAlign: 'left'   },
  center: { alignItems: 'center',     textAlign: 'center' },
  right:  { alignItems: 'flex-end',   textAlign: 'right'  },
};

/**
 * HeroSection — Sprint 5
 *
 * Renders a full-width hero with background image/color, overlay, and
 * blocks (heading, paragraph, button) stacked vertically.
 */
const HeroSection: React.FC<SectionRenderProps> = ({ section, themeConfig, storeName }) => {
  const {
    backgroundImage,
    backgroundColor   = themeConfig.colors.primary ?? '#1a1a2e',
    overlayOpacity    = 40,
    overlayColor      = '#000000',
    height            = 'md',
    contentAlignment  = 'center',
    contentWidth      = 'normal',
    spacing           = {},
  } = section.settings;

  const minH = HEIGHT_MAP[height] ?? '520px';
  const align = ALIGN_MAP[contentAlignment] ?? ALIGN_MAP.center;

  const contentMaxW: Record<string, number> = { narrow: 480, normal: 720, wide: 960 };
  const maxW = contentMaxW[contentWidth] ?? 720;

  const overlayAlpha = Math.round(((overlayOpacity as number) / 100) * 255)
    .toString(16)
    .padStart(2, '0');

  return (
    <section
      style={{
        position:      'relative',
        minHeight:     minH,
        display:       'flex',
        alignItems:    'center',
        justifyContent: contentAlignment === 'right' ? 'flex-end'
          : contentAlignment === 'left'   ? 'flex-start'
          : 'center',
        overflow:      'hidden',
        background:    backgroundColor,
        // spacing.top/bottom — section-level margin from settings
        marginTop:     spacing.top    ? `${spacing.top}px`    : undefined,
        marginBottom:  spacing.bottom ? `${spacing.bottom}px` : undefined,
      }}
    >
      {/* Background image */}
      {backgroundImage && (
        <div style={{
          position:           'absolute', inset: 0,
          backgroundImage:    `url(${backgroundImage})`,
          backgroundSize:     'cover',
          backgroundPosition: 'center',
        }} />
      )}

      {/* Overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: backgroundImage
          ? `${overlayColor}${overlayAlpha}`
          : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      }} />

      {/* Content */}
      <div style={{
        position:  'relative',
        zIndex:    1,
        width:     '100%',
        maxWidth:  maxW,
        padding:   '40px 24px',
        display:   'flex',
        flexDirection: 'column',
        gap:       16,
        ...align,
      }}>
        {section.blocks
          .filter((b) => b.isVisible)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((block) => (
            <BlockRenderer
              key={block.id}
              block={block}
              sectionId={section.id}
              sectionType={section.type}
              themeConfig={themeConfig}
              storeName={storeName}
            />
          ))}
      </div>
    </section>
  );
};

export default HeroSection;
