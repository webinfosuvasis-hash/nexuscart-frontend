import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, inr } from '@/context/StoreContext';
import { Product } from '@/data/products';
import { getReviews, getRelated, VARIANTS } from '@/data/reviews';
import { Stars, QtyPicker, Gallery } from '@/components/product/Bits';
import CartDrawer from '@/components/CartDrawer';
import { ArrowLeft, ShoppingBag, Heart, ShieldCheck, Gem, RotateCcw, ChevronRight } from 'lucide-react';

const JewelProduct: React.FC<{ product: Product }> = ({ product }) => {
  const { addToCart, toggleWishlist, wishlist, cartCount, setCartOpen } = useStore();
  const related = getRelated(product, 'jewel');
  const reviews = getReviews(product);
  const variant = VARIANTS.jewel;
  const [size, setSize] = useState(variant.options[1]);
  const [qty, setQty] = useState(1);
  const images = [product.image, ...related.slice(0, 3).map(r => r.image)];
  const wished = wishlist.includes(product.id);
  const ui = { fontFamily: 'system-ui' };

  return (
    <div className="min-h-screen bg-white text-neutral-800" style={{ fontFamily: 'Georgia, serif' }}>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-neutral-100">
        <div className="max-w-6xl mx-auto px-6 py-5 grid grid-cols-3 items-center">
          <Link to="/" className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-neutral-600" style={ui}><ArrowLeft className="w-4 h-4" /> Back</Link>
          <h1 className="text-center text-2xl tracking-[0.35em] font-light">LUMIERE</h1>
          <button onClick={() => setCartOpen(true)} className="relative justify-self-end"><ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && <span className="absolute -top-2 -right-2 bg-rose-900 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">{cartCount}</span>}
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 text-[11px] tracking-wider text-neutral-400 flex items-center gap-2" style={ui}>
        <Link to="/">HOME</Link> <ChevronRight className="w-3 h-3" /> {product.category.toUpperCase()} <ChevronRight className="w-3 h-3" /> <span className="text-neutral-700">{product.name.toUpperCase()}</span>
      </div>

      <section className="max-w-6xl mx-auto px-6 pb-16 grid md:grid-cols-2 gap-16">
        <Gallery images={images} alt={product.name} rounded="rounded-none" thumbActiveClass="ring-1 ring-rose-900" />
        <div className="md:pt-6">
          <p className="text-rose-700 text-xs tracking-[0.3em] uppercase" style={ui}>{product.category}</p>
          <h1 className="text-4xl font-light mt-3 leading-tight">{product.name}</h1>
          <div className="flex items-center gap-3 mt-4 text-rose-800" style={ui}>
            <Stars rating={product.rating} /> <span className="text-xs text-neutral-500">{product.reviews} reviews</span>
          </div>
          <p className="text-3xl font-light mt-6 text-rose-900">{inr(product.price)}</p>
          <p className="text-xs text-neutral-400 mt-1" style={ui}>Inclusive of all taxes · EMI from {inr(Math.round(product.price / 12))}/mo</p>

          <div className="h-px bg-neutral-100 my-7" />
          <p className="text-neutral-600 leading-relaxed" style={ui}>An exquisite {product.name.toLowerCase()} crafted in recycled 18k gold with ethically sourced, brilliant-cut diamonds. Designed to be treasured and passed down through generations.</p>

          <div className="mt-8">
            <p className="text-xs tracking-[0.2em] uppercase text-neutral-700 mb-3" style={ui}>{variant.label}</p>
            <div className="flex flex-wrap gap-3" style={ui}>
              {variant.options.map(o => (
                <button key={o} onClick={() => setSize(o)} className={`w-12 h-12 border text-sm transition ${size === o ? 'border-rose-900 bg-rose-900 text-white' : 'border-neutral-200 text-neutral-700 hover:border-neutral-400'}`}>{o}</button>
              ))}
            </div>
          </div>

          <div className="mt-8 flex items-center gap-4" style={ui}>
            <QtyPicker qty={qty} setQty={setQty} className="border border-neutral-200" btnClass="px-3 py-3 text-neutral-700" />
            <button onClick={() => addToCart(product, qty)} className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-white py-3.5 text-xs tracking-[0.2em] uppercase">Add to Bag</button>
            <button onClick={() => toggleWishlist(product.id)} className="p-3.5 border border-neutral-200">
              <Heart className={`w-5 h-5 ${wished ? 'fill-rose-800 text-rose-800' : 'text-neutral-600'}`} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-10 text-center" style={ui}>
            {[[ShieldCheck, 'Certified'], [Gem, '100% Natural'], [RotateCcw, '30-Day Return']].map(([Icon, t]: any, i) => (
              <div key={i}><Icon className="w-6 h-6 mx-auto text-rose-800" strokeWidth={1.2} /><p className="text-xs text-neutral-600 mt-2">{t}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-rose-50/40 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-light text-center mb-10">What Our Clients Say</h2>
          <div className="grid md:grid-cols-2 gap-8" style={ui}>
            {reviews.map((rv, i) => (
              <div key={i} className="bg-white p-7 border border-neutral-100">
                <Stars rating={rv.rating} className="text-rose-800" />
                <p className="font-medium mt-3 text-neutral-800" style={{ fontFamily: 'Georgia, serif' }}>{rv.title}</p>
                <p className="text-sm text-neutral-600 mt-2">{rv.body}</p>
                <p className="text-xs text-neutral-400 mt-4">{rv.name} · {rv.date}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h2 className="text-3xl font-light mb-10">Complete the Look</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {related.map(p => (
            <Link to={`/products/${p.id}`} key={p.id} className="group">
              <div className="aspect-square overflow-hidden bg-neutral-50">
                <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-700" />
              </div>
              <p className="mt-4 text-sm" style={ui}>{p.name}</p>
              <p className="text-rose-900 mt-1" style={ui}>{inr(p.price)}</p>
            </Link>
          ))}
        </div>
      </section>

      <CartDrawer accentClass="bg-rose-900" fontClass="font-sans" />
    </div>
  );
};

export default JewelProduct;
