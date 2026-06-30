import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { UI } from '@/themes/aurus/constants';
import type { ProductAttributeGroup } from '@/lib/storefrontApi';

const Acc: React.FC<{ title: string; children: React.ReactNode; open?: boolean }> = ({ title, children, open: defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-3.5 text-[13px] font-semibold text-gray-800 hover:text-purple-700 transition-colors text-left"
        style={UI}
      >
        {title}
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pb-4 text-[12.5px] text-gray-600 leading-relaxed" style={UI}>{children}</div>}
    </div>
  );
};

interface SpecsAccordionProps {
  sku:               string;
  category?:         string;
  description:       string | null;
  shortDescription:  string | null;
  attributes:        ProductAttributeGroup[];
}

/**
 * One real accordion section per store-defined attribute group (fabric,
 * material, occasion, ...) plus a Product Details block from real product
 * fields — replaces the previously hardcoded "Stone Details"/fixed fabric
 * facts. Care & Return Policy stay static store-wide policy text (no
 * per-product policy data model exists), clearly separated from product data.
 */
const SpecsAccordion: React.FC<SpecsAccordionProps> = ({ sku, category, description, shortDescription, attributes }) => (
  <>
    <Acc title="Product Details" open>
      <ul className="space-y-1.5">
        <li><span className="font-semibold text-gray-700">SKU:</span> {sku}</li>
        {category && <li><span className="font-semibold text-gray-700">Category:</span> {category}</li>}
        {shortDescription && <li><span className="font-semibold text-gray-700">Summary:</span> {shortDescription}</li>}
        {description && <li><span className="font-semibold text-gray-700">Description:</span> {description}</li>}
      </ul>
    </Acc>

    {attributes.map((group) => (
      <Acc key={group.slug} title={group.name}>
        <ul className="space-y-1.5">
          {group.values.map((v) => (
            <li key={v.value}>{v.label}</li>
          ))}
        </ul>
      </Acc>
    ))}

    <Acc title="Care Instructions">
      <p>Store in a cool, dry place away from direct sunlight. Avoid contact with perfumes, lotions, and cleaning agents. Clean gently with a soft dry cloth.</p>
    </Acc>

    <Acc title="Return & Exchange Policy">
      <p>15-day return policy from date of delivery. Items must be unused, undamaged, and in original packaging. Exchange available for manufacturing defects.</p>
    </Acc>
  </>
);

export default SpecsAccordion;
