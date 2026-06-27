import React from 'react';
import { ShoppingBag, Search, ShoppingCart, User } from 'lucide-react';

interface NavItem { id: string; label: string; url: string }

interface Zone {
  id:           string;
  components:   Array<{ id: string; type: string; settings: Record<string, any> }>;
  background?:  string;
  visibility?:  string;
  paddingTop?:    number;
  paddingBottom?: number;
  borderBottom?:  string;
  borderColor?:   string;
}

interface HeaderBehavior {
  stickyMode?:       string;
  transparentOnHero?: boolean;
  zIndex?:           number;
  // P0-4: typography
  headerFont?:       string;   // 'heading' | 'body'
  headerFontSize?:   number;
  // P0-5: search
  showSearchIcon?:   boolean;
  searchPosition?:   string;   // 'left' | 'right'
  // P1-A: layout
  logoPosition?:     string;   // 'left' | 'center' | 'right'
  menuPosition?:     string;
  menuRow?:          string;   // 'top' | 'bottom'
}

interface Props {
  zones:      Zone[];
  behavior:   HeaderBehavior;
  themeColors: Record<string, string>;
  storeName:   string;
  logoUrl?:    string | null;
  menus?:      Record<string, NavItem[]>;   // P0-8
}

// ─── Individual zone component renderers ─────────────────────────────────────

function LogoComp({ comp, themeColors, storeName, logoUrl, width }: {
  comp: Zone['components'][0]; themeColors: Record<string, string>;
  storeName: string; logoUrl?: string | null; width: number;
}) {
  // P0-1: use `width` (not `maxWidth`) — key was wrong previously
  const imgW = comp.settings.width ?? width;

  return (
    <div
      data-nexuscart-block={comp.id}
      data-block-type="logo"
      style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
    >
      {logoUrl
        ? <img src={logoUrl} alt={comp.settings.altText ?? storeName} style={{ height: 36, maxWidth: imgW, objectFit: 'contain' }} />
        : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: themeColors.primary ?? '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={15} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: themeColors.text ?? '#1a1a1a', fontFamily: 'var(--nx-font-heading, Inter, sans-serif)', whiteSpace: 'nowrap' }}>
              {storeName}
            </span>
          </div>
        )}
    </div>
  );
}

function NavComp({ comp, themeColors, behavior, menus }: {
  comp: Zone['components'][0]; themeColors: Record<string, string>;
  behavior: HeaderBehavior; menus?: Record<string, NavItem[]>;
}) {
  // P0-8: resolve real menu items from handle
  const handle   = comp.settings.menuHandle ?? 'main-menu';
  const items    = menus?.[handle] ?? [];
  const navItems = items.length > 0
    ? items.slice(0, 8)
    : [{ id: '1', label: 'Home', url: '/' }, { id: '2', label: 'Catalog', url: '/collections' }, { id: '3', label: 'Contact', url: '/contact' }];

  // P0-4: font family from headerFont setting
  const ff = (behavior.headerFont === 'heading')
    ? 'var(--nx-font-heading, Inter, sans-serif)'
    : 'var(--nx-font-body, Inter, sans-serif)';
  const fs = behavior.headerFontSize ?? 14;

  return (
    <nav
      data-nexuscart-block={comp.id}
      data-block-type="menu"
      style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}
    >
      {navItems.map((item) => (
        <a
          key={item.id}
          href={item.url}
          onClick={(e) => e.preventDefault()}
          style={{
            fontSize:       fs,
            fontWeight:     500,
            color:          themeColors.text ?? '#1a1a1a',
            textDecoration: 'none',
            fontFamily:     ff,
            whiteSpace:     'nowrap',
          }}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

// ─── HeaderSection ─────────────────────────────────────────────────────────────

const HeaderSection: React.FC<Props> = ({ zones, behavior, themeColors, storeName, logoUrl, menus }) => {
  const isSticky = behavior.stickyMode && behavior.stickyMode !== 'off';

  // P0-6: transparentOnHero — render with transparent background + white text
  const isTransparent = behavior.transparentOnHero === true;

  return (
    <header
      data-nexuscart-section="header"
      data-section-type="header"
      style={{
        position: isSticky ? 'sticky' : 'relative',
        top:      0,
        zIndex:   behavior.zIndex ?? 50,
      }}
    >
      {zones.map((zone) => {
        if (zone.id === 'zone1') return null;   // zone1 handled by AnnouncementBarSection
        if (zone.visibility === 'hidden') return null;

        const bg      = isTransparent ? 'transparent' : (zone.background ?? '#ffffff');
        const ptop    = zone.paddingTop    ?? 12;
        const pbottom = zone.paddingBottom ?? 12;
        const border  = zone.borderBottom && zone.borderBottom !== 'none'
          ? `${zone.borderBottom} solid ${zone.borderColor ?? '#e5e7eb'}`
          : 'none';

        // P1-A: resolve logo and menu blocks for layout positioning
        const logoComp   = zone.components.find((c) => c.type === 'logo');
        const menuComp   = zone.components.find((c) => c.type === 'navigation');
        const searchComp = zone.components.find((c) => c.type === 'search');
        const cartComp   = zone.components.find((c) => c.type === 'cart');
        const acctComp   = zone.components.find((c) => c.type === 'account');

        // P0-5: honour showSearchIcon toggle
        const showSearch = behavior.showSearchIcon !== false;

        // Icon color (P0-6: white when transparent, else text color)
        const iconColor = isTransparent ? '#ffffff' : (themeColors.text ?? '#1a1a1a');

        // P1-A: right-side icons
        const rightIcons = (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {showSearch && searchComp && (
              <Search size={18} style={{ color: iconColor, cursor: 'pointer' }} />
            )}
            {cartComp && (
              <div style={{ position: 'relative' }}>
                <ShoppingCart size={18} style={{ color: iconColor, cursor: 'pointer' }} />
                <span style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: themeColors.accent ?? '#f59e0b', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>0</span>
              </div>
            )}
            {acctComp && <User size={18} style={{ color: iconColor, cursor: 'pointer' }} />}
          </div>
        );

        // P1-A: menuRow determines layout (single row vs two rows)
        const menuRow = behavior.menuRow ?? 'bottom';

        if (menuRow === 'bottom') {
          // Two-row layout: logo + icons on top, navigation below
          return (
            <div key={zone.id} style={{ background: bg, borderBottom: border, position: 'relative' }}>
              {/* Row 1: logo + right icons */}
              <div style={{ maxWidth: 1200, margin: '0 auto', padding: `${ptop}px 24px ${ptop / 2}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {logoComp && <LogoComp comp={logoComp} themeColors={themeColors} storeName={storeName} logoUrl={logoUrl} width={120} />}
                {rightIcons}
              </div>
              {/* Row 2: navigation */}
              {menuComp && (
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: `0 24px ${pbottom}px`, display: 'flex', alignItems: 'center' }}>
                  <NavComp comp={menuComp} themeColors={themeColors} behavior={behavior} menus={menus} />
                </div>
              )}
            </div>
          );
        }

        // Single-row layout (menuRow === 'top' or default)
        // P1-A: logoPosition affects whether logo is left/center/right
        const logoPos = behavior.logoPosition ?? 'left';

        return (
          <div key={zone.id} style={{ background: bg, borderBottom: border, position: 'relative' }}>
            <div style={{
              maxWidth:      1200,
              margin:        '0 auto',
              padding:       `${ptop}px 24px ${pbottom}px`,
              display:       'flex',
              alignItems:    'center',
              gap:           24,
              position:      'relative',
            }}>
              {/* Logo — absolute center when logoPosition='center' */}
              {logoComp && logoPos === 'center' && (
                <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
                  <LogoComp comp={logoComp} themeColors={themeColors} storeName={storeName} logoUrl={logoUrl} width={120} />
                </div>
              )}
              {logoComp && logoPos !== 'center' && (
                <LogoComp comp={logoComp} themeColors={themeColors} storeName={storeName} logoUrl={logoUrl} width={120} />
              )}
              {/* Nav */}
              {menuComp && (
                <NavComp comp={menuComp} themeColors={themeColors} behavior={behavior} menus={menus} />
              )}
              {/* Right icons */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
                {rightIcons}
              </div>
            </div>
          </div>
        );
      })}
    </header>
  );
};

export default HeaderSection;
