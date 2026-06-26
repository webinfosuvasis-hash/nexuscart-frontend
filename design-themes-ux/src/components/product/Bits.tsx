import React, { useState } from 'react';
import { Star, Minus, Plus } from 'lucide-react';

export const Stars: React.FC<{ rating: number; className?: string }> = ({ rating, className = '' }) => (
  <span className={`inline-flex items-center gap-0.5 ${className}`}>
    {[1, 2, 3, 4, 5].map(i => (
      <Star key={i} className={`w-4 h-4 ${i <= Math.round(rating) ? 'fill-current' : 'opacity-25'}`} />
    ))}
  </span>
);

interface QtyProps {
  qty: number;
  setQty: (n: number) => void;
  className?: string;
  btnClass?: string;
}
export const QtyPicker: React.FC<QtyProps> = ({ qty, setQty, className = '', btnClass = '' }) => (
  <div className={`inline-flex items-center ${className}`}>
    <button className={btnClass} onClick={() => setQty(Math.max(1, qty - 1))}><Minus className="w-4 h-4" /></button>
    <span className="px-5 font-semibold tabular-nums">{qty}</span>
    <button className={btnClass} onClick={() => setQty(qty + 1)}><Plus className="w-4 h-4" /></button>
  </div>
);

interface GalleryProps {
  images: string[];
  alt: string;
  thumbActiveClass?: string;
  thumbClass?: string;
  rounded?: string;
}
export const Gallery: React.FC<GalleryProps> = ({ images, alt, thumbActiveClass = 'ring-2 ring-gray-900', thumbClass = '', rounded = 'rounded-xl' }) => {
  const [active, setActive] = useState(0);
  return (
    <div>
      <div className={`overflow-hidden ${rounded} bg-gray-50`}>
        <img src={images[active]} alt={alt} className="w-full aspect-square object-cover" />
      </div>
      <div className="flex gap-3 mt-4">
        {images.map((img, i) => (
          <button key={i} onClick={() => setActive(i)} className={`w-16 h-16 overflow-hidden ${rounded} ${thumbClass} ${active === i ? thumbActiveClass : 'opacity-60 hover:opacity-100'}`}>
            <img src={img} alt={`${alt} ${i}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
};
