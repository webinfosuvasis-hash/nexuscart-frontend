import React from 'react';
import { ShoppingBag } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FooterColumn {
  id:           string;
  title:        string;
  widthPercent: number;
  widgets:      Array<{ id: string; type: string; settings: Record<string, any> }>;
}

interface BottomBar {
  backgroundColor?: string;
  components?:      Array<{ id: string; type: string; settings: Record<string, any> }>;
}

interface FooterSettings {
  topBackground?:  string;
  divider?:        boolean;
  dividerColor?:   string;
  paddingTop?:     number;
  paddingBottom?:  number;
  showBottomBar?:  boolean;
  bottomBarBg?:    string;
  topBorder?:      boolean;
}

interface MenuItem {
  id:    string;
  label: string;
  url:   string;
}

interface Props {
  columns:     FooterColumn[];
  bottomBar:   BottomBar;
  settings:    FooterSettings;
  themeColors: Record<string, string>;
  storeName:   string;
  logoUrl?:    string | null;
  /** Menu items keyed by handle — same map used by the header */
  menus?:      Record<string, MenuItem[]>;
}

// ─── Shared link style ────────────────────────────────────────────────────────

const linkStyle: React.CSSProperties = {
  display: 'block',
  color: '#9ca3af',
  fontSize: 12,
  marginBottom: 6,
  textDecoration: 'none',
  cursor: 'pointer',
  lineHeight: 1.5,
};

// ─── Widget renderer ──────────────────────────────────────────────────────────

function WidgetRenderer({
  widget,
  themeColors,
  storeName,
  menus,
}: {
  widget:      FooterColumn['widgets'][0];
  themeColors: Record<string, string>;
  storeName:   string;
  menus?:      Record<string, MenuItem[]>;
}) {
  const s = widget.settings;

  switch (widget.type) {

    case 'brand_block':
      return (
        <div data-nexuscart-block={widget.id} data-block-type="brand_block" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: themeColors.accent ?? '#f59e0b',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShoppingBag size={14} color="#fff" />
            </div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'var(--nx-font-heading)' }}>
              {storeName}
            </span>
          </div>
          {s.tagline && (
            <p style={{ color: '#9ca3af', fontSize: 12, margin: '0 0 12px', lineHeight: 1.6 }}>
              {s.tagline}
            </p>
          )}
        </div>
      );

    case 'nav_column': {
      /**
       * Link resolution order:
       *   1. menus[s.menuHandle] — DB menu items (preferred)
       *   2. s.links             — manually configured link array
       *   3. empty state         — never falls back to hardcoded demo links
       */
      let items: MenuItem[] = [];
      if (s.menuHandle && menus?.[s.menuHandle]) {
        items = menus[s.menuHandle];
      } else if (Array.isArray(s.links)) {
        items = s.links;
      }

      return (
        <div data-nexuscart-block={widget.id} data-block-type="nav_column">
          {s.title && (
            <p style={{
              color: '#fff', fontSize: 12, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              margin: '0 0 10px',
            }}>
              {s.title}
            </p>
          )}
          {items.length === 0 ? (
            // Configured empty state — no demo links ever shown
            <p style={{ color: '#6b7280', fontSize: 11, fontStyle: 'italic', margin: 0 }}>
              No links configured
            </p>
          ) : (
            items.map((item) => (
              <a
                key={item.id ?? item.url}
                href={item.url ?? '#'}
                style={linkStyle}
              >
                {item.label}
              </a>
            ))
          )}
        </div>
      );
    }

    // DEFAULT_COLUMNS uses type 'newsletter' (not 'newsletter_form') — handle both
    case 'newsletter':
    case 'newsletter_form':
      return (
        <div data-nexuscart-block={widget.id} data-block-type="newsletter_form">
          {s.heading && (
            <p style={{ color: '#fff', fontSize: 12, fontWeight: 600, margin: '0 0 8px' }}>
              {s.heading}
            </p>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{
              flex: 1, background: '#374151', borderRadius: 6,
              padding: '6px 10px', fontSize: 11, color: '#6b7280',
            }}>
              {s.placeholder ?? 'Email address'}
            </div>
            <button style={{
              padding: '6px 12px',
              background: themeColors.accent ?? '#f59e0b',
              color: '#fff', border: 'none', borderRadius: 6,
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}>
              {s.buttonLabel ?? 'Subscribe'}
            </button>
          </div>
        </div>
      );

    case 'payment_badges':
      return (
        <div data-nexuscart-block={widget.id} data-block-type="payment_badges"
          style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['V', 'MC', 'PP', 'GP', 'AP'].map((p) => (
            <div key={p} style={{
              padding: '3px 8px',
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 4, color: '#9ca3af', fontSize: 9, fontWeight: 700,
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              {p}
            </div>
          ))}
        </div>
      );

    case 'copyright':
      return (
        <span data-nexuscart-block={widget.id} data-block-type="copyright"
          style={{ color: s.textColor ?? '#9ca3af', fontSize: 11 }}>
          {(s.text ?? '© {{year}} {{store_name}}')
            .replace('{{year}}', String(new Date().getFullYear()))
            .replace('{{store_name}}', storeName)}
        </span>
      );

    case 'legal_links': {
      /**
       * Link resolution:
       *   s.links  — array of { label: string; url?: string } configured by merchant
       *   Empty state shown when s.links is absent or empty — never hardcoded fallback.
       */
      const links: Array<{ label: string; url?: string }> = Array.isArray(s.links) ? s.links : [];

      if (links.length === 0) return null;

      return (
        <div data-nexuscart-block={widget.id} data-block-type="legal_links"
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {links.map((l) => (
            <a
              key={l.label}
              href={l.url ?? '#'}
              style={{ color: '#9ca3af', fontSize: 11, cursor: 'pointer', textDecoration: 'none' }}
            >
              {l.label}
            </a>
          ))}
        </div>
      );
    }

    case 'contact_info':
      return (
        <div data-nexuscart-block={widget.id} data-block-type="contact_info" style={{ fontSize: 12, lineHeight: 1.7 }}>
          {s.address && <p style={{ color: '#9ca3af', margin: '0 0 4px' }}>{s.address}</p>}
          {s.phone   && (
            <p style={{ margin: '0 0 4px' }}>
              <a href={`tel:${s.phone}`} style={{ color: '#9ca3af', textDecoration: 'none' }}>{s.phone}</a>
            </p>
          )}
          {s.email   && (
            <p style={{ margin: 0 }}>
              <a href={`mailto:${s.email}`} style={{ color: '#9ca3af', textDecoration: 'none' }}>{s.email}</a>
            </p>
          )}
        </div>
      );

    case 'social_icons': {
      const socialLinks: Array<{ label: string; url: string }> = Array.isArray(s.links) ? s.links : [];
      if (socialLinks.length === 0) return null;
      return (
        <div data-nexuscart-block={widget.id} data-block-type="social_icons"
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              title={link.label}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                color: '#9ca3af', textDecoration: 'none',
                fontSize: 11, fontWeight: 700,
              }}
            >
              {(link.label[0] ?? '?').toUpperCase()}
            </a>
          ))}
        </div>
      );
    }

    case 'app_badges': {
      const appStoreUrl   = s.appStoreUrl   as string | undefined;
      const googlePlayUrl = s.googlePlayUrl as string | undefined;
      if (!appStoreUrl && !googlePlayUrl) return null;
      return (
        <div data-nexuscart-block={widget.id} data-block-type="app_badges"
          style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {appStoreUrl && (
            <a href={appStoreUrl} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-block', padding: '5px 12px',
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6, color: '#e5e7eb', fontSize: 11, fontWeight: 600,
                textDecoration: 'none',
              }}>
              &#xf179; App Store
            </a>
          )}
          {googlePlayUrl && (
            <a href={googlePlayUrl} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-block', padding: '5px 12px',
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6, color: '#e5e7eb', fontSize: 11, fontWeight: 600,
                textDecoration: 'none',
              }}>
              &#xe900; Google Play
            </a>
          )}
        </div>
      );
    }

    case 'custom_html':
      if (!s.html) return null;
      return (
        <div
          data-nexuscart-block={widget.id}
          data-block-type="custom_html"
          dangerouslySetInnerHTML={{ __html: String(s.html) }}
          style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.7 }}
        />
      );

    default:
      return null;
  }
}

// ─── FooterSection ────────────────────────────────────────────────────────────

/**
 * FooterSection — Sprint 5 + footer parity fix
 *
 * All link data comes from configured sources only:
 *   nav_column  → menus[s.menuHandle] from DB, or s.links array, or empty state
 *   legal_links → s.links array from settings, or renders nothing
 *
 * No hardcoded demo links anywhere in this component.
 */
const FooterSection: React.FC<Props> = ({
  columns, bottomBar, settings, themeColors, storeName, menus = {},
}) => {
  const bg         = settings.topBackground ?? '#111827';
  const ptop       = settings.paddingTop    ?? 48;
  const pbottom    = settings.paddingBottom ?? 48;
  const showBottom = settings.showBottomBar !== false;
  const bottomBg   = settings.bottomBarBg ?? bottomBar.backgroundColor ?? '#0f172a';
  const divider    = settings.divider !== false;
  const dividerClr = settings.dividerColor ?? '#1f2937';
  const topBorder  = settings.topBorder !== false;

  if (columns.length === 0) return null;

  return (
    <footer data-nexuscart-section="footer" data-section-type="footer" style={{ position: 'relative' }}>
      {topBorder && <div style={{ height: 1, background: dividerClr }} />}

      {/* Top footer columns */}
      <div style={{ background: bg, paddingTop: ptop, paddingBottom: pbottom }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '0 24px',
          display: 'flex', gap: 32, flexWrap: 'wrap',
        }}>
          {columns.map((col) => (
            <div key={col.id} style={{ flex: `0 0 calc(${col.widthPercent}% - 32px)`, minWidth: 140 }}>
              {col.widgets.map((widget) => (
                <div key={widget.id} style={{ marginBottom: 16 }}>
                  <WidgetRenderer
                    widget={widget}
                    themeColors={themeColors}
                    storeName={storeName}
                    menus={menus}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {divider && <div style={{ height: 1, background: dividerClr }} />}

      {/* Bottom bar */}
      {showBottom && (
        <div style={{ background: bottomBg, padding: '14px 24px' }}>
          <div style={{
            maxWidth: 1200, margin: '0 auto',
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
          }}>
            {(bottomBar.components ?? []).map((comp) => (
              <WidgetRenderer
                key={comp.id}
                widget={comp}
                themeColors={themeColors}
                storeName={storeName}
                menus={menus}
              />
            ))}
          </div>
        </div>
      )}
    </footer>
  );
};

export default FooterSection;
