/**
 * TemplateAnnouncementBarSection
 * Announcement bar rendered from a ThemePageSection (template section),
 * as opposed to the headerConfig zone-based AnnouncementBarSection.
 * Used when the merchant adds an announcement_bar to the template directly.
 */
import React from 'react';
import type { SectionRenderProps } from '../SectionRenderer';
import { toPlainText } from '@/utils/richText';

const TemplateAnnouncementBarSection: React.FC<SectionRenderProps> = ({ section, themeConfig }) => {
  const s        = section.settings;
  const bg       = (s.background as string) ?? (themeConfig.colors.primary ?? '#4f46e5');
  const textColor= (s.textColor  as string) ?? '#ffffff';
  const pt       = Number(s.paddingVertical ?? s.paddingTop    ?? 6);
  const pb       = Number(s.paddingVertical ?? s.paddingBottom ?? 6);

  // Get text from the first 'announcement' block
  const annBlock = section.blocks.find((b) => b.type === 'announcement');
  const text     = annBlock
    ? (toPlainText(annBlock.settings.text) || (annBlock.settings.text as string) || '')
    : (s.text as string) ?? '';

  const fontSize = Number(annBlock?.settings.fontSize ?? s.fontSize ?? 12);

  if (!text) return null;

  return (
    <div
      data-section-type="announcement_bar"
      style={{
        background:    bg,
        paddingTop:    pt,
        paddingBottom: pb,
        textAlign:     'center',
      }}
    >
      <p style={{ margin: 0, color: textColor, fontSize, fontWeight: 500 }}>
        {text}
      </p>
    </div>
  );
};

export default TemplateAnnouncementBarSection;
