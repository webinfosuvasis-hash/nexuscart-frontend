import React, { useEffect, useState } from 'react';
import { Heart, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { UI } from '@/themes/aurus/constants';

interface ProductGalleryProps {
  images:   string[];
  name:     string;
  wished:   boolean;
  onToggleWishlist: () => void;
}

/** Main image + arrow/dot nav + thumbnail grid + wishlist/share row — same markup as the original AurusProduct, now image-source-agnostic. */
const ProductGallery: React.FC<ProductGalleryProps> = ({ images, name, wished, onToggleWishlist }) => {
  const [activeImg, setActiveImg] = useState(0);
  const safeImages = images.length ? images : ['/placeholder.svg'];
  const current = Math.min(activeImg, safeImages.length - 1);

  // `images` gets a new array reference (variant image prepended) every time the
  // selected variant changes — without this, a previously-clicked thumbnail
  // index keeps pointing into the *new* array at the wrong position, showing a
  // stale image that no longer matches the selected variant.
  useEffect(() => {
    setActiveImg(0);
  }, [images.join('|')]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: name, url: window.location.href }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
  };

  return (
    <div>
      <div className="relative bg-[#F8F6F8] overflow-hidden">
        <img src={safeImages[current]} alt={name} className="w-full aspect-square object-cover" />
        {safeImages.length > 1 && (
          <>
            <button
              onClick={() => setActiveImg((i) => (i - 1 + safeImages.length) % safeImages.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-md rounded-full p-2 transition-all"
            >
              <ChevronLeft className="w-4 h-4 text-gray-700" />
            </button>
            <button
              onClick={() => setActiveImg((i) => (i + 1) % safeImages.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-md rounded-full p-2 transition-all"
            >
              <ChevronRight className="w-4 h-4 text-gray-700" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {safeImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? 'bg-purple-700 w-4' : 'bg-gray-400/60'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {safeImages.length > 1 && (
        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
          {safeImages.slice(0, 4).map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveImg(i)}
              className={`relative aspect-square overflow-hidden bg-[#F8F6F8] transition-all ${
                current === i ? 'ring-2 ring-purple-600 ring-offset-1' : 'opacity-75 hover:opacity-100'
              }`}
            >
              <img src={img} alt={`View ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
        <button
          onClick={onToggleWishlist}
          className="flex items-center gap-2 text-[12px] text-gray-600 hover:text-red-500 transition-colors"
          style={UI}
        >
          <Heart className={`w-4 h-4 ${wished ? 'fill-red-500 text-red-500' : ''}`} />
          {wished ? 'Wishlisted' : 'Add to Wishlist'}
        </button>
        <button onClick={handleShare} className="flex items-center gap-1 text-[12px] text-gray-500 hover:text-purple-700 transition-colors" style={UI}>
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </button>
      </div>
    </div>
  );
};

export default ProductGallery;
