import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, inr } from '@/context/StoreContext';
import { PRODUCTS, CATEGORIES, HERO_IMAGES, THEME_META } from '@/data/products';
import { Search, Heart, ShoppingCart, User, MapPin, Star, Zap, Truck, Tag, ChevronRight } from 'lucide-react';
import CartDrawer from '@/components/CartDrawer';

const ACCENT = 'bg-blue-600';

const MarketHome: React.FC = () => {
  const { addToCart, toggleWishlist, wishlist, cartCount, setCartOpen } = useStore();
  const products = PRODUCTS.market;
  const cats = CATEGORIES.market;
  const meta = THEME_META.market;
  const [q, setQ] = useState('');
  const filtered = products.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
  const disc = (p: any) => Math.round((1 - p.price / p.mrp) * 100);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 font-sans">
      {/* top utility */}
      <div className="bg-blue-700 text-white text-xs">
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between">
          <span className="hidden sm:flex items-center gap-1"><MapPin className="w-3 h-3" /> Deliver to 110001</span>
          <div className="flex gap-4">
            <a href="#" className="hover:underline">Seller Zone</a>
            <a href="#" className="hover:underline">Track Order</a>
            <a href="#" className="hover:underline">Help</a>
          </div>
        </div>
      </div>

      {/* header */}
      <header className="bg-blue-600 sticky top-0 z-40 shadow">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <h1 className="text-2xl font-black text-white tracking-tight">{meta.brand}<span className="text-yellow-300">.</span></h1>
          <div className="flex-1 flex items-center bg-white rounded-md overflow-hidden">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search for products, brands and more" className="flex-1 px-4 py-2.5 outline-none text-sm" />
            <button className="bg-yellow-400 px-5 py-2.5"><Search className="w-5 h-5 text-blue-900" /></button>
          </div>
          <div className="flex items-center gap-5 text-white text-xs">
            <button className="hidden sm:flex flex-col items-center"><User className="w-5 h-5" />Login</button>
            <button className="flex flex-col items-center"><Heart className="w-5 h-5" />Wishlist</button>
            <button onClick={() => setCartOpen(true)} className="relative flex flex-col items-center">
              <ShoppingCart className="w-5 h-5" />Cart
              {cartCount > 0 && <span className="absolute -top-1 right-2 bg-yellow-400 text-blue-900 font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">{cartCount}</span>}
            </button>
          </div>
        </div>
        {/* category strip */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 flex gap-6 overflow-x-auto py-2.5 text-sm font-medium text-gray-700">
            {['Electronics', 'Fashion', 'Home & Kitchen', 'Beauty', 'Grocery', 'Toys', 'Sports', 'Books', 'Offers'].map(n => (
              <a key={n} href="#deals" className="whitespace-nowrap hover:text-blue-600">{n}</a>
            ))}
          </div>
        </div>
      </header>

      {/* hero promo */}
      <section className="max-w-7xl mx-auto px-4 pt-4">
        <img src={HERO_IMAGES.market} alt="hero" className="w-full h-44 sm:h-72 object-cover rounded-lg shadow" />
      </section>

      {/* benefit strip */}
      <section className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[[Truck, 'Free Delivery', 'On all orders'], [Tag, 'Best Prices', 'Guaranteed'], [Zap, 'Fast Shipping', 'Within 48 hrs'], [Star, '4.7 Rated', '2M+ customers']].map(([Icon, t, s]: any, i) => (
          <div key={i} className="bg-white rounded-lg p-3 flex items-center gap-3 shadow-sm">
            <div className="bg-blue-50 p-2 rounded-full"><Icon className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-sm font-bold">{t}</p><p className="text-xs text-gray-500">{s}</p></div>
          </div>
        ))}
      </section>

      {/* category tiles */}
      <section className="max-w-7xl mx-auto px-4 py-2">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Shop by Category</h3>
            <a href="#deals" className="text-blue-600 text-sm flex items-center">View All <ChevronRight className="w-4 h-4" /></a>
          </div>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
            {[...cats, ...cats].map((c, i) => (
              <a key={i} href="#deals" className="text-center group">
                <div className="aspect-square rounded-full overflow-hidden bg-gray-50 mb-2">
                  <img src={c.img} alt={c.name} className="w-full h-full object-cover group-hover:scale-110 transition" />
                </div>
                <p className="text-xs text-gray-600 truncate">{c.name}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* deal of the day */}
      <section id="deals" className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-fuchsia-600 text-white px-4 py-3 flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2"><Zap className="w-5 h-5 fill-yellow-300 text-yellow-300" /> Deals of the Day</h3>
            <span className="text-xs bg-white/20 px-3 py-1 rounded-full">Ends in 04 : 32 : 11</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3">
            {filtered.slice(0, 6).map(p => (
              <div key={p.id} className="text-center p-2 hover:shadow-md rounded-lg transition cursor-pointer">
                <img src={p.image} alt={p.name} className="w-full h-28 object-cover rounded" />
                <p className="text-xs mt-2 truncate">{p.name}</p>
                <p className="text-green-600 font-bold text-sm">{disc(p)}% OFF</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* dense product grid */}
      <section className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-bold mb-4">Recommended For You</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(p => {
              const wished = wishlist.includes(p.id);
              return (
                <div key={p.id} className="border border-gray-100 rounded-lg overflow-hidden hover:shadow-lg transition group">
                  <div className="relative">
                    <Link to={`/products/${p.id}`}>
                      <img src={p.image} alt={p.name} className="w-full h-44 object-cover" />
                    </Link>
                    <span className="absolute top-2 left-2 bg-green-600 text-white text-[10px] px-2 py-0.5 rounded font-bold">{disc(p)}% OFF</span>
                    <button onClick={() => toggleWishlist(p.id)} className="absolute top-2 right-2 bg-white rounded-full p-1.5 shadow">
                      <Heart className={`w-4 h-4 ${wished ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                    </button>
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-gray-400">{p.category}</p>
                    <Link to={`/products/${p.id}`}><h4 className="text-sm font-medium leading-snug line-clamp-2 h-10 mt-0.5 hover:text-blue-600">{p.name}</h4></Link>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="bg-green-600 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5">{p.rating} <Star className="w-2.5 h-2.5 fill-white" /></span>
                      <span className="text-xs text-gray-400">({p.reviews})</span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-lg font-bold">{inr(p.price)}</span>
                      <span className="text-xs text-gray-400 line-through">{inr(p.mrp)}</span>
                    </div>
                    <button onClick={() => addToCart(p)} className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm font-semibold">Add to Cart</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="bg-gray-900 text-gray-300 text-sm mt-4">
        <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <h4 className="text-xl font-black text-white">{meta.brand}<span className="text-yellow-400">.</span></h4>
            <p className="mt-3 text-gray-400">India's everything store.</p>
          </div>
          {[['Shop', ['Electronics', 'Fashion', 'Home', 'Grocery']], ['Account', ['Login', 'Orders', 'Wishlist', 'My Account']], ['Help', ['Contact Us', 'FAQ', 'Returns', 'Track Order']], ['Company', ['About Us', 'Careers', 'Press', 'Sell on Us']]].map(([h, items]: any) => (
            <div key={h}>
              <h5 className="font-bold text-white mb-3">{h}</h5>
              <ul className="space-y-2 text-gray-400">{items.map((i: string) => <li key={i}><a href="#" className="hover:text-white">{i}</a></li>)}</ul>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-800 py-4 text-center text-xs text-gray-500">© 2026 {meta.brand}. All rights reserved.</div>
      </footer>

      <CartDrawer accentClass={ACCENT} />
    </div>
  );
};

export default MarketHome;
