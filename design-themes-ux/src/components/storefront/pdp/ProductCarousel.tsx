import React from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useStore, inr } from '@/context/StoreContext';
import { useCartContext } from '@/context/CartContext';
import { useAddToCart } from '@/hooks/useCart';
import { UI } from '@/themes/aurus/constants';
import type { ListingProduct } from '@/lib/storefrontApi';
import StarRow from './StarRow';

interface ProductCarouselProps {
  title:    string;
  products: ListingProduct[];
}

const ProductCarousel: React.FC<ProductCarouselProps> = ({ title, products }) => {
  const { toggleWishlist, wishlist } = useStore();
  const { setCartOpen } = useCartContext();
  const { mutate: addToCart } = useAddToCart();

  if (products.length === 0) return null;

  return (
    <section className="bg-white border-t border-gray-100 py-12">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-5">
        <h2 className="text-[20px] font-semibold text-gray-900 mb-6" style={UI}>{title}</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {products.map((p) => {
            const w = wishlist.includes(p.id);
            return (
              <div key={p.id} className="group bg-white border border-gray-100 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                <div className="relative aspect-square bg-[#F8F6F8] overflow-hidden">
                  {p.badge && (
                    <span className={`absolute top-2 left-2 z-10 text-white text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${p.badge === 'Bestseller' ? 'bg-[#B01F24]' : 'bg-purple-600'}`}>
                      {p.badge}
                    </span>
                  )}
                  <button
                    onClick={() => toggleWishlist(p.id)}
                    className="absolute top-2 right-2 z-10 bg-white/90 rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={w ? 'Remove from wishlist' : 'Add to wishlist'}
                  >
                    <Heart className={`w-3 h-3 ${w ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                  </button>
                  <Link to={`/products/${p.id}`}>
                    <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </Link>
                </div>
                <div className="p-2.5">
                  <Link to={`/products/${p.id}`}>
                    <p className="text-[11px] text-gray-800 line-clamp-2 hover:text-purple-700 transition-colors leading-snug" style={UI}>{p.name}</p>
                  </Link>
                  <div className="flex items-center gap-0.5 mt-1">
                    <StarRow r={p.rating} size={9} />
                    <span className="text-[9px] text-gray-500 ml-0.5">({p.reviewCount})</span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1 flex-wrap">
                    <span className="text-[12px] font-bold text-gray-900" style={UI}>{inr(p.price)}</span>
                    {p.mrp > p.price && <span className="text-[10px] text-gray-500 line-through">{inr(p.mrp)}</span>}
                    {p.discount > 0 && <span className="text-[9px] font-bold text-emerald-700">{p.discount}% off</span>}
                  </div>
                </div>
                <div className="flex border-t border-gray-100">
                  <Link to={`/products/${p.id}`} className="flex-1 text-center py-2 text-[10px] text-gray-500 hover:text-purple-700 hover:bg-purple-50 transition-colors font-medium" style={UI}>
                    View
                  </Link>
                  <div className="w-px bg-gray-100" />
                  <button
                    disabled={p.stock <= 0}
                    onClick={() =>
                      addToCart(
                        { productId: p.id, quantity: 1 },
                        { onSuccess: () => setCartOpen(true) },
                      )
                    }
                    className="flex-1 py-2 text-[10px] text-gray-500 hover:text-purple-700 hover:bg-purple-50 transition-colors font-medium disabled:opacity-40"
                    style={UI}
                    aria-label={p.stock > 0 ? `Add ${p.name} to bag` : 'Out of stock'}
                  >
                    {p.stock > 0 ? 'Add to Bag' : 'Out of Stock'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ProductCarousel;
