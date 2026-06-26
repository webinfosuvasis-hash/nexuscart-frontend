import React from 'react';
import { Link } from 'react-router-dom';
import { useStore, inr } from '@/context/StoreContext';
import { PRODUCTS, CATEGORIES, HERO_IMAGES, THEME_META } from '@/data/products';
import { Search, Heart, ShoppingBag, User, ArrowRight, Instagram } from 'lucide-react';
import CartDrawer from '@/components/CartDrawer';

const ACCENT = 'bg-emerald-800';

const FashionHome: React.FC = () => {
  const { addToCart, toggleWishlist, wishlist, cartCount, setCartOpen } = useStore();
  const products = PRODUCTS.fashion;
  const cats = CATEGORIES.fashion;
  const meta = THEME_META.fashion;

  return (
    <div className="min-h-screen bg-[#f7f4ef] text-stone-800" style={{ fontFamily: '"Times New Roman", serif' }}>
      {/* header */}
      <header className="sticky top-0 z-40 bg-[#f7f4ef]/95 backdrop-blur border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl tracking-[0.2em] font-bold text-emerald-900">{meta.brand}</h1>
          <nav className="hidden lg:flex gap-8 text-[13px] tracking-wider uppercase text-stone-700" style={{ fontFamily: 'system-ui' }}>
            {['New In', 'Sarees', 'Kurtas', 'The Edit', 'Our Story'].map(n => <a key={n} href="#shop" className="hover:text-emerald-800 transition">{n}</a>)}
          </nav>
          <div className="flex items-center gap-5 text-stone-700">
            <Search className="w-5 h-5" />
            <User className="w-5 h-5 hidden sm:block" />
            <Heart className="w-5 h-5" />
            <button onClick={() => setCartOpen(true)} className="relative">
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && <span className="absolute -top-2 -right-2 bg-emerald-800 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>

      {/* editorial hero */}
      <section className="relative">
        <img src={HERO_IMAGES.fashion} alt="hero" className="w-full h-[520px] sm:h-[680px] object-cover" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-7xl mx-auto px-6 w-full pb-16">
            <div className="max-w-xl">
              <p className="text-white/90 italic text-lg mb-3">— The Spring Chronicle</p>
              <h2 className="text-5xl sm:text-7xl text-white leading-[1.05] font-bold">Slow fashion,<br />deeply rooted.</h2>
              <a href="#shop" className="inline-flex items-center gap-2 mt-7 bg-[#f7f4ef] text-emerald-900 px-8 py-3.5 text-sm tracking-wider uppercase" style={{ fontFamily: 'system-ui' }}>
                Shop the Story <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* brand philosophy */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="text-emerald-800 tracking-[0.3em] text-xs uppercase" style={{ fontFamily: 'system-ui' }}>Our Philosophy</p>
        <p className="text-2xl sm:text-3xl leading-relaxed mt-6 text-stone-700">
          "We weave stories into fabric. Every drape is handmade by women weavers, carrying the warmth of human hands and the soul of Indian textile traditions."
        </p>
        <p className="mt-6 text-stone-500 italic">— Founders, {meta.brand}</p>
      </section>

      {/* editorial category split */}
      <section className="max-w-7xl mx-auto px-6 pb-20 grid md:grid-cols-2 gap-6">
        {cats.slice(0, 2).map((c, i) => (
          <a key={c.name} href="#shop" className="group relative h-[420px] overflow-hidden">
            <img src={c.img} alt={c.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex flex-col justify-end p-8">
              <p className="text-white/80 italic">Collection 0{i + 1}</p>
              <h3 className="text-4xl text-white font-bold mt-1">{c.name}</h3>
              <span className="text-white/90 mt-3 inline-flex items-center gap-2 text-sm tracking-wider uppercase" style={{ fontFamily: 'system-ui' }}>Explore <ArrowRight className="w-4 h-4" /></span>
            </div>
          </a>
        ))}
      </section>

      {/* product grid - editorial */}
      <section id="shop" className="max-w-7xl mx-auto px-6 pb-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-emerald-800 tracking-[0.3em] text-xs uppercase" style={{ fontFamily: 'system-ui' }}>Just In</p>
            <h3 className="text-4xl font-bold mt-2">The New Arrivals</h3>
          </div>
          <a href="#" className="hidden sm:inline-flex items-center gap-2 text-sm tracking-wider uppercase text-emerald-800" style={{ fontFamily: 'system-ui' }}>View All <ArrowRight className="w-4 h-4" /></a>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
          {products.map(p => {
            const wished = wishlist.includes(p.id);
            return (
              <div key={p.id} className="group">
                <div className="relative aspect-[4/5] overflow-hidden bg-stone-100">
                  <Link to={`/products/${p.id}`}>
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-700" />
                  </Link>
                  {p.badge && <span className="absolute top-3 left-3 bg-[#f7f4ef]/90 text-emerald-900 text-[10px] px-3 py-1 tracking-wider uppercase" style={{ fontFamily: 'system-ui' }}>{p.badge}</span>}
                  <button onClick={() => toggleWishlist(p.id)} className="absolute top-3 right-3">
                    <Heart className={`w-5 h-5 ${wished ? 'fill-emerald-800 text-emerald-800' : 'text-white drop-shadow'}`} />
                  </button>
                  <button onClick={() => addToCart(p)} className="absolute bottom-3 left-3 right-3 bg-emerald-900 text-white py-2.5 text-[11px] tracking-[0.2em] uppercase opacity-0 group-hover:opacity-100 transition" style={{ fontFamily: 'system-ui' }}>
                    Add to Bag
                  </button>
                </div>
                <Link to={`/products/${p.id}`} className="block mt-3" style={{ fontFamily: 'system-ui' }}>
                  <p className="text-[11px] text-stone-400 uppercase tracking-wider">{p.category}</p>
                  <h4 className="text-sm text-stone-800 mt-1 hover:text-emerald-800">{p.name}</h4>
                  <p className="text-sm font-medium text-emerald-900 mt-1">{inr(p.price)}</p>
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* lookbook story banner */}
      <section className="bg-emerald-900 text-[#f7f4ef]">
        <div className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="tracking-[0.3em] text-xs uppercase text-emerald-300" style={{ fontFamily: 'system-ui' }}>Lookbook</p>
            <h3 className="text-4xl sm:text-5xl font-bold mt-4 leading-tight">Worn by real women,<br />in real moments.</h3>
            <p className="mt-5 text-emerald-100/80 text-lg leading-relaxed">No filters, no fuss. Just honest fashion that moves with your life — from morning chai to evening soirées.</p>
            <button className="mt-8 bg-[#f7f4ef] text-emerald-900 px-8 py-3.5 text-sm tracking-wider uppercase" style={{ fontFamily: 'system-ui' }}>View Lookbook</button>
          </div>
          <img src={products[0].image} alt="lookbook" className="h-[460px] w-full object-cover" />
        </div>
      </section>

      {/* instagram */}
      <section className="max-w-7xl mx-auto px-6 py-16 text-center">
        <Instagram className="w-7 h-7 mx-auto text-emerald-800" />
        <h3 className="text-3xl font-bold mt-3">@{meta.brand.toLowerCase()}</h3>
        <div className="grid grid-cols-4 gap-2 sm:gap-4 mt-8">
          {[...products.slice(0, 4)].map(p => <img key={p.id} src={p.image} alt="ig" className="aspect-square object-cover" />)}
        </div>
      </section>

      {/* footer */}
      <footer className="bg-stone-900 text-stone-300" style={{ fontFamily: 'system-ui' }}>
        <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div className="col-span-2 md:col-span-1">
            <h4 className="text-2xl tracking-[0.2em] font-bold text-white" style={{ fontFamily: '"Times New Roman", serif' }}>{meta.brand}</h4>
            <p className="mt-3 text-stone-400">Handwoven. Heartfelt. Honest.</p>
          </div>
          {[['Shop', ['New In', 'Sarees', 'Kurtas', 'Dresses']], ['Help', ['Contact Us', 'FAQ', 'Shipping', 'Size Guide']], ['Brand', ['Our Story', 'Weavers', 'Sustainability', 'Press']]].map(([h, items]: any) => (
            <div key={h}>
              <h5 className="text-xs tracking-[0.2em] uppercase text-white mb-4">{h}</h5>
              <ul className="space-y-2 text-stone-400">{items.map((i: string) => <li key={i}><a href="#" className="hover:text-white">{i}</a></li>)}</ul>
            </div>
          ))}
        </div>
        <div className="border-t border-stone-800 py-5 text-center text-xs text-stone-500">© 2026 {meta.brand}. Made in India with love.</div>
      </footer>

      <CartDrawer accentClass={ACCENT} fontClass="font-sans" />
    </div>
  );
};

export default FashionHome;
