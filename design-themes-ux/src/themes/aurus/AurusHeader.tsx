import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '@/context/StoreContext';
import { useCartContext } from '@/context/CartContext';
import { useAuth } from '@/context/CustomerAuthContext';
import {
  Search, Heart, ShoppingBag, User, ChevronDown, ChevronRight, Store, Menu as MenuIcon, X as CloseIcon, Loader2, Sparkles,
} from 'lucide-react';
import { NAV_ITEMS, NAV_LINKS, GARMENT_MENU, UI, SERIF } from './constants';
import { THEME_META, PRODUCTS } from '@/data/products';
import { useStorefrontMenu } from '@/hooks/useStorefrontMenu';
import { ResolvedMenuItem } from '@/lib/storefrontMenuApi';

interface Props {
  /** Initial active nav item */
  activeNav?: string;
  /** Controlled search value — parent handles filtering */
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit?: (q: string) => void;
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** A child (or the item itself) counts as a "mega menu" trigger once it carries any visual extra — otherwise it's a plain dropdown. */
function hasMegaMenuContent(item: ResolvedMenuItem): boolean {
  if (item.megaMenu && (item.megaMenu.image || item.megaMenu.banner || item.megaMenu.featuredProducts.length > 0 || item.megaMenu.featuredCategories.length > 0)) {
    return true;
  }
  return item.children.some((c) => c.children.length > 0 || !!c.megaMenu);
}

const BadgeChip: React.FC<{ badge: 'NEW' | 'SALE' }> = ({ badge }) => (
  <span
    className={`ml-1.5 inline-flex items-center text-[8px] font-black px-1.5 py-px rounded-sm tracking-wider uppercase ${
      badge === 'SALE' ? 'bg-red-600 text-white' : 'bg-purple-600 text-white'
    }`}
  >
    {badge}
  </span>
);

/* ─── Desktop: full mega-menu panel (images/banner/featured items) ─────── */
const MegaMenuPanel: React.FC<{ item: ResolvedMenuItem; currentPath: string }> = ({ item, currentPath }) => {
  const columns = item.children;
  const spotlightProducts = item.megaMenu?.featuredProducts ?? [];
  const spotlightCategories = item.megaMenu?.featuredCategories ?? [];
  const hasSpotlight = spotlightProducts.length > 0 || spotlightCategories.length > 0 || !!item.megaMenu?.banner;

  // MegaMenuPanel only ever renders once the caller (hasMegaMenuContent) has
  // already decided this item deserves the full-bleed wide layout — which can
  // be true even when THIS item's own megaMenu has no banner/featured items
  // (e.g. a child carries the mega-menu-worthy content instead). Previously
  // the trailing column was only reserved when `hasSpotlight` was true, so
  // that mismatch left a plain grid short of the panel's full width, reading
  // as an unfinished layout. Reserve the column whenever we're in wide mode
  // and fill it with a neutral, on-brand block instead of leaving it empty.
  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10 max-h-[80vh] overflow-y-auto">
      {/*
        Flexbox + wrap, not CSS Grid auto-fit: an auto-fit repeat() combined
        with a trailing explicit fixed track computes its implicit column
        count from available *space*, not from the actual number of category
        columns present — with only 1-2 real columns that mismatch collapsed
        the spotlight block's own internal 2-across product row into a
        single narrow track, stacking it vertically instead of side-by-side.
        Flexbox wrap sizes each column from its own content/min-width, so it
        can't warp a column it isn't responsible for.

        Columns are top-aligned (`items-start`), matching how every premium
        mega menu actually lays out — a category list reads as a list, not a
        vertically-floating chip. With sparse real menu data (a category with
        only one or two children), a top-aligned short column next to a
        taller spotlight column will still leave space below it; rather than
        disguise that by centering the column (which reads as "floating," not
        "premium"), each column gets a "View All" link back to its own page
        using data already on the item (its own url/label) — the standard
        premium-mega-menu answer to a short list, not a CSS trick.
      */}
      <div className="flex flex-wrap items-start gap-x-12 gap-y-8">
        {columns.map((col, i) => (
          <div key={col.id} className="w-[180px] flex-shrink-0">
            <h4
              className={`text-[11px] font-semibold uppercase tracking-[0.18em] mb-5 pb-2.5 border-b ${
                i === 0 ? 'text-purple-700 border-purple-100' : 'text-gray-500 border-gray-100'
              }`}
              style={UI}
            >
              {col.label}
            </h4>
            <ul className="space-y-3.5">
              {(col.children.length > 0 ? col.children : [col]).map((leaf) => {
                const isActive = currentPath === leaf.url;
                return (
                  <li key={leaf.id}>
                    <Link
                      to={leaf.url}
                      aria-current={isActive ? 'page' : undefined}
                      className={`group/link flex items-center gap-2.5 text-[13px] leading-relaxed transition-colors duration-200 ease-out ${
                        isActive ? 'text-purple-700 font-semibold' : 'text-gray-700 hover:text-purple-700'
                      }`}
                      style={UI}
                    >
                      {leaf.megaMenu?.icon && (
                        <span className="w-[18px] h-[18px] rounded-full bg-gray-100 flex items-center justify-center text-[11px] flex-shrink-0">{leaf.megaMenu.icon}</span>
                      )}
                      <span className="relative">
                        {leaf.label}
                        <span className="absolute left-0 -bottom-0.5 h-px w-0 bg-purple-700 transition-all duration-200 ease-out group-hover/link:w-full" />
                      </span>
                      {leaf.megaMenu?.badge && <BadgeChip badge={leaf.megaMenu.badge} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {col.children.length > 0 && (
              <Link
                to={col.url}
                className="inline-block mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-purple-700/70 hover:text-purple-700 transition-colors duration-200 ease-out"
                style={UI}
              >
                View All →
              </Link>
            )}
          </div>
        ))}

        {hasSpotlight && (
          <div className="flex flex-col gap-5 flex-[1_1_280px] min-w-[280px]">
            {item.megaMenu?.banner && (
              <Link
                to={item.megaMenu.banner.link ?? item.url}
                className="group relative block aspect-[16/9] overflow-hidden rounded-xl bg-purple-50"
              >
                {item.megaMenu.banner.image && (
                  <img
                    src={item.megaMenu.banner.image}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                  />
                )}
                {item.megaMenu.banner.text && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
                    <p className="absolute left-4 right-4 bottom-3.5 text-[13px] font-semibold text-white tracking-wide" style={UI}>
                      {item.megaMenu.banner.text}
                    </p>
                  </>
                )}
              </Link>
            )}
            <div className="flex gap-4 justify-end flex-wrap">
              {spotlightProducts.slice(0, 2).map((p) => (
                <Link key={p.id} to={`/products/${p.id}`} className="group flex flex-col w-[136px] transition-transform duration-200 ease-out hover:-translate-y-0.5">
                  <div className="aspect-[3/4] overflow-hidden rounded-lg bg-purple-50 relative shadow-sm">
                    {p.thumbnail && (
                      <img src={p.thumbnail} alt={p.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
                    )}
                  </div>
                  <p className="text-[11.5px] text-gray-700 mt-2.5 font-medium truncate" style={UI}>{p.name}</p>
                  <p className="text-[11.5px] text-purple-700 font-semibold">{inr(p.price)}</p>
                </Link>
              ))}
              {spotlightCategories.slice(0, 2).map((c) => (
                <Link key={c.id} to={`/category/${c.slug}`} className="group flex flex-col w-[136px] transition-transform duration-200 ease-out hover:-translate-y-0.5">
                  <div className="aspect-[3/4] overflow-hidden rounded-lg bg-purple-50 shadow-sm">
                    {c.image && <img src={c.image} alt={c.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />}
                  </div>
                  <p className="text-[11.5px] text-gray-700 mt-2.5 font-medium truncate" style={UI}>{c.name}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!hasSpotlight && (
          <div className="hidden md:flex flex-col items-center justify-center gap-2 rounded-xl bg-purple-50 text-purple-300 min-h-[160px] flex-[1_1_280px] min-w-[280px]">
            <Sparkles className="w-6 h-6" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={UI}>{item.label}</span>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Desktop: plain dropdown (no images/featured content) ──────────────── */
const DropdownPanel: React.FC<{ item: ResolvedMenuItem; currentPath: string }> = ({ item, currentPath }) => (
  <div className="min-w-[240px] bg-white rounded-b-xl py-3 shadow-[0_28px_56px_-16px_rgba(17,12,34,0.28),0_10px_20px_-8px_rgba(17,12,34,0.16)]">
    {item.children.map((child) => {
      const isActive = currentPath === child.url;
      return (
        <Link
          key={child.id}
          to={child.url}
          aria-current={isActive ? 'page' : undefined}
          className={`flex items-center justify-between gap-6 mx-2 px-4 py-2.5 rounded-lg text-[13px] transition-colors ${
            isActive ? 'bg-purple-50 text-purple-700 font-semibold' : 'text-gray-700 hover:bg-purple-50 hover:text-purple-700'
          }`}
          style={UI}
        >
          {child.label}
          {child.megaMenu?.badge && <BadgeChip badge={child.megaMenu.badge} />}
        </Link>
      );
    })}
  </div>
);

/* ─── Mobile: recursive accordion nav item ───────────────────────────────── */
const MobileNavItem: React.FC<{ item: ResolvedMenuItem; depth: number; currentPath: string; onNavigate: () => void }> = ({ item, depth, currentPath, onNavigate }) => {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = item.children.length > 0;
  const isActive = currentPath === item.url;

  return (
    <div className="border-b border-gray-100 pr-3" style={{ paddingLeft: 20 + depth * 16 }}>
      <div className="flex items-center justify-between">
        <Link
          to={item.url}
          onClick={onNavigate}
          aria-current={isActive ? 'page' : undefined}
          className={`flex-1 py-3.5 text-[14px] flex items-center gap-2 transition-colors active:bg-gray-50 ${
            isActive ? 'text-purple-700 font-semibold' : 'text-gray-800 font-medium'
          }`}
          style={UI}
        >
          {item.label}
          {item.megaMenu?.badge && <BadgeChip badge={item.megaMenu.badge} />}
        </Link>
        {hasChildren && (
          <button
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
            aria-expanded={expanded}
            className="p-3 text-gray-500 rounded-full active:bg-gray-100 transition-colors"
          >
            <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
          </button>
        )}
      </div>
      {hasChildren && expanded && (
        <div className="animate-slide-in">
          {item.children.map((child) => (
            <MobileNavItem key={child.id} item={child} depth={depth + 1} currentPath={currentPath} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
};

const AurusHeader: React.FC<Props> = ({
  activeNav: initialNav = 'Sarees',
  searchQuery,
  onSearchChange,
  onSearchSubmit,
}) => {
  const { wishlist } = useStore();
  const { itemCount, setCartOpen } = useCartContext();
  const { isAuthenticated, customer } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeNav,      setActiveNav]      = useState(initialNav);
  const [megaMenu,       setMegaMenu]       = useState<string | null>(null);
  const [pincodeOpen,    setPincodeOpen]    = useState(false);
  const [headerPin,      setHeaderPin]      = useState('');
  const [pinSaved,       setPinSaved]       = useState('');
  const [mobileNavOpen,  setMobileNavOpen]  = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A per-element onKeyDown only fires when that element has actual DOM
  // focus — which a mouse hover never grants. Without this, a customer who
  // opens a panel by hovering (the common case) and then reaches for Escape
  // out of habit finds it does nothing, because the keydown has nowhere
  // focused to land on. A document-level listener, scoped to only run while
  // a menu is actually open, closes the gap for both open-by-hover and
  // open-by-keyboard alike.
  useEffect(() => {
    if (!megaMenu) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setMegaMenu(null); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [megaMenu]);

  const meta     = THEME_META.aurus;
  const products = PRODUCTS.aurus;

  // Phase 9 — Dynamic Storefront Navigation. Falls back to the existing
  // hardcoded nav/mega-menu (rendered exactly as before, byte-for-byte)
  // whenever the store has no menu configured yet or the fetch is still
  // pending — no existing theme's default behavior changes.
  const { menu, isLoading: menuLoading } = useStorefrontMenu();
  const hasLiveMenu = !menuLoading && !!menu && menu.items.length > 0;
  const liveItems = useMemo(() => menu?.items ?? [], [menu]);
  const activeLiveItem = useMemo(
    () => (megaMenu ? liveItems.find((i) => i.id === megaMenu) ?? null : null),
    [megaMenu, liveItems],
  );

  const openMegaMenu = useCallback((name: string) => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setMegaMenu(name);
  }, []);
  const scheduleMegaMenuClose = useCallback(() => {
    closeTimerRef.current = setTimeout(() => setMegaMenu(null), 200);
  }, []);
  const cancelMegaMenuClose = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const handleSearchSubmit = () => {
    if (onSearchSubmit) {
      onSearchSubmit(searchQuery);
    } else {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 relative" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>

      {/* ── Announcement bar ── */}
      <div className="bg-purple-950 text-purple-100 text-center text-[11px] py-2 tracking-wide" style={UI}>
        <span className="font-semibold text-white">Flat 100% Off on Making Charges</span>
        <span className="mx-3 text-purple-400">•</span>
        Free Shipping on Orders Above ₹1,999
        <span className="mx-3 text-purple-400">•</span>
        15-Day Easy Exchange &amp; Returns
        <span className="mx-3 text-purple-400">•</span>
        BIS Hallmarked Jewellery
      </div>

      {/* ── Row 1: Logo + Search + Icons ── */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-[1400px] mx-auto px-4 h-[64px] flex items-center gap-4">

          {/* Mobile nav trigger */}
          <button
            onClick={() => setMobileNavOpen(true)}
            className="lg:hidden flex-shrink-0 text-gray-700 hover:text-purple-700 transition-colors"
            aria-label="Open navigation menu"
          >
            <MenuIcon className="w-[22px] h-[22px]" />
          </button>

          {/* Logo */}
          <Link to="/" className="flex-shrink-0 flex flex-col leading-none group">
            <span
              className="text-[20px] font-bold tracking-[0.14em] text-gray-900 group-hover:text-purple-700 transition-colors"
              style={SERIF}
            >
              {meta.brand.toUpperCase()}
            </span>
            <span className="text-[8px] text-gray-500 tracking-[0.22em] uppercase mt-1" style={UI}>Fine Jewellery</span>
          </Link>

          {/* Search bar */}
          {/*
            `min-w-0` on both the wrapper and the input: text inputs default
            to `min-width: auto`, which floors their shrink-width at roughly
            their content size instead of 0 — inside a flex row that's
            otherwise full of fixed-width siblings (pills, icons), that floor
            is what pushed the cart icon off-screen at 834px once the pills
            grew a little wider. min-w-0 lets the search input actually
            compress under real space pressure instead of forcing overflow.
          */}
          <div className="flex-1 min-w-0 max-w-[600px] flex h-[38px]">
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearchSubmit()}
              placeholder="Search for jewellery, styles, occasions…"
              className="flex-1 min-w-0 h-full pl-4 pr-3 text-[14px] border border-gray-300 border-r-0 outline-none focus:border-purple-500 bg-white transition-colors"
              style={UI}
              aria-label="Search products"
            />
            <button
              onClick={handleSearchSubmit}
              className="h-full px-4 bg-purple-700 hover:bg-purple-800 flex items-center justify-center flex-shrink-0 transition-colors"
              aria-label="Submit search"
            >
              <Search className="w-[18px] h-[18px] text-white" />
            </button>
          </div>

          {/* Quick-access pills */}
          <div className="hidden md:flex items-center gap-2.5 flex-shrink-0">
            <button className="relative flex items-center gap-1.5 border border-pink-500 text-pink-600 rounded-full px-3.5 h-[34px] text-[11px] font-semibold hover:bg-pink-50 transition-colors whitespace-nowrap">
              <span className="absolute -top-[10px] left-2.5 bg-red-600 text-white text-[7px] font-black px-1.5 py-px rounded-sm tracking-wider uppercase">SALE</span>
              🎀 Festive Sale
            </button>
            <button className="flex items-center gap-1.5 border border-gray-400 text-gray-700 rounded-full px-3.5 h-[34px] text-[11px] font-medium hover:bg-gray-50 transition-colors whitespace-nowrap">
              <Store className="w-3.5 h-3.5" /> Style Guide
            </button>
            <button className="flex items-center gap-1.5 border-2 border-purple-400 text-purple-700 bg-purple-50 rounded-full px-3.5 h-[34px] text-[11px] font-bold hover:bg-purple-100 transition-colors whitespace-nowrap">
              <span className="w-[14px] h-[14px] rounded-full bg-purple-500 flex items-center justify-center text-[8px] font-black text-white">✦</span>
              New Drop
            </button>
          </div>

          {/* Delivery & Pincode */}
          <div className="hidden xl:flex flex-col items-end flex-shrink-0 border-l border-gray-200 pl-4 relative">
            <p className="text-[10px] text-gray-500 leading-none">Delivery &amp; Stores</p>
            <button
              onClick={() => setPincodeOpen(o => !o)}
              className="text-[11px] text-purple-700 font-semibold hover:underline underline-offset-1 leading-tight mt-0.5 whitespace-nowrap"
              style={UI}
              aria-label="Enter delivery pincode"
            >
              {pinSaved ? `📍 ${pinSaved}` : 'Enter Pincode'}
            </button>

            {pincodeOpen && (
              <div
                className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 z-[300]"
                style={{ width: 240 }}
              >
                <p className="text-[11px] font-bold text-gray-700 mb-2" style={UI}>Enter Delivery Pincode</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={headerPin}
                    autoFocus
                    onChange={e => setHeaderPin(e.target.value.slice(0, 6))}
                    placeholder="6-digit pincode"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-[12px] outline-none focus:border-purple-500"
                    style={UI}
                    aria-label="Pincode"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && headerPin.length === 6) {
                        setPinSaved(headerPin);
                        setPincodeOpen(false);
                      }
                    }}
                  />
                  <button
                    disabled={headerPin.length !== 6}
                    onClick={() => { setPinSaved(headerPin); setPincodeOpen(false); }}
                    className="bg-purple-700 hover:bg-purple-800 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
                    style={UI}
                  >
                    Check
                  </button>
                </div>
                {pinSaved && (
                  <p className="text-[10px] text-green-600 mt-2 font-medium">
                    ✓ Delivering to {pinSaved} — arrives in 5–7 days
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Language */}
          {/*
            A literal flag emoji (🇮🇳) is two Unicode regional-indicator code
            points, not a guaranteed glyph — most non-Apple platforms
            (Windows Chromium among them) have no flag font installed and
            fall back to rendering the raw two-letter code as plain text,
            producing a stray "IN" that reads as a rendering bug rather than
            a country selector. A deliberately-styled text badge carries the
            same information without depending on font/platform support.
          */}
          <button
            className="hidden xl:flex items-center gap-1.5 text-[12px] text-gray-600 border-l border-gray-200 pl-4 flex-shrink-0 hover:text-purple-700 transition-colors"
            aria-label="Select language"
          >
            <span className="text-[9px] font-bold tracking-wide border border-gray-300 rounded px-1 py-px text-gray-500">IN</span>
            <span className="font-medium">ENG</span> <ChevronDown className="w-3 h-3 text-gray-400 ml-0.5" />
          </button>

          {/* Account */}
          <button
            onClick={() => navigate(isAuthenticated ? '/account' : '/login')}
            className="flex-shrink-0 -m-2 p-2 rounded-full text-gray-600 hover:text-purple-700 hover:bg-purple-50 transition-colors"
            aria-label={isAuthenticated ? `Account — ${customer?.name}` : 'Log in'}
            title={isAuthenticated ? customer?.name : 'Log in'}
          >
            <User className="w-[19px] h-[19px]" />
          </button>

          {/* Wishlist */}
          <button className="flex-shrink-0 relative -m-2 p-2 rounded-full text-gray-600 hover:text-purple-700 hover:bg-purple-50 transition-colors" aria-label="Wishlist">
            <Heart className="w-[19px] h-[19px]" />
            {wishlist.length > 0 && (
              <span className="absolute top-0.5 right-0.5 bg-purple-700 text-white text-[8px] w-[14px] h-[14px] rounded-full flex items-center justify-center font-bold">
                {wishlist.length}
              </span>
            )}
          </button>

          {/* Cart */}
          <button
            onClick={() => setCartOpen(true)}
            className="flex-shrink-0 relative -m-2 p-2 rounded-full text-gray-600 hover:text-purple-700 hover:bg-purple-50 transition-colors"
            aria-label="Shopping cart"
          >
            <ShoppingBag className="w-[19px] h-[19px]" />
            {itemCount > 0 && (
              <span className="absolute top-0.5 right-0.5 bg-purple-700 text-white text-[8px] w-[14px] h-[14px] rounded-full flex items-center justify-center font-bold" aria-label={`${itemCount} items in cart`}>
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {hasLiveMenu ? (
        <>
          {/* ── Row 2 (dynamic): Purple nav bar driven by the live Menu API ── */}
          <div className="bg-[#6B21A8] hidden lg:block">
            <div className="max-w-[1400px] mx-auto px-4 flex items-center h-[46px] overflow-x-auto">
              {liveItems.map((item) => {
                const isActive = location.pathname === item.url || location.pathname.startsWith(`${item.url}/`);
                return (
                <Link
                  key={item.id}
                  to={item.url}
                  onMouseEnter={() => item.children.length > 0 && openMegaMenu(item.id)}
                  onMouseLeave={scheduleMegaMenuClose}
                  onFocus={() => item.children.length > 0 && openMegaMenu(item.id)}
                  onBlur={scheduleMegaMenuClose}
                  onKeyDown={(e) => { if (e.key === 'Escape') setMegaMenu(null); }}
                  onClick={() => setActiveNav(item.label)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex-shrink-0 px-4 h-[46px] flex items-center gap-1 text-[13px] whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-inset ${
                    isActive
                      ? 'text-white font-semibold border-b-2 border-white'
                      : 'text-white/85 font-medium hover:text-white hover:bg-[#7C2BC2]'
                  }`}
                  style={UI}
                >
                  {item.label}
                  {item.megaMenu?.badge && <BadgeChip badge={item.megaMenu.badge} />}
                  {item.children.length > 0 && (
                    <ChevronDown className={`w-3 h-3 ml-0.5 opacity-70 transition-transform duration-200 ${megaMenu === item.id ? 'rotate-180' : ''}`} />
                  )}
                </Link>
                );
              })}
            </div>
          </div>

          {/* ── Dynamic mega menu / dropdown ── */}
          {/*
            `hidden lg:block` here (independent of the `megaMenu` state) is
            load-bearing, not decorative: the trigger nav bar above is itself
            `hidden lg:block`, but this panel previously had no matching
            breakpoint guard. Resizing (or rotating a tablet) below `lg`
            while a menu was open left the state as-is, and the panel kept
            rendering full-width with no trigger bar above it and no hover
            to close it on a touch device — a real stuck-open bug, not
            hypothetical. Tying its visibility to the same breakpoint as its
            trigger is simpler and more robust than a resize listener.
          */}
          {activeLiveItem && activeLiveItem.children.length > 0 && (
            <div
              onMouseEnter={cancelMegaMenuClose}
              onMouseLeave={scheduleMegaMenuClose}
              onFocus={cancelMegaMenuClose}
              onBlur={scheduleMegaMenuClose}
              onKeyDown={(e) => { if (e.key === 'Escape') setMegaMenu(null); }}
              className={`hidden lg:block animate-slide-in ${hasMegaMenuContent(activeLiveItem)
                ? 'lg:absolute top-full left-0 right-0 bg-white z-[200] shadow-[0_28px_56px_-16px_rgba(17,12,34,0.28),0_10px_20px_-8px_rgba(17,12,34,0.16)]'
                : 'lg:absolute top-full left-4 z-[200]'}`}
              role="navigation"
              aria-label={`${activeLiveItem.label} menu`}
            >
              {hasMegaMenuContent(activeLiveItem)
                ? <MegaMenuPanel item={activeLiveItem} currentPath={location.pathname} />
                : <DropdownPanel item={activeLiveItem} currentPath={location.pathname} />}
            </div>
          )}
        </>
      ) : menuLoading ? (
        /* ── Loading state — thin placeholder bar, no layout shift ── */
        <div className="bg-[#6B21A8] hidden lg:flex items-center justify-center h-[43px]">
          <Loader2 className="w-4 h-4 text-white/70 animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Row 2 (fallback): unchanged hardcoded nav — used until a store configures a live menu ── */}
          <div className="bg-[#6B21A8] hidden lg:block">
            <div className="max-w-[1400px] mx-auto px-4 flex items-center h-[43px] overflow-x-auto">
              {NAV_ITEMS.map(n => (
                <Link
                  key={n}
                  to={NAV_LINKS[n] ?? '/jewellery'}
                  onMouseEnter={() => openMegaMenu(n)}
                  onMouseLeave={scheduleMegaMenuClose}
                  onFocus={() => openMegaMenu(n)}
                  onBlur={scheduleMegaMenuClose}
                  onKeyDown={(e) => { if (e.key === 'Escape') setMegaMenu(null); }}
                  onClick={() => setActiveNav(n)}
                  className={`flex-shrink-0 px-3.5 h-[43px] flex items-center text-[13px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-inset ${
                    activeNav === n
                      ? 'text-white border-b-[3px] border-white'
                      : 'text-white/85 hover:text-white hover:bg-purple-700'
                  }`}
                  style={UI}
                >
                  {n}
                </Link>
              ))}
              <div className="ml-auto flex-shrink-0 pl-3">
                <button className="flex items-center gap-1 border border-white/40 text-white text-[12px] font-medium px-4 h-[30px] hover:bg-purple-700 transition-colors rounded-sm" style={UI}>
                  Services <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Fallback mega menu (unchanged) ── */}
          {megaMenu && (
            <div
              onMouseEnter={cancelMegaMenuClose}
              onMouseLeave={scheduleMegaMenuClose}
              onFocus={cancelMegaMenuClose}
              onBlur={scheduleMegaMenuClose}
              onKeyDown={(e) => { if (e.key === 'Escape') setMegaMenu(null); }}
              className="absolute top-full left-0 right-0 bg-white shadow-2xl z-[200] border-t border-purple-200"
              role="navigation"
              aria-label="Category menu"
            >
              <div className="max-w-[1400px] mx-auto px-6 py-7">
                <div className="grid grid-cols-[160px_200px_220px_180px_1fr] gap-8">

                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-purple-700 mb-4 pb-1 border-b border-purple-100" style={UI}>Featured</h4>
                    <ul className="space-y-3">
                      {GARMENT_MENU.featured.map(item => (
                        <li key={item}>
                          <Link to="/jewellery" className="text-[13px] text-gray-700 hover:text-purple-700 transition-colors" style={UI}>{item}</Link>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-4 pb-1 border-b border-gray-100" style={UI}>By Style</h4>
                    <ul className="space-y-2.5">
                      {GARMENT_MENU.byStyle.map(item => (
                        <li key={item}>
                          <Link to="/jewellery" className="text-[13px] text-gray-700 hover:text-purple-700 transition-colors" style={UI}>{item}</Link>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-4 pb-1 border-b border-gray-100" style={UI}>By Fabric</h4>
                    <ul className="space-y-2.5">
                      {GARMENT_MENU.byFabric.map(([icon, name]) => (
                        <li key={name}>
                          <Link to="/jewellery" className="flex items-center gap-2.5 text-[13px] text-gray-700 hover:text-purple-700 transition-colors" style={UI}>
                            <span className="w-[18px] h-[18px] rounded-full bg-gray-100 flex items-center justify-center text-[11px] flex-shrink-0">{icon}</span>
                            {name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-4 pb-1 border-b border-gray-100" style={UI}>By Budget</h4>
                    <ul className="space-y-2.5">
                      {GARMENT_MENU.byBudget.map(item => (
                        <li key={item}>
                          <Link to="/jewellery" className="text-[13px] text-gray-700 hover:text-purple-700 transition-colors" style={UI}>{item}</Link>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-3 justify-end">
                    {products.slice(0, 2).map((p, i) => (
                      <Link key={p.id} to={`/products/${p.id}`} className="group flex flex-col w-[140px]">
                        <div className="aspect-[3/4] overflow-hidden rounded-lg bg-purple-50">
                          <img
                            src={p.image}
                            alt={i === 0 ? 'New Arrivals' : 'Festive Picks'}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <p className="text-[11px] text-gray-600 text-center mt-2 font-medium" style={UI}>
                          {i === 0 ? 'New Arrivals' : 'Festive Picks'}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="flex gap-0 border-t border-gray-100 mt-6 pt-1">
                  {['For Women', 'For Men', 'For Kids'].map((tab, i) => (
                    <button
                      key={tab}
                      className={`px-6 py-3 text-[13px] font-semibold border-b-2 transition-colors ${
                        i === 0
                          ? 'border-purple-700 text-purple-700'
                          : 'border-transparent text-gray-600 hover:text-purple-700 hover:border-purple-300'
                      }`}
                      style={UI}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Mobile navigation drawer ── */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-[400] lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 animate-fade-in"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute top-0 left-0 bottom-0 w-[85%] max-w-[340px] bg-white shadow-2xl overflow-y-auto animate-slide-in-left">
            <div className="flex items-center justify-between px-5 h-[60px] border-b border-gray-100">
              <span className="text-[16px] font-bold text-gray-900" style={SERIF}>Menu</span>
              <button
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="-m-1.5 p-1.5 rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="py-1">
              {(hasLiveMenu ? liveItems : NAV_ITEMS.map((n, i) => ({
                id: `fallback-${i}`, label: n, url: NAV_LINKS[n] ?? '/jewellery',
                linkType: 'EXTERNAL_URL' as const, megaMenu: null, children: [],
              }))).map((item) => (
                <MobileNavItem key={item.id} item={item} depth={0} currentPath={location.pathname} onNavigate={() => setMobileNavOpen(false)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default AurusHeader;
