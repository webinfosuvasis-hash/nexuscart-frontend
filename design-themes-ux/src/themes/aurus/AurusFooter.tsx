import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { THEME_META } from '@/data/products';
import { fetchCategories, fetchCollectionsList } from '@/lib/storefrontApi';
import { useStorefrontMenuByHandle } from '@/hooks/useStorefrontMenu';
import { UI, SERIF } from './constants';

export interface FooterLink { label: string; to: string }
export type FooterColumn = [string, FooterLink[]];

/** Always-valid links: real routes, or CMS pages that have built-in fallback content (see defaultCmsPages). */
export const HELP_LINKS: FooterLink[] = [
  { label: 'My Account', to: '/account' },
  { label: 'Track Order', to: '/account/orders' },
  { label: 'Shipping Policy', to: '/pages/shipping-policy' },
  { label: 'Returns & Refunds', to: '/pages/return-policy' },
  { label: 'FAQ', to: '/pages/faq' },
];

export const COMPANY_LINKS: FooterLink[] = [
  { label: 'About Us', to: '/pages/about-us' },
  { label: 'Contact Us', to: '/pages/contact-us' },
  { label: 'Privacy Policy', to: '/pages/privacy-policy' },
  { label: 'Terms & Conditions', to: '/pages/terms-and-conditions' },
];

const FOOTER_MENU_HANDLE = 'footer-menu';
const MAX_LINKS = 8;

/**
 * Footer columns. A merchant-configured "footer-menu" (top-level items as
 * column headings, children as links) takes over entirely; otherwise the
 * Shop/Collections columns come from the store's live catalog so every link
 * resolves to a real category/collection — never a hardcoded slug.
 */
export function useFooterColumns(): FooterColumn[] {
  const { menu } = useStorefrontMenuByHandle(FOOTER_MENU_HANDLE);
  const { data: cats } = useQuery({
    queryKey: ['storefront', 'footer', 'categories'],
    queryFn: () => fetchCategories(MAX_LINKS),
    staleTime: 300_000,
    retry: 1,
  });
  const { data: cols } = useQuery({
    queryKey: ['storefront', 'footer', 'collections'],
    queryFn: () => fetchCollectionsList(MAX_LINKS),
    staleTime: 300_000,
    retry: 1,
  });

  const menuColumns: FooterColumn[] = (menu?.items ?? [])
    .filter((i) => i.children.length > 0)
    .map((i) => [i.label, i.children.map((c) => ({ label: c.label, to: c.url }))]);
  if (menuColumns.length) return menuColumns;

  const columns: FooterColumn[] = [];
  const shop = (cats?.categories ?? []).slice(0, MAX_LINKS).map((c) => ({ label: c.name, to: `/category/${c.slug}` }));
  const collections = (cols?.collections ?? []).slice(0, MAX_LINKS).map((c) => ({ label: c.name, to: `/collection/${c.slug}` }));
  if (shop.length) columns.push(['Shop', shop]);
  if (collections.length) columns.push(['Collections', collections]);
  columns.push(['Help', HELP_LINKS], ['Company', COMPANY_LINKS]);
  return columns;
}

const FooterAnchor: React.FC<{ link: FooterLink }> = ({ link }) =>
  /^https?:\/\//i.test(link.to)
    ? <a href={link.to} target="_blank" rel="noopener noreferrer" className="text-[12px] text-gray-500 hover:text-purple-700 transition-colors">{link.label}</a>
    : <Link to={link.to} className="text-[12px] text-gray-500 hover:text-purple-700 transition-colors">{link.label}</Link>;

/**
 * AurusFooter — the site-wide footer, shared by the Homepage, PLP, PDP and
 * CMS pages so every page closes the same way.
 */
const AurusFooter: React.FC = () => {
  const meta = THEME_META.aurus;
  const columns = useFooterColumns();

  return (
    <footer className="bg-white border-t border-gray-200" style={UI}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-5 gap-8">

        {/* Brand */}
        <div className="col-span-2 md:col-span-1">
          <h4 className="text-xl font-bold text-gray-900 tracking-[0.12em]" style={SERIF}>
            {meta.brand.toUpperCase()}
          </h4>
          <p className="text-gray-500 text-xs mt-3 leading-relaxed">
            {meta.tagline}
          </p>
        </div>

        {/* Link columns */}
        {columns.map(([heading, links]) => (
          <nav key={heading} aria-label={heading}>
            <h5 className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-900 mb-4">{heading}</h5>
            <ul className="space-y-2">
              {links.map(l => (
                <li key={`${l.label}-${l.to}`}><FooterAnchor link={l} /></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* Payment icons row */}
      <div className="border-t border-gray-100 py-4 px-4 sm:px-6">
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-gray-500">© {new Date().getFullYear()} {meta.brand}. All rights reserved.</p>
          <div className="flex flex-wrap justify-center items-center gap-2">
            {['Visa', 'Mastercard', 'UPI', 'GPay', 'PhonePe', 'NetBanking'].map(p => (
              <span key={p} className="text-[10px] text-gray-500 border border-gray-200 rounded px-1.5 py-0.5 font-medium">{p}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default AurusFooter;
