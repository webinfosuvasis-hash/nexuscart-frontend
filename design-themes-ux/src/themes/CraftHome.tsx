import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, inr } from '@/context/StoreContext';
import { PRODUCTS, CATEGORIES, HERO_IMAGES, THEME_META } from '@/data/products';
import { Search, Heart, ShoppingBag, User, Menu, Star, Gift, Truck, Phone } from 'lucide-react';
import CartDrawer from '@/components/CartDrawer';

const ACCENT = 'bg-amber-700';

const CraftHome: React.FC = () => {
  const { addToCart, toggleWishlist, wishlist, cartCount, setCartOpen } = useStore();
  const products = PRODUCTS.craft;
  const cats = CATEGORIES.craft;
  const [q, setQ] = useState('');
  const filtered = products.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
  const meta = THEME_META.craft;

  return (
    <div className="min-h-screen bg-[#fdf6ec] font-serif text-stone-800">
      {/* announcement */}
      <div className="bg-gradient-to-r from-amber-800 via-orange-700 to-amber-800 text-amber-50 text-center text-xs sm:text-sm py-2 tracking-wide">
        Festive Special • Flat 15% OFF on Pooja & Gifting Collections • Code: UTSAV15
      </div>

      {/* header */}
      <header className="bg-[#fdf6ec] border-b-2 border-amber-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Menu className="w-6 h-6 lg:hidden text-amber-800" />
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-amber-700 flex items-center justify-center text-amber-50 font-bold text-lg">K</div>
            <div>
              <h1 className="text-2xl font-extrabold text-amber-800 leading-none tracking-wide">{meta.brand}</h1>
              <p className="text-[10px] text-stone-500 tracking-[0.2em] uppercase">Handmade Heritage</p>
            </div>
          </div>
          <div className="flex-1 hidden md:flex items-center bg-white rounded-full border-2 border-amber-300 px-4 py-2">
            <Search className="w-4 h-4 text-amber-700" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search brass diyas, idols, gifts..." className="flex-1 bg-transparent outline-none px-3 text-sm font-sans" />
          </div>
          <div className="flex items-center gap-5 text-amber-800">
            <button className="hidden sm:flex flex-col items-center text-[10px]"><User className="w-5 h-5" />Account</button>
            <button className="flex flex-col items-center text-[10px]"><Heart className="w-5 h-5" />Wishlist</button>
            <button onClick={() => setCartOpen(true)} className="relative flex flex-col items-center text-[10px]">
              <ShoppingBag className="w-5 h-5" />Bag
              {cartCount > 0 && <span className="absolute -top-1 right-1 bg-orange-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">{cartCount}</span>}
            </button>
          </div>
        </div>
        <nav className="bg-amber-800 text-amber-50">
          <div className="max-w-7xl mx-auto px-4 flex gap-6 overflow-x-auto text-sm py-2.5 font-sans tracking-wide">
            {['Home Decor', 'Pooja & Spiritual', 'Gifting', 'Wall Art', 'Brass Collection', 'Festive Store', 'New Arrivals'].map(n => (
              <a key={n} href="#cats" className="whitespace-nowrap hover:text-amber-200">{n}</a>
            ))}
          </div>
        </nav>
      </header>

      {/* hero banner */}
      <section className="relative">
        <img src={HERO_IMAGES.craft} alt="hero" className="w-full h-[340px] sm:h-[460px] object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-900/70 to-transparent flex items-center">
          <div className="max-w-7xl mx-auto px-4 w-full">
            <div className="max-w-lg text-amber-50">
              <p className="text-amber-300 tracking-[0.3em] text-xs uppercase mb-3 font-sans">Handcrafted in India</p>
              <h2 className="text-4xl sm:text-6xl font-extrabold leading-tight">{meta.tagline}</h2>
              <p className="mt-4 text-amber-100 font-sans">Each piece tells a story of artisans, tradition, and timeless craft.</p>
              <a href="#cats" className="inline-block mt-6 bg-amber-600 hover:bg-amber-500 text-white px-8 py-3 rounded-full font-semibold font-sans">Explore Collections</a>
            </div>
          </div>
        </div>
      </section>

      {/* trust strip */}
      <section className="bg-amber-100 border-y border-amber-200">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-4 py-5 font-sans text-sm text-amber-900">
          {[[Truck, 'Free Shipping', 'On all orders'], [Gift, 'Gift Wrapping', 'Available'], [Star, 'Handmade', '100% Artisan'], [Phone, 'Support', '7 days a week']].map(([Icon, t, s]: any, i) => (
            <div key={i} className="flex items-center gap-3 justify-center">
              <Icon className="w-6 h-6 text-amber-700" />
              <div><p className="font-bold">{t}</p><p className="text-xs text-amber-700">{s}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* category-first showcase */}
      <section id="cats" className="max-w-7xl mx-auto px-4 py-14">
        <div className="text-center mb-10">
          <p className="text-amber-700 tracking-[0.3em] text-xs uppercase font-sans">Shop by</p>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-stone-800 mt-2">Curated Collections</h3>
          <div className="w-24 h-1 bg-amber-600 mx-auto mt-4 rounded-full" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {cats.map(c => (
            <a key={c.name} href="#prods" className="group relative rounded-2xl overflow-hidden shadow-md border-4 border-white">
              <img src={c.img} alt={c.name} className="w-full h-52 object-cover group-hover:scale-110 transition duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 to-transparent flex items-end p-4">
                <span className="text-amber-50 font-bold text-lg">{c.name}</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* promo banner */}
      <section className="max-w-7xl mx-auto px-4 pb-14">
        <div className="rounded-3xl bg-gradient-to-r from-orange-700 to-amber-700 text-amber-50 p-8 sm:p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <h3 className="text-3xl sm:text-4xl font-extrabold relative">The Festive Gifting Store</h3>
          <p className="mt-3 font-sans relative">Handpicked hampers & decor to celebrate every occasion.</p>
          <button className="mt-6 bg-amber-50 text-amber-800 px-8 py-3 rounded-full font-semibold font-sans relative">Shop Gifts</button>
        </div>
      </section>

      {/* product grid */}
      <section id="prods" className="max-w-7xl mx-auto px-4 pb-16">
        <h3 className="text-3xl font-extrabold text-stone-800 mb-8 text-center">Bestselling Crafts</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {filtered.map(p => {
            const wished = wishlist.includes(p.id);
            return (
              <div key={p.id} className="bg-white rounded-2xl border-2 border-amber-100 overflow-hidden group shadow-sm hover:shadow-xl transition">
                <div className="relative">
                  <Link to={`/products/${p.id}`}>
                    <img src={p.image} alt={p.name} className="w-full h-52 object-cover" />
                  </Link>
                  {p.badge && <span className="absolute top-3 left-3 bg-amber-700 text-white text-[10px] px-2 py-1 rounded-full font-sans">{p.badge}</span>}
                  <button onClick={() => toggleWishlist(p.id)} className="absolute top-3 right-3 bg-white rounded-full p-1.5 shadow">
                    <Heart className={`w-4 h-4 ${wished ? 'fill-red-500 text-red-500' : 'text-amber-700'}`} />
                  </button>
                </div>
                <div className="p-4">
                  <p className="text-xs text-amber-700 font-sans">{p.category}</p>
                  <Link to={`/products/${p.id}`}><h4 className="font-bold leading-snug mt-1 line-clamp-2 h-12 hover:text-amber-700">{p.name}</h4></Link>
                  <div className="flex items-center gap-1 text-xs text-amber-600 font-sans mt-1">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> {p.rating} ({p.reviews})
                  </div>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-lg font-extrabold">{inr(p.price)}</span>
                    <span className="text-xs text-gray-400 line-through font-sans">{inr(p.mrp)}</span>
                  </div>
                  <button onClick={() => addToCart(p)} className="w-full mt-3 bg-amber-700 hover:bg-amber-800 text-white py-2 rounded-full text-sm font-semibold font-sans">Add to Bag</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* craftsmanship story */}
      <section className="bg-amber-800 text-amber-50">
        <div className="max-w-7xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-10 items-center">
          <img src={CATEGORIES.craft[1].img} alt="artisan" className="rounded-2xl h-72 w-full object-cover border-4 border-amber-600" />
          <div>
            <p className="text-amber-300 tracking-[0.3em] text-xs uppercase font-sans">Our Story</p>
            <h3 className="text-3xl sm:text-4xl font-extrabold mt-2">Empowering 5,000+ Artisans</h3>
            <p className="mt-4 text-amber-100 font-sans leading-relaxed">From the workshops of Moradabad to the looms of Bengal, every product you buy supports a craftsperson keeping ancient traditions alive. Authentic, ethical, and made with love.</p>
            <button className="mt-6 bg-amber-50 text-amber-800 px-8 py-3 rounded-full font-semibold font-sans">Meet the Makers</button>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="bg-stone-900 text-amber-100 font-sans">
        <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div>
            <h4 className="text-xl font-bold text-amber-400 font-serif mb-3">{meta.brand}</h4>
            <p className="text-amber-200/70">Celebrating Indian craftsmanship since 2014.</p>
          </div>
          {[['Shop', ['Home Decor', 'Pooja', 'Gifting', 'Wall Art']], ['Help', ['Contact Us', 'FAQ', 'Shipping', 'Returns']], ['Company', ['About Us', 'Artisans', 'Careers', 'Blog']]].map(([h, items]: any) => (
            <div key={h}>
              <h5 className="font-bold text-amber-300 mb-3">{h}</h5>
              <ul className="space-y-2 text-amber-200/70">{items.map((i: string) => <li key={i}><a href="#" className="hover:text-amber-100">{i}</a></li>)}</ul>
            </div>
          ))}
        </div>
        <div className="border-t border-amber-900/50 py-4 text-center text-xs text-amber-200/50">© 2026 {meta.brand}. Handcrafted with love.</div>
      </footer>

      <CartDrawer accentClass={ACCENT} fontClass="font-sans" />
    </div>
  );
};

export default CraftHome;
