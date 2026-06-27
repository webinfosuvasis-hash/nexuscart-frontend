/**
 * Phase 8 — Header/Footer child block primitives
 *
 * Node-compatible wrappers for every block type that appears as a child
 * node inside header, footer, and announcement_bar section nodes.
 *
 * These primitives are registered in the NodeRenderer registry so that
 * TreeRenderer no longer falls back to the Unknown component when it
 * encounters logo, menu, copyright, etc. inside a page tree.
 *
 * Scope:
 *   Announcement bar blocks: announcement
 *   Header blocks:           logo, menu, search, cart (+ cart_icon alias), account
 *   Footer blocks:           copyright, footer_column, brand_block,
 *                            nav_column, newsletter_form, payment_badges,
 *                            social_links
 *
 * Design principle:
 *   Each primitive renders the CONTENT of the block — no editor chrome, no
 *   selection overlays, no DnD. Interactive wrappers (NodeSectionWrapper,
 *   SystemSectionShell) are applied above in NodeCanvas / TreeRenderer.
 *
 * Template variable support:
 *   CopyrightBlock replaces {{year}} and {{store_name}} using the current
 *   year and ctx.storeId as a name placeholder.
 */

import React from 'react';
import type { NodeProps } from '../types';
import { renderRichText } from '@/utils/richText';
import {
  ShoppingBag, Search, ShoppingCart, User,
  Mail, Facebook, Instagram, Twitter, Youtube,
} from 'lucide-react';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function str(v: unknown, fallback = ''): string {
  return v != null ? String(v) : fallback;
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ─── Announcement bar blocks ──────────────────────────────────────────────────

/**
 * announcement — renders the announcement bar text content.
 * Settings: text (rich text), fontSize, textColor, letterSpacing, textCase.
 */
export const AnnouncementBlock: React.FC<NodeProps> = ({ node }) => {
  const raw       = node.settings.text;
  const fontSize  = num(node.settings.fontSize, 12);
  const textColor = str(node.settings.textColor, '#ffffff');
  const textCase  = str(node.settings.textCase, 'none') as React.CSSProperties['textTransform'];

  // Use renderRichText() in 'inline' mode to preserve bold, italic, links and
  // other formatting. toPlainText() strips all tags which causes a visual
  // mismatch vs the legacy TemplateAnnouncementBarSection.
  const html = raw ? renderRichText(raw, 'inline') : '';

  if (!html) return null;

  return (
    <span
      data-node-id={node.id}
      data-node-type="announcement"
      style={{ fontSize, color: textColor, textTransform: textCase, fontWeight: 500 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

// ─── Header blocks ────────────────────────────────────────────────────────────

/**
 * logo — renders the store logo image or falls back to text.
 * Settings: image (url), altText, width.
 */
export const LogoBlock: React.FC<NodeProps> = ({ node }) => {
  const image   = str(node.settings.image);
  const altText = str(node.settings.altText, 'Store');
  const width   = num(node.settings.width, 120);

  return (
    <div
      data-node-id={node.id}
      data-node-type="logo"
      style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
    >
      {image ? (
        <img
          src={image}
          alt={altText}
          style={{ width, height: 'auto', objectFit: 'contain', display: 'block' }}
          loading="lazy"
        />
      ) : (
        <>
          <div
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShoppingBag size={15} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1a1a' }}>{altText}</span>
        </>
      )}
    </div>
  );
};

/**
 * menu — renders a horizontal navigation list.
 * Settings: menuHandle (used as a key), position.
 * In preview mode, real menu items would be injected via ctx.pageContext.menus.
 */
export const MenuBlock: React.FC<NodeProps> = ({ node, ctx }) => {
  const handle = str(node.settings.menuHandle, 'main-menu');
  const items  = (ctx.pageContext as any)?.menus?.[handle] as
    Array<{ id: string; label: string; url: string }> | undefined;

  const links = items ?? [
    { id: 'home',    label: 'Home',    url: '/'        },
    { id: 'catalog', label: 'Catalog', url: '/catalog' },
    { id: 'contact', label: 'Contact', url: '/contact' },
  ];

  return (
    <nav
      data-node-id={node.id}
      data-node-type="menu"
      aria-label="Navigation"
      style={{ display: 'flex', alignItems: 'center', gap: 24 }}
    >
      {links.map((item) => (
        <a
          key={item.id}
          href={item.url}
          style={{
            fontSize: 14, fontWeight: 500, color: '#374151',
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
};

/**
 * search — renders a search icon button.
 * Settings: position.
 */
export const SearchBlock: React.FC<NodeProps> = ({ node }) => (
  <button
    data-node-id={node.id}
    data-node-type="search"
    aria-label="Search"
    style={{
      background: 'transparent', border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6,
      color: '#6b7280',
    }}
  >
    <Search size={18} />
  </button>
);

/**
 * cart — renders a cart icon button.
 * Settings: (none required).
 * Registered under both 'cart' and 'cart_icon' via alias in index.ts.
 */
export const CartIconBlock: React.FC<NodeProps> = ({ node }) => (
  <button
    data-node-id={node.id}
    data-node-type={str(node.type, 'cart')}
    aria-label="Cart"
    style={{
      background: 'transparent', border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6,
      color: '#6b7280', position: 'relative',
    }}
  >
    <ShoppingCart size={18} />
  </button>
);

/**
 * account — renders an account / sign-in icon button.
 */
export const AccountBlock: React.FC<NodeProps> = ({ node }) => (
  <button
    data-node-id={node.id}
    data-node-type="account"
    aria-label="Account"
    style={{
      background: 'transparent', border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6,
      color: '#6b7280',
    }}
  >
    <User size={18} />
  </button>
);

// ─── Footer blocks ────────────────────────────────────────────────────────────

/**
 * copyright — renders a copyright line.
 * Settings: text (may contain {{year}} and {{store_name}} tokens), textColor.
 */
export const CopyrightBlock: React.FC<NodeProps> = ({ node, ctx }) => {
  const year  = new Date().getFullYear();
  const name  = ctx.storeId || 'My Store';
  const raw   = str(node.settings.text, `© ${year} ${name}. All rights reserved.`);
  const text  = raw
    .replace(/\{\{\s*year\s*\}\}/g,       String(year))
    .replace(/\{\{\s*store_name\s*\}\}/g, name);
  const color = str(node.settings.textColor, '#9ca3af');

  return (
    <p
      data-node-id={node.id}
      data-node-type="copyright"
      style={{ margin: 0, fontSize: 12, color }}
    >
      {text}
    </p>
  );
};

/**
 * footer_column — a titled column of links.
 * Children (link nodes) are rendered by NodeRenderer and passed as children.
 * Settings: title.
 */
export const FooterColumnBlock: React.FC<NodeProps> = ({ node, style, children }) => (
  <div
    data-node-id={node.id}
    data-node-type="footer_column"
    style={{ flex: '1 1 0', minWidth: 120, ...style }}
  >
    {node.settings.title && (
      <h3
        style={{
          fontSize: 13, fontWeight: 700, color: '#ffffff',
          marginBottom: 12, marginTop: 0,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}
      >
        {str(node.settings.title)}
      </h3>
    )}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {children}
    </div>
  </div>
);

/**
 * brand_block — renders brand identity (logo placeholder + optional tagline).
 * Children (logo, social links) are passed through.
 * Settings: tagline.
 */
export const BrandBlock: React.FC<NodeProps> = ({ node, style, children }) => (
  <div
    data-node-id={node.id}
    data-node-type="brand_block"
    style={{ flex: '0 0 auto', maxWidth: '40%', ...style }}
  >
    {/* Logo placeholder */}
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: node.settings.tagline ? 12 : 0,
      }}
    >
      <div
        style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <ShoppingBag size={15} color="#fff" />
      </div>
      <span style={{ fontWeight: 700, fontSize: 15, color: '#ffffff' }}>
        {str(node.settings.storeName, 'My Store')}
      </span>
    </div>
    {node.settings.tagline && (
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>
        {str(node.settings.tagline)}
      </p>
    )}
    {children}
  </div>
);

/**
 * nav_column — a titled navigation column (links as children).
 * Settings: title.
 */
export const NavColumnBlock: React.FC<NodeProps> = ({ node, style, children }) => (
  <div
    data-node-id={node.id}
    data-node-type="nav_column"
    style={{ flex: '1 1 0', minWidth: 120, ...style }}
  >
    {node.settings.title && (
      <h3
        style={{
          fontSize: 13, fontWeight: 700, color: '#ffffff',
          marginBottom: 12, marginTop: 0,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}
      >
        {str(node.settings.title)}
      </h3>
    )}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {children}
    </div>
  </div>
);

/**
 * newsletter_form — renders a static email subscription form.
 * Settings: label, placeholder, buttonLabel.
 */
export const NewsletterFormBlock: React.FC<NodeProps> = ({ node }) => {
  const label       = str(node.settings.label,       'Subscribe to our newsletter');
  const placeholder = str(node.settings.placeholder, 'Email address');
  const buttonLabel = str(node.settings.buttonLabel, 'Subscribe');

  return (
    <div data-node-id={node.id} data-node-type="newsletter_form">
      {label && (
        <p style={{ margin: '0 0 8px', fontSize: 13, color: '#9ca3af' }}>{label}</p>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="email"
          placeholder={placeholder}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 6, fontSize: 13,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.05)', color: '#fff',
            outline: 'none',
          }}
          readOnly
        />
        <button
          style={{
            padding: '8px 16px', borderRadius: 6, fontSize: 13,
            background: '#4f46e5', color: '#fff', border: 'none',
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
};

/**
 * payment_badges — renders payment method badge chips.
 * Settings: set ('generic' | custom list).
 */
export const PaymentBadgesBlock: React.FC<NodeProps> = ({ node }) => {
  const badges = ['Visa', 'MC', 'PayPal', 'GPay', 'Apple Pay'];

  return (
    <div
      data-node-id={node.id}
      data-node-type="payment_badges"
      style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}
    >
      {badges.map((badge) => (
        <span
          key={badge}
          style={{
            padding: '2px 8px', borderRadius: 4,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            fontSize: 10, fontWeight: 600, color: '#9ca3af',
          }}
        >
          {badge}
        </span>
      ))}
    </div>
  );
};

/**
 * social_links — renders a row of social media icon links.
 * Settings: facebook, instagram, twitter, youtube (URL strings).
 */
export const SocialLinksBlock: React.FC<NodeProps> = ({ node }) => {
  const networks = [
    { key: 'facebook',  Icon: Facebook,  label: 'Facebook'  },
    { key: 'instagram', Icon: Instagram, label: 'Instagram' },
    { key: 'twitter',   Icon: Twitter,   label: 'Twitter'   },
    { key: 'youtube',   Icon: Youtube,   label: 'YouTube'   },
  ];

  const visible = networks.filter((n) => node.settings[n.key]);

  // If no URLs are configured, render a placeholder row of all icons
  const icons = visible.length > 0 ? visible : networks;

  return (
    <div
      data-node-id={node.id}
      data-node-type="social_links"
      style={{ display: 'flex', gap: 10, alignItems: 'center' }}
    >
      {icons.map(({ key, Icon, label }) => (
        <a
          key={key}
          href={str(node.settings[key], '#')}
          aria-label={label}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.7)',
            textDecoration: 'none',
            transition: 'background 150ms',
          }}
        >
          <Icon size={15} />
        </a>
      ))}
    </div>
  );
};
