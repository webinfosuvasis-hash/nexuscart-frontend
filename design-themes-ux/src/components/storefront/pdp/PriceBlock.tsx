import React from 'react';
import { inr } from '@/context/StoreContext';
import { UI } from '@/themes/aurus/constants';

interface PriceBlockProps {
  price:    number;
  mrp:      number;
  discount: number;
}

const PriceBlock: React.FC<PriceBlockProps> = ({ price, mrp, discount }) => {
  const savings = mrp - price;
  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-[28px] font-bold text-gray-900" style={UI}>{inr(price)}</span>
        {mrp > price && <span className="text-[16px] text-gray-500 line-through">{inr(mrp)}</span>}
        {discount > 0 && (
          <span className="text-[12px] font-bold text-white bg-[#C2185B] px-2.5 py-0.5 rounded-sm">{discount}% OFF</span>
        )}
      </div>
      {savings > 0 && (
        <p className="text-[12px] text-gray-500 mt-1" style={UI}>
          You save <span className="font-semibold text-gray-700">{inr(savings)}</span> (incl. of all taxes)
        </p>
      )}
    </div>
  );
};

export default PriceBlock;
