import React from 'react';
import type { SectionRenderProps } from '../SectionRenderer';
import BlockRenderer from '../BlockRenderer';

/**
 * GenericSection — Sprint 5
 *
 * Fallback for section types that don't have a dedicated component.
 * Renders blocks in a centered column using default layout.
 */
const GenericSection: React.FC<SectionRenderProps> = ({ section, themeConfig, storeName }) => {
  const { spacing = {} } = section.settings;
  const pt = spacing.top ?? 40;
  const pb = spacing.bottom ?? 40;

  return (
    <section style={{
      paddingTop:    pt,
      paddingBottom: pb,
      background:    themeConfig.colors.background ?? '#fff',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
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

export default GenericSection;
