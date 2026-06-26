import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, inr } from '@/context/StoreContext';
import { Product } from '@/data/products';
import { getReviews, getRelated, VARIANTS } from '@/data/reviews';
import { Stars, QtyPicker, Gallery } from '@/components/product/Bits';
import CartDrawer from '@/components/CartDrawer';
import { ArrowLeft, ShoppingBag, Heart, Truck, Gift, ShieldCheck, ChevronRight } from 'lucide-react';

const CraftProduct: React.FC<{ product: Product }> = ({ product }) => {
  const { addToCart, toggleWishlist, wishlist, cartCount, setCartOpen } = useStore();
  const related = getRelated(product, 'craft');
  const reviews = getReviews(product);
  const variant = VARIANTS.craft;
  const [size, setSize] = useState(variant.options[1]);
  const [qty, setQty] = useState(1);
  const images = [product.image, ...related.slice(0, 3).map(r => r.image)];
  const wished = wishlist.includes(product.id);

  return (
    <div className="min-h-screen bg-[#fdf6ec] font-serif text-stone-800">
      <header className="bg-amber-800 text-amber-50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-sans text-sm"><ArrowLeft className="w-4 h-4" /> Back to Store</Link>
          <span className="text-xl font-extrabold tracking-wide">KalaKriti</span>
          <button onClick={() => setCartOpen(true)} className="relative"><ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && <span className="absolute -top-2 -right-2 bg-orange-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">{cartCount}</span>}
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4 text-xs text-amber-700 font-sans flex items-center gap-1">
        <Link to="/">Home</Link> <ChevronRight className="w-3 h-3" /> {product.category} <ChevronRight className="w-3 h-3" /> <span className="text-stone-500">{product.name}</span>
      </div>

      <section className="max-w-7xl mx-auto px-4 pb-12 grid md:grid-cols-2 gap-10">
        <div className="bg-white rounded-3xl border-4 border-amber-100 p-4">
          <Gallery images={images} alt={product.name} rounded="rounded-2xl" thumbActiveClass="ring-2 ring-amber-700" />
        </div>
        <div>
          <p className="text-amber-700 font-sans text-xs tracking-[0.2em] uppercase">{product.category}</p>
          <h1 className="text-4xl font-extrabold mt-2 leading-tight">{product.name}</h1>
          <div className="flex items-center gap-2 mt-3 text-amber-600 font-sans text-sm">
            <Stars rating={product.rating} /> <span>{product.rating} • {product.reviews} reviews</span>
          </div>
          <div className="flex items-baseline gap-3 mt-5">
            <span className="text-3xl font-extrabold">{inr(product.price)}</span>
            <span className="text-lg text-gray-400 line-through font-sans">{inr(product.mrp)}</span>
            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full font-sans">Save {inr(product.mrp - product.price)}</span>
          </div>
          <p className="mt-5 text-stone-600 font-sans leading-relaxed">A handcrafted treasure made by skilled artisans, {product.name.toLowerCase()} brings warmth and heritage to your home. Each piece is unique with subtle variations that celebrate the human touch.</p>

          <div className="mt-6">
            <p className="font-sans text-sm font-bold mb-2">{variant.label}</p>
            <div className="flex gap-2 font-sans">
              {variant.options.map(o => (
                <button key={o} onClick={() => setSize(o)} className={`px-5 py-2 rounded-full border-2 text-sm ${size === o ? 'bg-amber-700 text-white border-amber-700' : 'border-amber-300 text-stone-700'}`}>{o}</button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4 font-sans">
            <QtyPicker qty={qty} setQty={setQty} className="border-2 border-amber-300 rounded-full" btnClass="px-3 py-2 text-amber-800" />
            <button onClick={() => addToCart(product, qty)} className="flex-1 bg-amber-700 hover:bg-amber-800 text-white py-3 rounded-full font-semibold">Add to Bag</button>
            <button onClick={() => toggleWishlist(product.id)} className="p-3 rounded-full border-2 border-amber-300">
              <Heart className={`w-5 h-5 ${wished ? 'fill-red-500 text-red-500' : 'text-amber-700'}`} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-7 font-sans text-xs text-amber-900">
            {[[Truck, 'Free Shipping'], [Gift, 'Gift Wrap'], [ShieldCheck, 'Authentic']].map(([Icon, t]: any, i) => (
              <div key={i} className="bg-amber-100 rounded-xl p-3 text-center"><Icon className="w-5 h-5 mx-auto mb-1 text-amber-700" />{t}</div>
            ))}
          </div>
        </div>
      </section>

      {/* reviews */}
      <section className="max-w-7xl mx-auto px-4 pb-12">
        <h2 className="text-2xl font-extrabold mb-6">Artisan Reviews</h2>
        <div className="grid md:grid-cols-2 gap-5 font-sans">
          {reviews.map((rv, i) => (
            <div key={i} className="bg-white rounded-2xl border-2 border-amber-100 p-5">
              <div className="flex items-center justify-between">
                <span className="font-bold">{rv.name}</span>
                <Stars rating={rv.rating} className="text-amber-500" />
              </div>
              <p className="font-semibold mt-2">{rv.title}</p>
              <p className="text-sm text-stone-600 mt-1">{rv.body}</p>
              <p className="text-xs text-stone-400 mt-2">{rv.date}</p>
            </div>
          ))}
        </div>
      </section>

      {/* related */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-extrabold mb-6">You May Also Love</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {related.map(p => (
            <Link to={`/products/${p.id}`} key={p.id} className="bg-white rounded-2xl border-2 border-amber-100 overflow-hidden hover:shadow-xl transition">
              <img src={p.image} alt={p.name} className="w-full h-44 object-cover" />
              <div className="p-3 font-sans">
                <h4 className="font-bold text-sm line-clamp-1">{p.name}</h4>
                <p className="text-amber-800 font-extrabold mt-1">{inr(p.price)}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <CartDrawer accentClass="bg-amber-700" fontClass="font-sans" />
    </div>
  );
};

export default CraftProduct;
