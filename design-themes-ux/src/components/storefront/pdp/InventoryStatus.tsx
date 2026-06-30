import React from 'react';
import { UI } from '@/themes/aurus/constants';

const LOW_STOCK_THRESHOLD = 5;

const InventoryStatus: React.FC<{ stock: number }> = ({ stock }) => {
  if (stock <= 0) {
    return <p className="text-[12px] font-semibold text-red-600 mt-2" style={UI}>Out of Stock</p>;
  }
  if (stock <= LOW_STOCK_THRESHOLD) {
    return <p className="text-[12px] font-semibold text-orange-600 mt-2" style={UI}>Only {stock} left — order soon</p>;
  }
  return <p className="text-[12px] font-semibold text-[#2E7D32] mt-2" style={UI}>In Stock</p>;
};

export default InventoryStatus;
