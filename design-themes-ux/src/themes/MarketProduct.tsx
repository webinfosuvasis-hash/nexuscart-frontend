import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, inr } from '@/context/StoreContext';
import { Product } from '@/data/products';
import { getReviews, getRelated, VARIANTS } from '@/data/reviews';
import { Stars, QtyPicker, Gallery } from '@/components/product/Bits';
import CartDrawer from '@/components/CartDrawer';
import { ArrowLeft, ShoppingCart, Heart, Star, Truck, RotateCcw, ShieldCheck, MapPin, ChevronRight, Check } from 'lucide-react';

const MarketProduct: React.FC<{ product: Product }> = ({ product }) => {
  const { addToCart, toggleWishlist, wishlist, cartCount, setCartOpen } = useStore();
  const related = getRelated(product, 'market');
  const reviews = getReviews(product);
  const variant = VARIANTS.market;
  const [v, setV] = useState(variant.options[0]);
  const [qty, setQty] = useState(1);
  const images = [product.image, ...related.slice(0, 3).map(r => r.image)];
  const wished = wishlist.includes(product.id);
  const disc = Math.round((1 - product.price / product.mrp) * 100);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 font-sans">
      <header className="bg-blue-600 sticky top-0 z-40 shadow">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between text-white">
          <Link to="/" className="flex items-center gap-2 text-sm"><ArrowLeft className="w-4 h-4" /> Continue Shopping</Link>
          <span className="text-xl font-black">BazaarOne<span className="text-yellow-300">.</span></span>
          <button onClick={() => setCartOpen(true)} className="relative"><ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && <span className="absolute -top-1 -right-2 bg-yellow-400 text-blue-900 font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">{cartCount}</span>}
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-3 text-xs text-gray-500 flex items-center gap-1">
        <Link to="/">Home</Link> <ChevronRight className="w-3 h-3" /> {product.category} <ChevronRight className="w-3 h-3" /> <span className="text-gray-700">{product.name}</span>
      </div>

      <section className="max-w-7xl mx-auto px-4 pb-6 grid lg:grid-cols-12 gap-4">
        {/* gallery */}
        <div className="lg:col-span-4 bg-white rounded-lg p-4 lg:sticky lg:top-20 h-fit">
          <Gallery images={images} alt={product.name} rounded="rounded-lg" thumbActiveClass="ring-2 ring-blue-600" />
          <div className="grid grid-cols-2 gap-3 mt-4">
            <button onClick={() => addToCart(product, qty)} className="bg-yellow-400 hover:bg-yellow-500 text-blue-900 font-bold py-3 rounded-lg flex items-center justify-center gap-2"><ShoppingCart className="w-4 h-4" /> Add to Cart</button>
            <button onClick={() => addToCart(product, qty)} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg">Buy Now</button>
          </div>
        </div>

        {/* info */}
        <div className="lg:col-span-5 bg-white rounded-lg p-5">
          <h1 className="text-xl font-semibold">{product.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">{product.rating} <Star className="w-3 h-3 fill-white" /></span>
            <span className="text-sm text-gray-500">{product.reviews} ratings</span>
          </div>
          <div className="flex items-baseline gap-3 mt-4">
            <span className="text-3xl font-bold">{inr(product.price)}</span>
            <span className="text-gray-400 line-through">{inr(product.mrp)}</span>
            <span className="text-green-600 font-semibold">{disc}% off</span>
          </div>
          <p className="text-xs text-gray-500">Inclusive of all taxes</p>

          <div className="mt-5">
            <p className="text-sm font-semibold mb-2">{variant.label}: <span className="font-normal">{v}</span></p>
            <div className="flex gap-2">
              {variant.options.map(o => (
                <button key={o} onClick={() => setV(o)} className={`px-4 py-2 rounded border text-sm ${v === o ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-gray-300'}`}>{o}</button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <span className="text-sm font-semibold">Quantity</span>
            <QtyPicker qty={qty} setQty={setQty} className="border border-gray-300 rounded" btnClass="px-3 py-2 text-gray-600" />
            <button onClick={() => toggleWishlist(product.id)} className="ml-auto flex items-center gap-1 text-sm text-gray-600">
              <Heart className={`w-4 h-4 ${wished ? 'fill-red-500 text-red-500' : ''}`} /> Wishlist
            </button>
          </div>

          <div className="mt-6 border-t pt-4">
            <h3 className="font-semibold mb-2">Highlights</h3>
            <ul className="text-sm text-gray-600 space-y-1.5">
              {['Premium build quality', '1 Year warranty included', 'Free 7-day replacement', 'Top rated by 2M+ buyers'].map(h => (
                <li key={h} className="flex items-center gap-2"><Check className="w-4 h-4 text-green-600" /> {h}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* buy box */}
        <div className="lg:col-span-3 bg-white rounded-lg p-5 h-fit">
          <p className="text-lg font-bold text-green-700">{inr(product.price)}</p>
          <div className="flex items-center gap-2 text-sm text-gray-600 mt-3"><MapPin className="w-4 h-4 text-blue-600" /> Deliver to <b>110001</b></div>
          <p className="text-sm mt-2 text-gray-700">FREE delivery by <b>Tomorrow</b></p>
          <div className="space-y-3 mt-4 text-sm text-gray-600">
            {[[Truck, 'Free Delivery'], [RotateCcw, '7 Days Replacement'], [ShieldCheck, '1 Year Warranty']].map(([Icon, t]: any, i) => (
              <div key={i} className="flex items-center gap-2"><Icon className="w-4 h-4 text-blue-600" /> {t}</div>
            ))}
          </div>
          <button onClick={() => addToCart(product, qty)} className="w-full mt-5 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-semibold">Add to Cart</button>
        </div>
      </section>

      {/* reviews */}
      <section className="max-w-7xl mx-auto px-4 pb-4">
        <div className="bg-white rounded-lg p-5">
          <h2 className="text-lg font-bold mb-4">Ratings & Reviews</h2>
          <div className="grid md:grid-cols-2 gap-5">
            {reviews.map((rv, i) => (
              <div key={i} className="border-b pb-4">
                <div className="flex items-center gap-2">
                  <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">{rv.rating} <Star className="w-3 h-3 fill-white" /></span>
                  <span className="font-semibold text-sm">{rv.title}</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">{rv.body}</p>
                <p className="text-xs text-gray-400 mt-2">{rv.name} · {rv.date}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* related */}
      <section className="max-w-7xl mx-auto px-4 pb-10">
        <div className="bg-white rounded-lg p-5">
          <h2 className="text-lg font-bold mb-4">Customers Also Bought</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {related.map(p => (
              <Link to={`/products/${p.id}`} key={p.id} className="border border-gray-100 rounded-lg overflow-hidden hover:shadow-lg transition">
                <img src={p.image} alt={p.name} className="w-full h-40 object-cover" />
                <div className="p-3">
                  <h4 className="text-sm line-clamp-1">{p.name}</h4>
                  <p className="font-bold mt-1">{inr(p.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CartDrawer accentClass="bg-blue-600" />
    </div>
  );
};

export default MarketProduct;
