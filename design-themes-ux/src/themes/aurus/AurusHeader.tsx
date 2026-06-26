import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '@/context/StoreContext';
import {
  Search, Heart, ShoppingBag, User, ChevronDown, Store,
} from 'lucide-react';
import { NAV_ITEMS, NAV_LINKS, GARMENT_MENU, UI, SERIF } from './constants';
import { THEME_META, PRODUCTS } from '@/data/products';

interface Props {
  /** Initial active nav item */
  activeNav?: string;
  /** Controlled search value — parent handles filtering */
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit?: (q: string) => void;
}

const AurusHeader: React.FC<Props> = ({
  activeNav: initialNav = 'Sarees',
  searchQuery,
  onSearchChange,
  onSearchSubmit,
}) => {
  const { wishlist, cartCount, setCartOpen } = useStore();
  const navigate = useNavigate();

  const [activeNav,      setActiveNav]      = useState(initialNav);
  const [megaMenu,       setMegaMenu]       = useState<string | null>(null);
  const [pincodeOpen,    setPincodeOpen]    = useState(false);
  const [headerPin,      setHeaderPin]      = useState('');
  const [pinSaved,       setPinSaved]       = useState('');
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const meta     = THEME_META.aurus;
  const products = PRODUCTS.aurus;

  const openMegaMenu = (name: string) => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setMegaMenu(name);
  };
  const scheduleMegaMenuClose = () => {
    closeTimerRef.current = setTimeout(() => setMegaMenu(null), 200);
  };
  const cancelMegaMenuClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  };

  const handleSearchSubmit = () => {
    if (onSearchSubmit) {
      onSearchSubmit(searchQuery);
    } else {
      navigate(`/jewellery/rings?q=${encodeURIComponent(searchQuery)}`);
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
        <div className="max-w-[1400px] mx-auto px-4 h-[50px] flex items-center gap-3">

          {/* Logo */}
          <Link to="/" className="flex-shrink-0 flex flex-col leading-none mr-1 group">
            <span
              className="text-[19px] font-bold tracking-[0.14em] text-gray-900 group-hover:text-purple-700 transition-colors"
              style={SERIF}
            >
              {meta.brand.toUpperCase()}
            </span>
            <span className="text-[8px] text-gray-400 tracking-[0.22em] uppercase mt-px" style={UI}>Fine Jewellery</span>
          </Link>

          {/* Search bar */}
          <div className="flex-1 max-w-[600px] flex h-[34px]">
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearchSubmit()}
              placeholder="Search for jewellery, styles, occasions…"
              className="flex-1 h-full pl-4 pr-3 text-[14px] border border-gray-300 border-r-0 outline-none focus:border-purple-500 bg-white transition-colors"
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
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <button className="relative flex items-center gap-1.5 border border-pink-500 text-pink-600 rounded-full px-3 h-[30px] text-[11px] font-semibold hover:bg-pink-50 transition-colors whitespace-nowrap">
              <span className="absolute -top-[10px] left-2.5 bg-red-600 text-white text-[7px] font-black px-1.5 py-px rounded-sm tracking-wider uppercase">SALE</span>
              🎀 Festive Sale
            </button>
            <button className="flex items-center gap-1.5 border border-gray-400 text-gray-700 rounded-full px-3 h-[30px] text-[11px] font-medium hover:bg-gray-50 transition-colors whitespace-nowrap">
              <Store className="w-3.5 h-3.5" /> Style Guide
            </button>
            <button className="flex items-center gap-1.5 border-2 border-purple-400 text-purple-700 bg-purple-50 rounded-full px-3 h-[30px] text-[11px] font-bold hover:bg-purple-100 transition-colors whitespace-nowrap">
              <span className="w-[14px] h-[14px] rounded-full bg-purple-500 flex items-center justify-center text-[8px] font-black text-white">✦</span>
              New Drop
            </button>
          </div>

          {/* Delivery & Pincode */}
          <div className="hidden xl:flex flex-col items-end flex-shrink-0 border-l border-gray-200 pl-3 relative">
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
          <button
            className="hidden xl:flex items-center gap-0.5 text-[12px] text-gray-600 border-l border-gray-200 pl-3 flex-shrink-0 hover:text-purple-700 transition-colors"
            aria-label="Select language"
          >
            🇮🇳 <span className="ml-1 font-medium">ENG</span> <ChevronDown className="w-3 h-3 text-gray-400 ml-0.5" />
          </button>

          {/* Account */}
          <button className="flex-shrink-0 text-gray-600 hover:text-purple-700 transition-colors" aria-label="Account">
            <User className="w-[19px] h-[19px]" />
          </button>

          {/* Wishlist */}
          <button className="flex-shrink-0 relative text-gray-600 hover:text-purple-700 transition-colors" aria-label="Wishlist">
            <Heart className="w-[19px] h-[19px]" />
            {wishlist.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-purple-700 text-white text-[8px] w-[14px] h-[14px] rounded-full flex items-center justify-center font-bold">
                {wishlist.length}
              </span>
            )}
          </button>

          {/* Cart */}
          <button
            onClick={() => setCartOpen(true)}
            className="flex-shrink-0 relative text-gray-600 hover:text-purple-700 transition-colors"
            aria-label="Shopping cart"
          >
            <ShoppingBag className="w-[19px] h-[19px]" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-purple-700 text-white text-[8px] w-[14px] h-[14px] rounded-full flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Row 2: Purple nav bar ── */}
      <div className="bg-[#6B21A8]">
        <div className="max-w-[1400px] mx-auto px-4 flex items-center h-[43px] overflow-x-auto">
          {NAV_ITEMS.map(n => (
            <Link
              key={n}
              to={NAV_LINKS[n] ?? '/jewellery'}
              onMouseEnter={() => openMegaMenu(n)}
              onMouseLeave={scheduleMegaMenuClose}
              onClick={() => setActiveNav(n)}
              className={`flex-shrink-0 px-3.5 h-[43px] flex items-center text-[13px] font-medium whitespace-nowrap transition-colors ${
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

      {/* ── Mega menu ── */}
      {megaMenu && (
        <div
          onMouseEnter={cancelMegaMenuClose}
          onMouseLeave={scheduleMegaMenuClose}
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
                      <Link to="/jewellery/rings" className="text-[13px] text-gray-700 hover:text-purple-700 transition-colors" style={UI}>{item}</Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-4 pb-1 border-b border-gray-100" style={UI}>By Style</h4>
                <ul className="space-y-2.5">
                  {GARMENT_MENU.byStyle.map(item => (
                    <li key={item}>
                      <Link to="/jewellery/rings" className="text-[13px] text-gray-700 hover:text-purple-700 transition-colors" style={UI}>{item}</Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-4 pb-1 border-b border-gray-100" style={UI}>By Fabric</h4>
                <ul className="space-y-2.5">
                  {GARMENT_MENU.byFabric.map(([icon, name]) => (
                    <li key={name}>
                      <Link to="/jewellery/rings" className="flex items-center gap-2.5 text-[13px] text-gray-700 hover:text-purple-700 transition-colors" style={UI}>
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
                      <Link to="/jewellery/rings" className="text-[13px] text-gray-700 hover:text-purple-700 transition-colors" style={UI}>{item}</Link>
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
    </header>
  );
};

export default AurusHeader;
