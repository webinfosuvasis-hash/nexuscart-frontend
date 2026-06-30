import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Gift, Star } from 'lucide-react';
import { useStore, inr } from '@/context/StoreContext';
import { useRegistry, OCCASIONS, OccasionKey } from '@/context/RegistryContext';
import type { Product } from '@/data/products';
import { UI } from '@/themes/aurus/constants';
import type { ListingProduct } from '@/lib/storefrontApi';

const MiniStars: React.FC<{ r: number }> = ({ r }) => (
  <span className="inline-flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} className={`w-2.5 h-2.5 ${i <= Math.round(r) ? 'fill-[#F5A623] text-[#F5A623]' : 'text-gray-300'}`} />
    ))}
  </span>
);

/** Bridges the API's ListingProduct shape into the cart/registry contexts' Product type. */
function toCartProduct(p: ListingProduct): Product {
  return {
    id: p.id, theme: 'aurus', name: p.name, category: p.category?.name ?? '',
    price: p.price, mrp: p.mrp, image: p.image, badge: p.badge,
    rating: p.rating, reviews: p.reviewCount, desc: '',
  };
}

interface ProductGridProps {
  products: ListingProduct[];
  isFetching?: boolean;
}

/** Product card grid — preserves the original AurusListing card markup/styling, now driven by live API data. */
const ProductGrid: React.FC<ProductGridProps> = ({ products, isFetching }) => {
  const { addToCart, toggleWishlist, wishlist } = useStore();
  const { addToRegistry, isInRegistry } = useRegistry();
  const [registryOpen, setRegistryOpen] = useState<string | null>(null);

  if (products.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-[15px] text-gray-500" style={UI}>No products match the selected filters.</p>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-8"
      style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity 0.15s' }}
    >
      {products.map((p) => {
        const wished = wishlist.includes(p.id);
        const cartProduct = toCartProduct(p);

        return (
          <div key={p.id} className="group bg-white rounded-xl overflow-hidden border border-gray-100">
            <div className="relative aspect-square bg-[#f8f6f8] overflow-hidden">
              {p.badge === 'New Arrival' && (
                <span className="absolute top-2.5 left-2.5 z-10 bg-purple-600 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">Latest</span>
              )}
              {p.badge === 'Bestseller' && (
                <span className="absolute top-2.5 left-2.5 z-10 bg-[#B01F24] text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">Bestseller</span>
              )}
              {p.discount > 0 && (
                <span className="absolute top-2.5 right-2.5 z-10 bg-emerald-700 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">{p.discount}% OFF</span>
              )}

              <button
                onClick={() => toggleWishlist(p.id)}
                className="absolute bottom-2.5 right-2.5 z-10 bg-white/90 rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              >
                <Heart className={`w-3.5 h-3.5 ${wished ? 'fill-purple-700 text-purple-700' : 'text-gray-500'}`} />
              </button>

              <button
                onClick={(e) => { e.preventDefault(); setRegistryOpen(registryOpen === p.id ? null : p.id); }}
                className="absolute bottom-2.5 left-2.5 z-10 bg-white/90 rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                title="Add to Registry"
              >
                <Gift className={`w-3.5 h-3.5 ${isInRegistry(p.id) ? 'fill-pink-500 text-pink-500' : 'text-gray-500'}`} />
              </button>

              {registryOpen === p.id && (
                <div className="absolute inset-0 z-20 bg-white/97 flex flex-col items-center justify-center p-3 gap-2.5" style={{ backdropFilter: 'blur(4px)' }}>
                  <p className="text-[9px] font-bold text-gray-600 uppercase tracking-[0.12em]">Add to Registry</p>
                  <div className="grid grid-cols-3 gap-1.5 w-full">
                    {(Object.keys(OCCASIONS) as OccasionKey[]).map((occ) => {
                      const o = OCCASIONS[occ];
                      const inR = isInRegistry(p.id, occ);
                      return (
                        <button
                          key={occ}
                          onClick={() => { addToRegistry(cartProduct, occ); setRegistryOpen(null); }}
                          className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-all border"
                          style={{ background: inR ? o.bg : '#fff', borderColor: inR ? o.border : '#E5E7EB', color: o.color }}
                        >
                          <span className="text-[16px]">{inR ? '✓' : o.icon}</span>
                          <span className="text-[8.5px] font-semibold">{o.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => setRegistryOpen(null)} className="text-[9px] text-gray-400 hover:text-gray-600 mt-0.5">Cancel</button>
                </div>
              )}

              <Link to={`/products/${p.id}`}>
                <img
                  src={p.image} alt={p.name} loading="lazy"
                  className="w-full h-full object-cover group-hover:opacity-0 transition-opacity duration-300"
                />
                {p.hoverImage && (
                  <img
                    src={p.hoverImage} alt="" loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  />
                )}
              </Link>
            </div>

            {p.brand && (
              <div className="px-3 pt-3">
                <span className="text-[10px] font-semibold text-purple-600 uppercase tracking-wide" style={UI}>{p.brand.name}</span>
              </div>
            )}

            <div className="px-3 pt-1.5 pb-2">
              <Link to={`/products/${p.id}`}>
                <p className="text-[13px] text-gray-800 leading-snug hover:text-purple-700 transition-colors line-clamp-2" style={UI}>{p.name}</p>
              </Link>
              <div className="flex items-center gap-1 mt-1.5">
                <MiniStars r={p.rating} />
                <span className="text-[10px] text-gray-400">({p.reviewCount})</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1.5 flex-wrap">
                <span className="text-[14px] font-bold text-gray-900" style={UI}>{inr(p.price)}</span>
                {p.mrp > p.price && <span className="text-[11px] text-gray-400 line-through">{inr(p.mrp)}</span>}
                {p.discount > 0 && <span className="text-[10px] font-semibold text-emerald-700">{p.discount}% off</span>}
              </div>
            </div>

            <div className="flex border-t border-gray-100 mt-1">
              <Link
                to={`/products/${p.id}`}
                className="flex-1 text-center py-2.5 text-[11px] text-gray-500 hover:text-purple-700 hover:bg-purple-50 transition-colors font-medium"
                style={UI}
              >
                View Similar
              </Link>
              <div className="w-px bg-gray-100" />
              <button
                className="flex-1 py-2.5 text-[11px] text-gray-500 hover:text-purple-700 hover:bg-purple-50 transition-colors font-medium disabled:opacity-40"
                style={UI}
                disabled={p.stock <= 0}
                onClick={() => addToCart(cartProduct)}
              >
                {p.stock > 0 ? 'Add to Bag' : 'Out of Stock'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProductGrid;
