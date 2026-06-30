import React from 'react';
import { Check } from 'lucide-react';
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
        {mrp > price && <span className="text-[16px] text-gray-400 line-through">{inr(mrp)}</span>}
        {discount > 0 && (
          <span className="text-[12px] font-bold text-white bg-[#E91E8C] px-2.5 py-0.5 rounded-sm">{discount}% OFF</span>
        )}
      </div>
      {savings > 0 && (
        <p className="text-[12px] text-gray-500 mt-1" style={UI}>
          You save <span className="font-semibold text-gray-700">{inr(savings)}</span> (incl. of all taxes)
        </p>
      )}
      {discount >= 30 && (
        <div className="mt-3 flex items-center gap-2 bg-[#E8F5E9] border border-[#C8E6C9] px-3.5 py-2.5 rounded-sm">
          <Check className="w-4 h-4 text-[#2E7D32] flex-shrink-0" />
          <span className="text-[12px] font-semibold text-[#1B5E20]" style={UI}>Best Price Guaranteed</span>
        </div>
      )}
    </div>
  );
};

export default PriceBlock;
