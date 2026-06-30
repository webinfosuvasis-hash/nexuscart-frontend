import React from 'react';
import { Star } from 'lucide-react';

const StarRow: React.FC<{ r: number; size?: number }> = ({ r, size = 13 }) => (
  <span className="inline-flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        style={{ width: size, height: size }}
        className={i <= Math.round(r) ? 'fill-[#F5A623] text-[#F5A623]' : 'text-gray-300'}
      />
    ))}
  </span>
);

export default StarRow;
