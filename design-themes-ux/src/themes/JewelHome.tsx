import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, inr } from '@/context/StoreContext';
import { PRODUCTS, CATEGORIES, HERO_IMAGES, THEME_META } from '@/data/products';
import { Search, Heart, ShoppingBag, User, ChevronRight, ShieldCheck, Gem, RotateCcw, Sparkles } from 'lucide-react';
import CartDrawer from '@/components/CartDrawer';

const ACCENT = 'bg-rose-900';

const JewelHome: React.FC = () => {
  const { addToCart, toggleWishlist, wishlist, cartCount, setCartOpen } = useStore();
  const products = PRODUCTS.jewel;
  const cats = CATEGORIES.jewel;
  const meta = THEME_META.jewel;
  const [search, setSearch] = useState(false);

  return (
    <div className="min-h-screen bg-white text-neutral-800" style={{ fontFamily: 'Georgia, serif' }}>
      {/* slim top */}
      <div className="bg-neutral-900 text-neutral-200 text-center text-[11px] tracking-[0.25em] uppercase py-2">
        Complimentary Shipping & Lifetime Exchange on Every Order
      </div>

      {/* minimal header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-neutral-100">
        <div className="max-w-7xl mx-auto px-6 py-5 grid grid-cols-3 items-center">
          <nav className="hidden md:flex gap-7 text-xs tracking-[0.2em] uppercase text-neutral-600" style={{ fontFamily: 'system-ui' }}>
            {['Rings', 'Earrings', 'Necklaces'].map(n => <a key={n} href="#collections" className="hover:text-rose-900">{n}</a>)}
          </nav>
          <div className="text-center">
            <h1 className="text-3xl tracking-[0.35em] font-light text-neutral-900">{meta.brand.toUpperCase()}</h1>
            <p className="text-[9px] tracking-[0.4em] text-rose-700 mt-1" style={{ fontFamily: 'system-ui' }}>FINE JEWELLERY</p>
          </div>
          <div className="flex items-center justify-end gap-6 text-neutral-700">
            <button onClick={() => setSearch(s => !s)}><Search className="w-5 h-5" /></button>
            <button className="hidden sm:block"><User className="w-5 h-5" /></button>
            <Heart className="w-5 h-5" />
            <button onClick={() => setCartOpen(true)} className="relative">
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && <span className="absolute -top-2 -right-2 bg-rose-900 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">{cartCount}</span>}
            </button>
          </div>
        </div>
        {search && (
          <div className="border-t border-neutral-100 py-3">
            <input autoFocus placeholder="Search for the perfect piece..." className="max-w-2xl mx-auto block w-full text-center text-lg outline-none px-6" style={{ fontFamily: 'system-ui' }} />
          </div>
        )}
      </header>

      {/* quiet luxury hero */}
      <section className="relative">
        <img src={HERO_IMAGES.jewel} alt="hero" className="w-full h-[480px] sm:h-[600px] object-cover" />
        <div className="absolute inset-0 flex items-center justify-center text-center">
          <div className="bg-white/0">
            <p className="text-white/90 text-xs tracking-[0.4em] uppercase mb-4" style={{ fontFamily: 'system-ui' }}>The New Collection</p>
            <h2 className="text-5xl sm:text-7xl text-white font-light leading-tight">{meta.tagline}</h2>
            <a href="#collections" className="inline-block mt-8 border border-white text-white px-10 py-3.5 text-xs tracking-[0.25em] uppercase hover:bg-white hover:text-neutral-900 transition" style={{ fontFamily: 'system-ui' }}>
              Discover
            </a>
          </div>
        </div>
      </section>

      {/* trust row */}
      <section className="border-b border-neutral-100">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 py-10 text-center" style={{ fontFamily: 'system-ui' }}>
          {[[ShieldCheck, 'Certified', 'IGI & GIA Certified'], [Gem, '100% Natural', 'Conflict-free diamonds'], [RotateCcw, '30-Day Returns', 'Easy & free'], [Sparkles, 'Lifetime Care', 'Free cleaning']].map(([Icon, t, s]: any, i) => (
            <div key={i}>
              <Icon className="w-7 h-7 mx-auto text-rose-800" strokeWidth={1.2} />
              <p className="mt-3 text-sm font-medium text-neutral-800">{t}</p>
              <p className="text-xs text-neutral-500">{s}</p>
            </div>
          ))}
        </div>
      </section>

      {/* collections - airy */}
      <section id="collections" className="max-w-6xl mx-auto px-6 py-20 text-center">
        <p className="text-rose-700 text-xs tracking-[0.35em] uppercase" style={{ fontFamily: 'system-ui' }}>Explore</p>
        <h3 className="text-4xl font-light mt-3 text-neutral-900">Shop by Category</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mt-14">
          {cats.map(c => (
            <a key={c.name} href="#shop" className="group">
              <div className="aspect-square rounded-full overflow-hidden bg-neutral-50 border border-neutral-100">
                <img src={c.img} alt={c.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-700" />
              </div>
              <p className="mt-5 text-sm tracking-[0.2em] uppercase text-neutral-700 group-hover:text-rose-900" style={{ fontFamily: 'system-ui' }}>{c.name}</p>
            </a>
          ))}
        </div>
      </section>

      {/* full bleed feature */}
      <section className="bg-rose-50/50 py-20">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <img src={products[6].image} alt="feature" className="rounded-sm shadow-xl w-full h-[420px] object-cover" />
          <div>
            <p className="text-rose-700 text-xs tracking-[0.35em] uppercase" style={{ fontFamily: 'system-ui' }}>Signature</p>
            <h3 className="text-4xl font-light mt-3 text-neutral-900 leading-snug">The Solitaire Edit</h3>
            <p className="mt-5 text-neutral-600 leading-relaxed" style={{ fontFamily: 'system-ui' }}>Designed for the moments that matter most. Hand-set brilliant-cut diamonds in recycled 18k gold — crafted to be treasured for generations.</p>
            <button className="mt-8 inline-flex items-center gap-2 text-sm tracking-[0.2em] uppercase border-b-2 border-rose-900 pb-1 text-rose-900" style={{ fontFamily: 'system-ui' }}>
              Shop the Edit <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* product grid - premium cards */}
      <section id="shop" className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h3 className="text-4xl font-light text-neutral-900">Bestsellers</h3>
        <p className="text-neutral-500 mt-3" style={{ fontFamily: 'system-ui' }}>Loved by thousands, owned for a lifetime.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12 mt-14">
          {products.map(p => {
            const wished = wishlist.includes(p.id);
            return (
              <div key={p.id} className="group text-center">
                <div className="relative aspect-square overflow-hidden bg-neutral-50">
                  <Link to={`/products/${p.id}`}>
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-700" />
                  </Link>
                  <button onClick={() => toggleWishlist(p.id)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition">
                    <Heart className={`w-5 h-5 ${wished ? 'fill-rose-700 text-rose-700' : 'text-neutral-700'}`} />
                  </button>
                  <button onClick={() => addToCart(p)} className="absolute bottom-0 left-0 right-0 bg-neutral-900 text-white py-2.5 text-[11px] tracking-[0.2em] uppercase translate-y-full group-hover:translate-y-0 transition" style={{ fontFamily: 'system-ui' }}>
                    Add to Bag
                  </button>
                </div>
                <Link to={`/products/${p.id}`}><p className="mt-4 text-sm text-neutral-800 hover:text-rose-900" style={{ fontFamily: 'system-ui' }}>{p.name}</p></Link>
                <p className="mt-1 text-rose-900 font-medium" style={{ fontFamily: 'system-ui' }}>{inr(p.price)}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* appointment cta */}
      <section className="bg-neutral-900 text-white text-center py-20 px-6">
        <p className="text-rose-300 text-xs tracking-[0.35em] uppercase" style={{ fontFamily: 'system-ui' }}>Personal Styling</p>
        <h3 className="text-4xl font-light mt-4 max-w-2xl mx-auto leading-snug">Book a complimentary virtual consultation with our experts</h3>
        <button className="mt-8 bg-white text-neutral-900 px-10 py-3.5 text-xs tracking-[0.25em] uppercase" style={{ fontFamily: 'system-ui' }}>Book Appointment</button>
      </section>

      {/* footer */}
      <footer className="bg-white border-t border-neutral-100 text-neutral-600" style={{ fontFamily: 'system-ui' }}>
        <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div className="col-span-2 md:col-span-1">
            <h4 className="text-2xl tracking-[0.3em] text-neutral-900" style={{ fontFamily: 'Georgia, serif' }}>{meta.brand.toUpperCase()}</h4>
            <p className="mt-3 text-neutral-500">Fine jewellery, crafted to be cherished.</p>
          </div>
          {[['Shop', ['Rings', 'Earrings', 'Necklaces', 'Bracelets']], ['Service', ['Contact', 'FAQ', 'Care Guide', 'Track Order']], ['About', ['Our Story', 'Certifications', 'Sustainability']]].map(([h, items]: any) => (
            <div key={h}>
              <h5 className="text-xs tracking-[0.2em] uppercase text-neutral-900 mb-4">{h}</h5>
              <ul className="space-y-2">{items.map((i: string) => <li key={i}><a href="#" className="hover:text-rose-900">{i}</a></li>)}</ul>
            </div>
          ))}
        </div>
        <div className="border-t border-neutral-100 py-5 text-center text-xs text-neutral-400">© 2026 {meta.brand}. All rights reserved.</div>
      </footer>

      <CartDrawer accentClass={ACCENT} fontClass="font-sans" />
    </div>
  );
};

export default JewelHome;
