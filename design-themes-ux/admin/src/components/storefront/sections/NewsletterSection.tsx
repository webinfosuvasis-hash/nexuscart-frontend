import React from 'react';
import type { SectionRenderProps } from '../SectionRenderer';
import BlockRenderer from '../BlockRenderer';
import { Mail } from 'lucide-react';
import { resolveColorScheme } from '../utils/colorSchemes';

/**
 * NewsletterSection — Sprint 5
 *
 * Renders a centered newsletter sign-up with heading + paragraph blocks
 * above a static email form (not wired to any provider in Sprint 5).
 */
const NewsletterSection: React.FC<SectionRenderProps> = ({ section, themeConfig, storeName }) => {
  const {
    placeholder  = 'Email address',
    buttonLabel  = 'Subscribe',
    spacing      = {},
  } = section.settings;
  // P0-7: apply color scheme to section background + text
  const scheme = resolveColorScheme(section.settings.colorScheme, themeConfig.colors);
  const bg     = scheme.bg;

  const pt = spacing.top    ? `${spacing.top}px`    : '64px';
  const pb = spacing.bottom ? `${spacing.bottom}px` : '64px';

  const textBlocks = section.blocks
    .filter((b) => b.isVisible && (b.type === 'heading' || b.type === 'paragraph'))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <section style={{ paddingTop: pt, paddingBottom: pb, paddingLeft: '24px', paddingRight: '24px', background: bg }}>
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
        {textBlocks.map((block) => (
          <BlockRenderer
            key={block.id}
            block={block}
            sectionId={section.id}
            sectionType={section.type}
            themeConfig={themeConfig}
            storeName={storeName}
          />
        ))}

        {/* Email form — Sprint 5: static, not wired */}
        <div style={{ display: 'flex', gap: 8, maxWidth: 420, margin: '24px auto 0', justifyContent: 'center' }}>
          <div style={{
            flex:         1,
            display:      'flex',
            alignItems:   'center',
            gap:          8,
            padding:      '0 14px',
            border:       '1px solid #e2e8f0',
            borderRadius: 8,
            background:   '#fff',
            height:       44,
          }}>
            <Mail size={14} color="#94a3b8" />
            <span style={{ fontSize: 13, color: '#94a3b8', fontFamily: 'var(--nx-font-body)' }}>{placeholder}</span>
          </div>
          <button style={{
            padding:      '0 20px',
            height:       44,
            background:   themeConfig.colors.primary ?? '#4f46e5',
            color:        '#fff',
            border:       'none',
            borderRadius: 8,
            fontSize:     13,
            fontWeight:   600,
            cursor:       'pointer',
            fontFamily:   'var(--nx-font-body)',
            whiteSpace:   'nowrap',
          }}>
            {buttonLabel}
          </button>
        </div>
      </div>
    </section>
  );
};

export default NewsletterSection;
