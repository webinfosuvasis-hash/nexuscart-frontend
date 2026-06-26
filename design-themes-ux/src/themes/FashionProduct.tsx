import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, inr } from '@/context/StoreContext';
import { Product } from '@/data/products';
import { getReviews, getRelated, VARIANTS } from '@/data/reviews';
import { Stars, QtyPicker, Gallery } from '@/components/product/Bits';
import CartDrawer from '@/components/CartDrawer';
import { ArrowLeft, ShoppingBag, Heart, Leaf, Ruler, RefreshCw, ChevronRight } from 'lucide-react';

const FashionProduct: React.FC<{ product: Product }> = ({ product }) => {
  const { addToCart, toggleWishlist, wishlist, cartCount, setCartOpen } = useStore();
  const related = getRelated(product, 'fashion');
  const reviews = getReviews(product);
  const variant = VARIANTS.fashion;
  const [size, setSize] = useState(variant.options[2]);
  const [qty, setQty] = useState(1);
  const images = [product.image, ...related.slice(0, 3).map(r => r.image)];
  const wished = wishlist.includes(product.id);
  const ui = { fontFamily: 'system-ui' };

  return (
    <div className="min-h-screen bg-[#f7f4ef] text-stone-800" style={{ fontFamily: '"Times New Roman", serif' }}>
      <header className="sticky top-0 z-40 bg-[#f7f4ef]/95 backdrop-blur border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm tracking-wider uppercase text-stone-700" style={ui}><ArrowLeft className="w-4 h-4" /> Back</Link>
          <h1 className="text-2xl tracking-[0.2em] font-bold text-emerald-900">Saanjh</h1>
          <button onClick={() => setCartOpen(true)} className="relative"><ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && <span className="absolute -top-2 -right-2 bg-emerald-800 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">{cartCount}</span>}
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-5 text-xs tracking-wider uppercase text-stone-400 flex items-center gap-2" style={ui}>
        <Link to="/">Home</Link> <ChevronRight className="w-3 h-3" /> {product.category} <ChevronRight className="w-3 h-3" /> <span className="text-stone-700">{product.name}</span>
      </div>

      <section className="max-w-7xl mx-auto px-6 pb-16 grid md:grid-cols-2 gap-12">
        <Gallery images={images} alt={product.name} rounded="rounded-none" thumbActiveClass="ring-2 ring-emerald-800" />
        <div>
          <p className="text-emerald-800 tracking-[0.25em] text-xs uppercase italic" style={ui}>{product.category}</p>
          <h1 className="text-4xl font-bold mt-3 leading-tight">{product.name}</h1>
          <div className="flex items-center gap-2 mt-3 text-emerald-700" style={ui}>
            <Stars rating={product.rating} /> <span className="text-xs text-stone-500">{product.reviews} reviews</span>
          </div>
          <p className="text-2xl font-bold mt-5 text-emerald-900">{inr(product.price)} <span className="text-base text-stone-400 line-through font-normal">{inr(product.mrp)}</span></p>

          <p className="mt-6 text-stone-600 leading-relaxed text-lg italic">"Handwoven by master artisans, this {product.name.toLowerCase()} carries the soul of slow fashion — breathable, beautiful, and made to be lived in."</p>

          <div className="mt-8">
            <div className="flex items-center justify-between mb-3" style={ui}>
              <p className="text-sm font-semibold tracking-wider uppercase">{variant.label}</p>
              <button className="text-xs text-emerald-800 flex items-center gap-1"><Ruler className="w-3 h-3" /> Size Guide</button>
            </div>
            <div className="flex flex-wrap gap-2" style={ui}>
              {variant.options.map(o => (
                <button key={o} onClick={() => setSize(o)} className={`w-12 h-12 border text-sm transition ${size === o ? 'bg-emerald-900 text-white border-emerald-900' : 'border-stone-300 hover:border-emerald-700'}`}>{o}</button>
              ))}
            </div>
          </div>

          <div className="mt-8 flex items-center gap-4" style={ui}>
            <QtyPicker qty={qty} setQty={setQty} className="border border-stone-300" btnClass="px-3 py-3 text-stone-700" />
            <button onClick={() => addToCart(product, qty)} className="flex-1 bg-emerald-900 hover:bg-emerald-800 text-white py-3.5 text-sm tracking-[0.15em] uppercase">Add to Bag</button>
            <button onClick={() => toggleWishlist(product.id)} className="p-3.5 border border-stone-300">
              <Heart className={`w-5 h-5 ${wished ? 'fill-emerald-800 text-emerald-800' : 'text-stone-600'}`} />
            </button>
          </div>

          <div className="flex gap-6 mt-8 text-xs text-emerald-900" style={ui}>
            <span className="flex items-center gap-1"><Leaf className="w-4 h-4" /> Handwoven</span>
            <span className="flex items-center gap-1"><RefreshCw className="w-4 h-4" /> Easy Returns</span>
            <span className="flex items-center gap-1"><Ruler className="w-4 h-4" /> True to Size</span>
          </div>
        </div>
      </section>

      <section className="bg-emerald-900 text-[#f7f4ef] py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-10 text-center">Stories From Our Community</h2>
          <div className="grid md:grid-cols-2 gap-8" style={ui}>
            {reviews.map((rv, i) => (
              <div key={i} className="border border-emerald-700/50 p-7">
                <Stars rating={rv.rating} className="text-emerald-300" />
                <p className="font-semibold mt-3" style={{ fontFamily: '"Times New Roman", serif' }}>{rv.title}</p>
                <p className="text-sm text-emerald-100/80 mt-2">{rv.body}</p>
                <p className="text-xs text-emerald-300/70 mt-4">{rv.name} · {rv.date}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold mb-10">Pairs Beautifully With</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8">
          {related.map(p => (
            <Link to={`/products/${p.id}`} key={p.id} className="group">
              <div className="aspect-[4/5] overflow-hidden bg-stone-100">
                <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-700" />
              </div>
              <div className="mt-3" style={ui}>
                <h4 className="text-sm">{p.name}</h4>
                <p className="text-sm font-medium text-emerald-900 mt-1">{inr(p.price)}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <CartDrawer accentClass="bg-emerald-800" fontClass="font-sans" />
    </div>
  );
};

export default FashionProduct;
