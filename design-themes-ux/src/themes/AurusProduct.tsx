import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, inr } from '@/context/StoreContext';
import { Product } from '@/data/products';
import { getReviews, getRelated, VARIANTS } from '@/data/reviews';
import CartDrawer from '@/components/CartDrawer';
// import ThemeSwitcher from '@/components/ThemeSwitcher';
import {
  Search, Heart, ShoppingBag, User, ChevronDown, ChevronLeft, ChevronRight,
  Store, Star, Share2, Home, Video, CreditCard, Shield, RotateCcw, Award,
  MapPin, Check, ThumbsUp, X,
} from 'lucide-react';

const UI   = { fontFamily: 'system-ui, -apple-system, sans-serif' };
const SERIF= { fontFamily: "'Cormorant Garamond', Georgia, 'Times New Roman', serif" };

const NAV_ITEMS = [
  'Sarees','Kurtas & Sets','Blouses','Lehenga','Dupattas',
  'Co-ord Sets','Festive Edit','Collections','New Arrivals','Gifting','Trending',
];
const NAV_LINKS: Record<string, string> = {
  'Sarees':        '/jewellery/sarees',
  'Kurtas & Sets': '/jewellery/kurtas',
  'Blouses':       '/jewellery/blouses',
  'Lehenga':       '/jewellery/lehenga',
  'Dupattas':      '/jewellery/dupattas',
  'Co-ord Sets':   '/jewellery/coord-sets',
  'Festive Edit':  '/jewellery/festive',
  'Collections':   '/jewellery/collections',
  'New Arrivals':  '/jewellery/new-arrivals',
  'Gifting':       '/jewellery/gifting',
  'Trending':      '/jewellery/trending',
};

const FABRIC_OPTIONS = [
  { label: 'Pure Silk',     color: '#B5892E', border: '#8B6A1E' },
  { label: 'Kanjivaram',   color: '#7B2D5C', border: '#5C2044' },
  { label: 'Cotton Linen', color: '#8B7355', border: '#6B5535' },
];

const GARMENT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'];

const REVIEW_FILTERS = ['All','Positive','With Photos','Verified','Most Recent'];

/* ── Star row ── */
const StarRow: React.FC<{ r: number; size?: number }> = ({ r, size = 13 }) => (
  <span className="inline-flex gap-0.5">
    {[1,2,3,4,5].map(i => (
      <Star
        key={i}
        style={{ width: size, height: size }}
        className={i <= Math.round(r) ? 'fill-[#F5A623] text-[#F5A623]' : 'text-gray-300'}
      />
    ))}
  </span>
);

/* ── Accordion ── */
const Acc: React.FC<{ title: string; children: React.ReactNode; open?: boolean }> = ({
  title, children, open: defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-3.5 text-[13px] font-semibold text-gray-800 hover:text-purple-700 transition-colors text-left"
        style={UI}
      >
        {title}
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="pb-4 text-[12.5px] text-gray-600 leading-relaxed" style={UI}>
          {children}
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════ */
const AurusProduct: React.FC<{ product: Product }> = ({ product }) => {
  const { addToCart, toggleWishlist, wishlist, cartCount, setCartOpen } = useStore();
  const related  = getRelated(product, 'aurus', 6);
  const reviews  = getReviews(product);
  const variant  = VARIANTS.aurus;

  const [activeImg,      setActiveImg]      = useState(0);
  const [selectedFabric, setSelectedFabric] = useState(FABRIC_OPTIONS[0].label);
  const [selectedSize,   setSelectedSize]   = useState('');
  const [pincode,        setPincode]        = useState('');
  const [deliveryMsg,    setDeliveryMsg]    = useState('');
  const [checking,       setChecking]       = useState(false);
  const [reviewFilter,   setReviewFilter]   = useState('All');
  const [searchQuery,    setSearchQuery]    = useState('');

  const images  = [product.image, ...related.slice(0,3).map(r => r.image)];
  const wished  = wishlist.includes(product.id);
  const disc    = Math.round(((product.mrp - product.price) / product.mrp) * 100);
  const savings = product.mrp - product.price;
  const emiAmt  = Math.round(product.price / 12);

  const checkDelivery = () => {
    if (pincode.length === 6) {
      setChecking(true);
      setDeliveryMsg('');
      setTimeout(() => { setDeliveryMsg('Delivery by Wed, 2 Jul 2026 — FREE'); setChecking(false); }, 900);
    }
  };

  return (
    <div className="min-h-screen bg-white" style={UI}>

      {/* ── Announcement bar ── */}
      <div className="bg-purple-950 text-white text-center text-[11px] py-2 tracking-wide" style={UI}>
        <span className="font-semibold">Flat 100% Off on Making Charges</span>
        <span className="mx-3 text-purple-400">•</span>Free Shipping on Orders Above ₹1,999
        <span className="mx-3 text-purple-400">•</span>15-Day Easy Exchange &amp; Returns
      </div>

      {/* ── Header Row 1 ── */}
      <header className="sticky top-0 z-50">
        <div className="bg-white border-b border-gray-100" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div className="max-w-[1400px] mx-auto px-4 h-[50px] flex items-center gap-3">
            <Link to="/jewellery/rings" className="flex-shrink-0 flex flex-col leading-none mr-1">
              <span className="text-[19px] font-bold tracking-[0.14em] text-gray-900 hover:text-purple-700 transition-colors" style={SERIF}>
                AURUS
              </span>
              <span className="text-[8px] text-gray-400 tracking-[0.22em] uppercase mt-px" style={UI}>Fine Jewellery</span>
            </Link>

            <div className="flex-1 max-w-[600px] flex h-[34px]">
              <input
                type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search for jewellery, occasions, styles…"
                className="flex-1 h-full pl-4 pr-3 text-[13px] border border-gray-300 border-r-0 outline-none focus:border-purple-500 bg-white"
                style={UI}
              />
              <button className="h-full px-4 bg-purple-700 hover:bg-purple-800 flex items-center justify-center flex-shrink-0 transition-colors">
                <Search className="w-[17px] h-[17px] text-white"/>
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2 flex-shrink-0">
              <button className="flex items-center gap-1.5 border border-gray-400 text-gray-700 rounded-full px-3 h-[30px] text-[11px] font-medium hover:bg-gray-50 whitespace-nowrap">
                <Store className="w-3.5 h-3.5"/> Stores
              </button>
            </div>

            <button className="flex-shrink-0 text-gray-600 hover:text-purple-700 transition-colors"><User className="w-[19px] h-[19px]"/></button>
            <button
              onClick={() => toggleWishlist(product.id)}
              className="flex-shrink-0 relative text-gray-600 hover:text-red-500 transition-colors"
            >
              <Heart className={`w-[19px] h-[19px] ${wished ? 'fill-red-500 text-red-500' : ''}`}/>
              {wishlist.length > 0 && <span className="absolute -top-1.5 -right-1.5 bg-purple-700 text-white text-[8px] w-[14px] h-[14px] rounded-full flex items-center justify-center font-bold">{wishlist.length}</span>}
            </button>
            <button onClick={() => setCartOpen(true)} className="flex-shrink-0 relative text-gray-600 hover:text-purple-700 transition-colors">
              <ShoppingBag className="w-[19px] h-[19px]"/>
              {cartCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-purple-700 text-white text-[8px] w-[14px] h-[14px] rounded-full flex items-center justify-center font-bold">{cartCount}</span>}
            </button>
          </div>
        </div>

        {/* Purple nav */}
        <div className="bg-[#6B21A8]">
          <div className="max-w-[1400px] mx-auto px-4 flex items-center h-[43px] overflow-x-auto">
            {NAV_ITEMS.map(n => (
              <Link
                key={n}
                to={NAV_LINKS[n] ?? '/jewellery'}
                className={`flex-shrink-0 px-3.5 h-[43px] flex items-center text-[13px] font-medium whitespace-nowrap transition-colors ${
                  product.category === n ? 'text-white border-b-[3px] border-white' : 'text-white/85 hover:text-white hover:bg-purple-700'
                }`}
                style={UI}
              >
                {n}
              </Link>
            ))}
            <div className="ml-auto flex-shrink-0 pl-2">
              <button className="flex items-center gap-1 border border-white/50 text-white text-[12px] font-medium px-4 h-8 hover:bg-purple-700 rounded-sm" style={UI}>
                Services <ChevronDown className="w-3.5 h-3.5"/>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Breadcrumb ── */}
      <div className="bg-white border-b border-gray-100 py-2.5">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-5 flex items-center gap-1.5 text-[11px] text-gray-400" style={UI}>
          <Link to="/" className="hover:text-purple-700 transition-colors">Home</Link>
          <ChevronRight className="w-3 h-3"/>
          <span className="text-gray-400">Jewellery</span>
          <ChevronRight className="w-3 h-3"/>
          <Link to="/jewellery/rings" className="hover:text-purple-700 transition-colors">{product.category}</Link>
          <ChevronRight className="w-3 h-3"/>
          <span className="text-gray-600 truncate max-w-[300px]">{product.name}</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          MAIN PDP — 2-column layout
      ══════════════════════════════════════════ */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-5 py-6">
        <div className="grid lg:grid-cols-2 gap-10 xl:gap-14 items-start">

          {/* ── LEFT: Gallery ── */}
          <div>
            {/* Main image with nav arrows */}
            <div className="relative bg-[#F8F6F8] overflow-hidden">
              <img
                src={images[activeImg]}
                alt={product.name}
                className="w-full aspect-square object-cover"
              />
              {/* Left arrow */}
              <button
                onClick={() => setActiveImg(i => (i - 1 + images.length) % images.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-md rounded-full p-2 transition-all"
              >
                <ChevronLeft className="w-4 h-4 text-gray-700"/>
              </button>
              {/* Right arrow */}
              <button
                onClick={() => setActiveImg(i => (i + 1) % images.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-md rounded-full p-2 transition-all"
              >
                <ChevronRight className="w-4 h-4 text-gray-700"/>
              </button>
              {/* Dot indicator */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeImg ? 'bg-purple-700 w-4' : 'bg-gray-400/60'}`}
                  />
                ))}
              </div>
            </div>

            {/* 2×2 thumbnail grid */}
            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
              {images.slice(0, 4).map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`relative aspect-square overflow-hidden bg-[#F8F6F8] transition-all ${
                    activeImg === i ? 'ring-2 ring-purple-600 ring-offset-1' : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`View ${i + 1}`} className="w-full h-full object-cover"/>
                </button>
              ))}
            </div>

            {/* Share row */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={() => toggleWishlist(product.id)}
                className="flex items-center gap-2 text-[12px] text-gray-600 hover:text-red-500 transition-colors"
                style={UI}
              >
                <Heart className={`w-4 h-4 ${wished ? 'fill-red-500 text-red-500' : ''}`}/>
                {wished ? 'Wishlisted' : 'Add to Wishlist'}
              </button>
              <div className="flex items-center gap-1 text-[12px] text-gray-500" style={UI}>
                <Share2 className="w-4 h-4"/>
                <span>Share</span>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Product Info ── */}
          <div>
            {/* Category */}
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-purple-600 mb-1" style={UI}>
              Fine Jewellery &rsaquo; {product.category}
            </p>

            {/* Name */}
            <h1 className="text-[26px] sm:text-[30px] font-light text-gray-900 leading-tight" style={SERIF}>
              {product.name}
            </h1>

            {/* Rating */}
            <div className="flex items-center gap-2 mt-2.5" style={UI}>
              <StarRow r={product.rating} size={14}/>
              <span className="text-[13px] font-bold text-gray-800">{product.rating}</span>
              <span className="text-[12px] text-purple-600 underline underline-offset-2 cursor-pointer hover:text-purple-800">
                {product.reviews} Reviews
              </span>
            </div>

            <div className="h-px bg-gray-200 my-4"/>

            {/* Price block */}
            <div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-[28px] font-bold text-gray-900" style={UI}>{inr(product.price)}</span>
                <span className="text-[16px] text-gray-400 line-through">{inr(product.mrp)}</span>
                <span className="text-[12px] font-bold text-white bg-[#E91E8C] px-2.5 py-0.5 rounded-sm">
                  {disc}% OFF
                </span>
              </div>
              <p className="text-[12px] text-gray-500 mt-1" style={UI}>
                You save <span className="font-semibold text-gray-700">{inr(savings)}</span> (incl. of all taxes)
              </p>
            </div>

            {/* Making charges banner */}
            <div className="mt-3 flex items-center gap-2 bg-[#E8F5E9] border border-[#C8E6C9] px-3.5 py-2.5 rounded-sm">
              <Check className="w-4 h-4 text-[#2E7D32] flex-shrink-0"/>
              <span className="text-[12px] font-semibold text-[#1B5E20]" style={UI}>
                Flat 100% Off on Making Charges
              </span>
            </div>

            <div className="h-px bg-gray-200 my-5"/>

            {/* Fabric selector */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-600 mb-3" style={UI}>
                Fabric &amp; Material
              </p>
              <div className="flex gap-5">
                {FABRIC_OPTIONS.map(f => {
                  const sel = selectedFabric === f.label;
                  return (
                    <button
                      key={f.label}
                      onClick={() => setSelectedFabric(f.label)}
                      className="flex flex-col items-center gap-1.5 group"
                    >
                      <div
                        className="w-9 h-9 rounded-full transition-all"
                        style={{
                          background: f.color,
                          border: sel ? `3px solid ${f.border}` : '2.5px solid transparent',
                          outline: sel ? `2px solid ${f.border}` : '2px solid transparent',
                          outlineOffset: 2,
                        }}
                      />
                      <span
                        className="text-[10px] text-center leading-tight max-w-[64px]"
                        style={{ ...UI, color: sel ? '#4C1D95' : '#555', fontWeight: sel ? 700 : 400 }}
                      >
                        {f.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Garment size */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-600" style={UI}>Size</p>
                <button className="text-[11px] text-purple-600 underline underline-offset-2 hover:text-purple-800 transition-colors" style={UI}>
                  Size Guide
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {GARMENT_SIZES.map(sz => (
                  <button
                    key={sz}
                    onClick={() => setSelectedSize(sz)}
                    className={`px-4 h-10 text-[12px] border transition-all duration-150 font-medium rounded-sm ${
                      selectedSize === sz
                        ? 'border-purple-700 bg-purple-700 text-white'
                        : 'border-gray-300 text-gray-700 hover:border-purple-400 hover:text-purple-700'
                    }`}
                    style={UI}
                  >
                    {sz}
                  </button>
                ))}
              </div>
              {!selectedSize && (
                <p className="text-[11px] text-orange-600 mt-2" style={UI}>Please select a size</p>
              )}
            </div>

            <div className="h-px bg-gray-200 my-5"/>

            {/* Delivery checker */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0"/>
                <span className="text-[13px] font-semibold text-gray-800" style={UI}>Delivery &amp; Stores</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={pincode}
                  onChange={e => { setPincode(e.target.value.slice(0, 6)); setDeliveryMsg(''); }}
                  placeholder="Enter Pincode"
                  className="w-[160px] border border-gray-300 px-3 py-2 text-[12px] outline-none focus:border-purple-600 transition-colors rounded-sm"
                  style={UI}
                />
                <button
                  onClick={checkDelivery}
                  disabled={pincode.length !== 6 || checking}
                  className="border border-purple-700 text-purple-700 hover:bg-purple-700 hover:text-white disabled:opacity-40 px-5 py-2 text-[12px] font-semibold transition-all rounded-sm"
                  style={UI}
                >
                  {checking ? '…' : 'Check'}
                </button>
              </div>
              {deliveryMsg && (
                <p className="text-[12px] text-[#2E7D32] font-semibold mt-2 flex items-center gap-1.5" style={UI}>
                  <Check className="w-3.5 h-3.5"/>
                  {deliveryMsg}
                </p>
              )}
              <div className="flex gap-3 mt-3">
                <div className="flex items-center gap-1.5 text-[11px] text-gray-600" style={UI}>
                  <div className="w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-purple-600"/>
                  </div>
                  Fastest delivery in 2-7 days
                </div>
              </div>
            </div>

            {/* Try at Home / Video Call */}
            <div className="flex flex-wrap gap-3 mt-4">
              {product.tryAtHome && (
                <button className="flex items-center gap-2 bg-[#E0F2F1] border border-[#B2DFDB] text-[#00695C] px-4 py-2.5 rounded-sm text-[12px] font-semibold hover:bg-[#B2DFDB] transition-colors" style={UI}>
                  <Home className="w-4 h-4"/>
                  Try at Home
                </button>
              )}
              <button className="flex items-center gap-2 bg-[#F3E5F5] border border-[#CE93D8] text-[#6A1B9A] px-4 py-2.5 rounded-sm text-[12px] font-semibold hover:bg-[#CE93D8] transition-colors" style={UI}>
                <Video className="w-4 h-4"/>
                Video Call
              </button>
            </div>

            {/* CTA */}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => addToCart(product)}
                className="flex-1 bg-[#6B21A8] hover:bg-[#581C87] text-white py-3.5 text-[14px] font-bold tracking-wide transition-colors rounded-sm"
                style={UI}
              >
                ADD TO BAG
              </button>
              <button
                onClick={() => toggleWishlist(product.id)}
                className={`px-4 py-3.5 border-2 rounded-sm transition-colors ${wished ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-red-400'}`}
              >
                <Heart className={`w-5 h-5 ${wished ? 'fill-red-500 text-red-500' : 'text-gray-500'}`}/>
              </button>
            </div>

            {/* EMI */}
            <div className="flex items-center gap-2.5 mt-4 p-3 bg-[#FAFAF8] border border-gray-200 rounded-sm">
              <CreditCard className="w-4 h-4 text-purple-600 flex-shrink-0"/>
              <p className="text-[12px] text-gray-700" style={UI}>
                EMI from <strong className="text-gray-900">{inr(emiAmt)}/month</strong> · 0% interest on 3-month plans
                <button className="text-purple-600 ml-2 hover:underline underline-offset-2 text-[11px]">View Plans</button>
              </p>
            </div>

            <div className="h-px bg-gray-200 my-5"/>

            {/* Accordion */}
            <Acc title="Product Details" open>
              <ul className="space-y-1.5">
                <li><span className="font-semibold text-gray-700">SKU:</span> {product.id.toUpperCase()}</li>
                <li><span className="font-semibold text-gray-700">Category:</span> {product.category}</li>
                <li><span className="font-semibold text-gray-700">Style:</span> Everyday wear</li>
                <li><span className="font-semibold text-gray-700">Occasion:</span> Casual, Gifting, Festive</li>
                <li><span className="font-semibold text-gray-700">Description:</span> {product.desc}</li>
              </ul>
            </Acc>

            <Acc title="Fabric &amp; Material Details">
              <ul className="space-y-1.5">
                <li><span className="font-semibold text-gray-700">Fabric:</span> {selectedFabric}</li>
                <li><span className="font-semibold text-gray-700">Weave:</span> Handloom</li>
                <li><span className="font-semibold text-gray-700">Length:</span> 5.5 m (with blouse piece)</li>
                <li><span className="font-semibold text-gray-700">Wash Care:</span> Dry Clean Only</li>
                <li><span className="font-semibold text-gray-700">Origin:</span> Made in India</li>
              </ul>
            </Acc>

            <Acc title="Stone Details">
              <ul className="space-y-1.5">
                <li><span className="font-semibold text-gray-700">Stone:</span> Natural Diamond</li>
                <li><span className="font-semibold text-gray-700">No. of Stones:</span> 5</li>
                <li><span className="font-semibold text-gray-700">Total Carat Weight:</span> 0.07 cts</li>
                <li><span className="font-semibold text-gray-700">Colour:</span> G–H</li>
                <li><span className="font-semibold text-gray-700">Clarity:</span> SI1–SI2</li>
                <li><span className="font-semibold text-gray-700">Setting:</span> Prong</li>
              </ul>
            </Acc>

            <Acc title="Care Instructions">
              <p>Store in the pouch provided. Avoid contact with perfumes, lotions, and cleaning agents. Clean with a soft dry cloth. Avoid while swimming or exercising. Get professionally cleaned every 6 months.</p>
            </Acc>

            <Acc title="Return &amp; Exchange Policy">
              <p>15-day return policy from date of delivery. Items must be unused, undamaged, and in original packaging with all certificates. Exchange available for manufacturing defects. Customised and engraved pieces cannot be returned.</p>
            </Acc>

            {/* Trust strip */}
            <div className="mt-6 pt-5 border-t border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {([
                [Award,    'BIS Certified',   'Hallmarked jewellery'],
                [Shield,   'IGI Certified',   'Conflict-free diamonds'],
                [RotateCcw,'15-Day Return',   'Easy & free returns'],
                [Home,     '100% Genuine',    'Ethically sourced'],
              ] as const).map(([Icon, title, sub]: any, i) => (
                <div key={i} className="text-center">
                  <Icon className="w-5 h-5 mx-auto text-purple-600" strokeWidth={1.5}/>
                  <p className="text-[10px] font-bold text-gray-800 mt-1.5" style={UI}>{title}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5" style={UI}>{sub}</p>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          CUSTOMER REVIEWS
      ══════════════════════════════════════════ */}
      <section className="bg-[#FAFAF8] border-t border-gray-200 py-12">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-5">

          {/* Header row */}
          <div className="flex items-center justify-between mb-7 flex-wrap gap-4">
            <h2 className="text-[22px] font-semibold text-gray-900" style={UI}>
              Customer Reviews
            </h2>
            <button className="border border-purple-700 text-purple-700 hover:bg-purple-700 hover:text-white px-5 py-2.5 text-[12px] font-bold tracking-wide transition-all rounded-sm" style={UI}>
              WRITE A REVIEW
            </button>
          </div>

          {/* Summary row */}
          <div className="flex flex-col sm:flex-row gap-8 mb-8 pb-7 border-b border-gray-200">
            {/* Left: big score */}
            <div className="text-center flex-shrink-0">
              <p className="text-[52px] font-light text-gray-900 leading-none" style={SERIF}>
                {product.rating}
              </p>
              <StarRow r={product.rating} size={16}/>
              <p className="text-[12px] text-gray-500 mt-1" style={UI}>{product.reviews} Reviews</p>
            </div>

            {/* Right: bar chart */}
            <div className="flex-1 space-y-2" style={UI}>
              {([
                [5, 62], [4, 24], [3, 9], [2, 3], [1, 2],
              ] as [number, number][]).map(([star, pct]) => (
                <div key={star} className="flex items-center gap-3">
                  <span className="text-[12px] text-gray-600 w-4 text-right">{star}</span>
                  <Star className="w-3 h-3 fill-[#F5A623] text-[#F5A623] flex-shrink-0"/>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div className="bg-[#F5A623] h-2 rounded-full transition-all" style={{ width: `${pct}%` }}/>
                  </div>
                  <span className="text-[11px] text-gray-400 w-8">{pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
            {REVIEW_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setReviewFilter(f)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-[12px] font-medium border transition-all ${
                  reviewFilter === f
                    ? 'bg-purple-700 text-white border-purple-700'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'
                }`}
                style={UI}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Count */}
          <p className="text-[12px] text-gray-500 mb-5" style={UI}>
            Showing 1–{Math.min(reviews.length, 5)} of <span className="font-semibold text-gray-700">{product.reviews}</span> reviews
          </p>

          {/* Review cards */}
          <div className="grid md:grid-cols-2 gap-4">
            {reviews.slice(0, 6).map((rv, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-sm p-5">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-[13px] font-bold text-purple-700">{rv.name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <div>
                        <span className="text-[13px] font-semibold text-gray-800" style={UI}>{rv.name}</span>
                        <span className="ml-2 text-[10px] bg-[#E8F5E9] text-[#1B5E20] font-semibold px-2 py-0.5 rounded-full" style={UI}>
                          Verified Buyer
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-400" style={UI}>{rv.date}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <StarRow r={rv.rating} size={12}/>
                    </div>
                  </div>
                  {/* Product thumb */}
                  <img
                    src={product.image}
                    alt=""
                    className="w-12 h-12 object-cover bg-gray-100 flex-shrink-0 rounded-sm"
                  />
                </div>
                <p className="text-[13px] font-semibold text-gray-800 mt-3 mb-1" style={UI}>{rv.title}</p>
                <p className="text-[12px] text-gray-600 leading-relaxed" style={UI}>{rv.body}</p>
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
                  <button className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-purple-700 transition-colors" style={UI}>
                    <ThumbsUp className="w-3.5 h-3.5"/>
                    Helpful ({3 + i})
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-1.5 mt-8" style={UI}>
            <button className="w-8 h-8 flex items-center justify-center text-[13px] text-gray-500 hover:text-purple-700 border border-transparent hover:border-purple-200 rounded-sm transition-all">
              <ChevronLeft className="w-4 h-4"/>
            </button>
            {[1,2,3,4,5].map(p => (
              <button
                key={p}
                className={`w-8 h-8 flex items-center justify-center text-[13px] rounded-sm transition-all border ${
                  p === 1 ? 'bg-purple-700 text-white border-purple-700' : 'text-gray-600 border-gray-200 hover:border-purple-400 hover:text-purple-700'
                }`}
              >
                {p}
              </button>
            ))}
            <span className="px-2 text-gray-400 text-[13px]">…</span>
            <button className="w-8 h-8 flex items-center justify-center text-[13px] text-gray-500 hover:text-purple-700 border border-gray-200 hover:border-purple-200 rounded-sm transition-all">
              <ChevronRight className="w-4 h-4"/>
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          YOU MAY ALSO LIKE
      ══════════════════════════════════════════ */}
      <section className="bg-white border-t border-gray-100 py-12">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[20px] font-semibold text-gray-900" style={UI}>You May Also Like</h2>
            <div className="flex gap-2">
              <button className="w-8 h-8 border border-gray-300 hover:border-purple-500 rounded-full flex items-center justify-center transition-colors">
                <ChevronLeft className="w-4 h-4 text-gray-600"/>
              </button>
              <button className="w-8 h-8 border border-gray-300 hover:border-purple-500 rounded-full flex items-center justify-center transition-colors">
                <ChevronRight className="w-4 h-4 text-gray-600"/>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {related.map((p, i) => {
              const d = Math.round(((p.mrp - p.price) / p.mrp) * 100);
              const w = wishlist.includes(p.id);
              return (
                <div key={`${p.id}-${i}`} className="group bg-white border border-gray-100 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  <div className="relative aspect-square bg-[#F8F6F8] overflow-hidden">
                    {p.badge && (
                      <span className={`absolute top-2 left-2 z-10 text-white text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${p.badge === 'Bestseller' ? 'bg-[#B01F24]' : 'bg-purple-600'}`}>
                        {p.badge}
                      </span>
                    )}
                    <button
                      onClick={() => toggleWishlist(p.id)}
                      className="absolute top-2 right-2 z-10 bg-white/90 rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Heart className={`w-3 h-3 ${w ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}/>
                    </button>
                    <Link to={`/products/${p.id}`}>
                      <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                    </Link>
                  </div>
                  <div className="p-2.5">
                    <div className="flex gap-2 mb-1.5">
                      {p.tryAtHome && <span className="text-[8px] font-semibold text-[#00796B]">Try at Home</span>}
                      <span className="text-[8px] font-semibold text-purple-600">Video Call</span>
                    </div>
                    <Link to={`/products/${p.id}`}>
                      <p className="text-[11px] text-gray-800 line-clamp-2 hover:text-purple-700 transition-colors leading-snug" style={UI}>
                        {p.name}
                      </p>
                    </Link>
                    <div className="flex items-center gap-0.5 mt-1">
                      <StarRow r={p.rating} size={9}/>
                      <span className="text-[9px] text-gray-400 ml-0.5">({p.reviews})</span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1 flex-wrap">
                      <span className="text-[12px] font-bold text-gray-900" style={UI}>{inr(p.price)}</span>
                      <span className="text-[10px] text-gray-400 line-through">{inr(p.mrp)}</span>
                      <span className="text-[9px] font-bold text-emerald-700">{d}% off</span>
                    </div>
                  </div>
                  <div className="flex border-t border-gray-100">
                    <Link to={`/products/${p.id}`} className="flex-1 text-center py-2 text-[10px] text-gray-500 hover:text-purple-700 hover:bg-purple-50 transition-colors font-medium" style={UI}>
                      View Similar
                    </Link>
                    <div className="w-px bg-gray-100"/>
                    <button onClick={() => addToCart(p)} className="flex-1 py-2 text-[10px] text-gray-500 hover:text-purple-700 hover:bg-purple-50 transition-colors font-medium" style={UI}>
                      Add to Bag
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          APP DOWNLOAD BANNER
      ══════════════════════════════════════════ */}
      <section
        className="py-10 px-4"
        style={{ background: 'linear-gradient(135deg, #2E0E5C 0%, #6B21A8 60%, #7C3AED 100%)' }}
      >
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-purple-300 text-[11px] tracking-[0.3em] uppercase mb-2" style={UI}>Mobile App</p>
            <h3 className="text-white text-[22px] font-light leading-tight" style={SERIF}>
              Download the Aurus App
            </h3>
            <p className="text-purple-200 text-[13px] mt-1.5" style={UI}>
              Get exclusive app-only offers · Try at Home · Video Consultation
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <button className="bg-black text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-gray-900 transition-colors" style={UI}>
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              <div className="text-left">
                <p className="text-[8px] text-gray-300">Download on the</p>
                <p className="text-[13px] font-semibold leading-none">App Store</p>
              </div>
            </button>
            <button className="bg-black text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-gray-900 transition-colors" style={UI}>
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M3.18 23.76c.3.17.64.24.99.2l12.6-7.27-2.7-2.7-10.89 9.77zm14.16-8.18 2.77-1.6c.78-.45.78-1.52 0-1.97l-2.77-1.6-2.94 2.94 2.94 3.23zM3.02.28C2.68.12 2.3.12 1.97.28L14.36 12.7 3.02.28zm1.15.66 10.89 9.77-2.7 2.7L4.17.94z"/></svg>
              <div className="text-left">
                <p className="text-[8px] text-gray-300">Get it on</p>
                <p className="text-[13px] font-semibold leading-none">Google Play</p>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════ */}
      <footer className="bg-white border-t border-gray-200" style={UI}>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-5 py-12 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-8 text-[13px] text-gray-600">
          {/* Brand col */}
          <div className="col-span-2 sm:col-span-1">
            <span className="text-[20px] font-bold tracking-[0.14em] text-gray-900" style={SERIF}>AURUS</span>
            <p className="text-[10px] text-gray-400 tracking-[0.2em] uppercase mt-0.5">Fine Jewellery</p>
            <p className="text-[12px] text-gray-500 mt-3 leading-relaxed">
              Certified fine jewellery crafted to be treasured for a lifetime.
            </p>
          </div>

          {[
            ['Fine Jewellery', ['Rings','Earrings','Necklaces','Bracelets','Mangalsutras','Solitaires']],
            ['Customer Care',  ['Track Order','FAQ','Contact Us','Stores Near Me','Career Guide','Size Guide']],
            ['Company',        ['About Us','Careers','Sustainability','Press','Blog']],
            ['Policies',       ['Privacy Policy','Terms of Service','Return Policy','Shipping Policy']],
          ].map(([h, items]: any) => (
            <div key={h}>
              <h5 className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-900 mb-3">{h}</h5>
              <ul className="space-y-2">
                {items.map((item: string) => (
                  <li key={item}><a href="#" className="text-[12px] text-gray-500 hover:text-purple-700 transition-colors">{item}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 py-4 px-4">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between flex-wrap gap-3">
            <p className="text-[11px] text-gray-400">© 2026 Aurus Fine Jewellery Pvt. Ltd. All rights reserved.</p>
            <div className="flex gap-4">
              {['VISA','Mastercard','UPI','EMI'].map(p => (
                <span key={p} className="text-[10px] font-bold text-gray-400 border border-gray-200 px-2 py-0.5 rounded">{p}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <CartDrawer accentClass="bg-purple-800" fontClass="font-sans"/>
      {/* <ThemeSwitcher/> */}
    </div>
  );
};

export default AurusProduct;
