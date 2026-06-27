import React from 'react';
import { renderRichText } from '@/utils/richText';

interface Zone {
  id:            string;
  components:    Array<{ id: string; type: string; settings: Record<string, any> }>;
  background?:   string;
  textColor?:    string;    // P0-9: zone-level text color fallback
  visibility?:   string;
  showOnMobile?: boolean;   // P1-D
  paddingTop?:    number;
  paddingBottom?: number;
}

interface Props {
  zone:        Zone;
  themeColors: Record<string, string>;
}

const AnnouncementBarSection: React.FC<Props> = ({ zone, themeColors }) => {
  if (zone.visibility === 'hidden') return null;

  const bg      = (!zone.background || zone.background === 'transparent')
    ? (themeColors.primary ?? '#4f46e5')
    : zone.background;

  const ptop    = zone.paddingTop    ?? 6;
  const pbottom = zone.paddingBottom ?? 6;

  // P1-D: showOnMobile=false hides the bar on small screens
  const showOnMobile = zone.showOnMobile !== false;

  return (
    <div
      data-nexuscart-section={`zone-${zone.id}`}
      data-section-type="announcement_bar"
      style={{
        background:    bg,
        paddingTop:    ptop,
        paddingBottom: pbottom,
        position:      'relative',
        display:       'block',
      }}
    >
      {/* P1-D: hide on mobile via inline style */}
      {!showOnMobile && (
        <style>{`@media (max-width: 640px) { [data-section-type="announcement_bar"] { display: none !important; } }`}</style>
      )}

      <div style={{ textAlign: 'center', maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
        {zone.components.map((comp) => {
          if (comp.type !== 'announcement') return null;

          const {
            text          = 'Welcome to our store',
            link,
            fontSize      = 12,
            fontWeight    = '400',
            letterSpacing = 'normal',
            textCase      = 'none',
            // P0-3: font setting (heading / subheading / body)
            font          = 'subheading',
          } = comp.settings;

          // P0-9: block textColor → zone textColor fallback → white
          const textColor = comp.settings.textColor ?? zone.textColor ?? '#ffffff';

          // P0-3: map font setting to CSS variable
          const fontFamily = font === 'heading'
            ? 'var(--nx-font-heading, Inter, sans-serif)'
            : 'var(--nx-font-body, Inter, sans-serif)';

          const lsMap: Record<string, string> = {
            tight:  '-0.03em',
            normal: '0',
            loose:  '0.06em',
          };

          const content = (
            <span
              key={comp.id}
              data-nexuscart-block={comp.id}
              data-block-type="announcement"
              dangerouslySetInnerHTML={{ __html: renderRichText(text, 'inline') }}
              style={{
                color:         textColor,
                fontSize,
                fontWeight,
                fontFamily,
                letterSpacing: lsMap[letterSpacing] ?? '0',
                textTransform: textCase === 'uppercase' ? 'uppercase' : 'none',
              }}
            />
          );

          return link
            ? <a key={comp.id} href={link} style={{ textDecoration: 'none' }}>{content}</a>
            : content;
        })}
      </div>
    </div>
  );
};

export default AnnouncementBarSection;
