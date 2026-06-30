import React from 'react';
import { Truck, RotateCcw } from 'lucide-react';
import { UI } from '@/themes/aurus/constants';

/**
 * Static delivery-policy display — no shipping/serviceability backend exists
 * (confirmed during the PDP audit: no ShippingZone/Pincode model anywhere),
 * so this intentionally does not pretend to check a pincode against real
 * logistics data. Same standard as P1's removal of the fake "Best Selling"
 * sort: an honest static policy beats a wired-looking fake check.
 */
const DeliveryEstimate: React.FC = () => (
  <div className="flex flex-col gap-2.5">
    <div className="flex items-center gap-2.5">
      <Truck className="w-4 h-4 text-purple-600 flex-shrink-0" />
      <span className="text-[12px] text-gray-700" style={UI}>
        Standard delivery in <strong className="text-gray-900">3–7 business days</strong> · Free above ₹999
      </span>
    </div>
    <div className="flex items-center gap-2.5">
      <RotateCcw className="w-4 h-4 text-purple-600 flex-shrink-0" />
      <span className="text-[12px] text-gray-700" style={UI}>15-day easy returns</span>
    </div>
  </div>
);

export default DeliveryEstimate;
