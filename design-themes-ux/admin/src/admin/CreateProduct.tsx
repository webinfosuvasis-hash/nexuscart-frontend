import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Save, Eye, Check, Info, AlertTriangle,
  FileText, Image as ImageIcon, DollarSign, Package,
  Grid3X3, Zap, Truck, Search as SearchIcon, Link2, Globe,
  Plus, X, ChevronDown, ChevronRight,
  Bold, Italic, Underline, List, AlignLeft, AlignCenter, AlignRight,
  Upload, Video, Star, Tag, Layers, RefreshCw,
  Calendar, Clock, Shield, ShoppingBag, CreditCard, Hash,
  Move, RotateCcw, TrendingUp, BarChart3, Settings2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, Btn, Badge } from './ui';
import { useCreateProduct, useUpdateProduct } from '@/hooks/useProducts';
import { useFlatCategories } from '@/hooks/useCategories';
import { useBrands } from '@/hooks/useBrands';
import { useCollections } from '@/hooks/useCollections';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProductForm {
  name: string; slug: string; shortDescription: string; description: string;
  productType: 'simple' | 'variable' | 'digital' | 'bundle';
  categoryIds: string[]; collectionIds: string[]; brandId: string;
  tags: string[]; badges: string[];
  featuredImage: string; gallery: { url: string; alt: string }[]; videoUrl: string;
  price: string; comparePrice: string; costPrice: string;
  sku: string; barcode: string; stock: string; lowStockAlert: string;
  trackInventory: boolean; allowBackorders: boolean; continueSelling: boolean;
  hasVariants: boolean;
  attributeSetId: string; attributeValues: Record<string, string>;
  isPhysical: boolean;
  weight: string; weightUnit: 'kg' | 'g' | 'lb';
  length: string; width: string; height: string; dimensionUnit: 'cm' | 'in';
  taxCategory: string; hsCode: string; priceIncludesTax: boolean;
  countryOfOrigin: string;
  metaTitle: string; metaDescription: string; canonicalUrl: string;
  relatedProductIds: string[]; crossSellIds: string[]; upsellIds: string[];
  status: 'draft' | 'active' | 'archived';
  visibility: 'published' | 'hidden' | 'members_only' | 'wholesale_only';
  publishAt: string; expiresAt: string;
  allowReviews: boolean; moderateReviews: boolean;
  vendorId: string; vendorCommission: string;
}

interface VariantOption { id: string; name: string; values: string }
interface GeneratedVariant {
  id: string; combination: Record<string, string>; price: string;
  sku: string; barcode: string; stock: string; weight: string; image: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
// Categories, brands, and collections are loaded from the API — see hooks below

const MOCK_ATTRIBUTE_SETS = [
  {
    id: 'as1', name: 'Fashion',
    attributes: [
      { id: 'a1', name: 'Fabric', type: 'dropdown', options: ['Cotton', 'Silk', 'Polyester', 'Linen', 'Wool'] },
      { id: 'a2', name: 'Pattern', type: 'dropdown', options: ['Solid', 'Printed', 'Embroidered', 'Woven'] },
      { id: 'a3', name: 'Sleeve Type', type: 'dropdown', options: ['Full', 'Half', 'Sleeveless', '3/4th'] },
      { id: 'a4', name: 'Neck Type', type: 'dropdown', options: ['Round', 'V-Neck', 'Collar', 'Halter'] },
      { id: 'a5', name: 'Occasion', type: 'text', options: [] },
      { id: 'a6', name: 'Care Instructions', type: 'text', options: [] },
    ],
  },
  {
    id: 'as2', name: 'Electronics',
    attributes: [
      { id: 'b1', name: 'RAM', type: 'dropdown', options: ['4GB', '6GB', '8GB', '12GB', '16GB'] },
      { id: 'b2', name: 'Storage', type: 'dropdown', options: ['64GB', '128GB', '256GB', '512GB'] },
      { id: 'b3', name: 'Processor', type: 'text', options: [] },
      { id: 'b4', name: 'Battery', type: 'text', options: [] },
      { id: 'b5', name: 'Display', type: 'text', options: [] },
      { id: 'b6', name: 'OS', type: 'dropdown', options: ['Android', 'iOS', 'Windows', 'macOS'] },
    ],
  },
];

const MOCK_PRODUCTS = [
  { id: 'p1', name: 'Red Cotton Saree', price: 1799 },
  { id: 'p2', name: 'Blue Silk Saree', price: 3499 },
  { id: 'p3', name: 'Premium Chanderi Saree', price: 4999 },
  { id: 'p4', name: 'Banarasi Silk Saree', price: 6999 },
  { id: 'p5', name: 'Cotton Embroidered Kurti', price: 899 },
  { id: 'p6', name: 'Matching Blouse', price: 499 },
];

const MOCK_VENDORS = [
  { id: 'v1', name: 'Suta Boutique' }, { id: 'v2', name: 'Fabindia Store' },
  { id: 'v3', name: 'W Flagship' },
];

const BADGE_OPTIONS = ['New', 'Best Seller', 'Trending', 'Limited Stock', 'Exclusive', 'Sale'];

const TABS = [
  { id: 'general', label: 'General', icon: FileText },
  { id: 'media', label: 'Media', icon: ImageIcon },
  { id: 'pricing', label: 'Pricing', icon: DollarSign },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'variants', label: 'Variants', icon: Grid3X3 },
  { id: 'attributes', label: 'Attributes', icon: Zap },
  { id: 'shipping', label: 'Shipping', icon: Truck },
  { id: 'seo', label: 'SEO', icon: SearchIcon },
  { id: 'related', label: 'Related', icon: Link2 },
  { id: 'publishing', label: 'Publishing', icon: Globe },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function cartesian(arrays: string[][]): string[][] {
  return arrays.reduce<string[][]>(
    (acc, curr) => acc.flatMap((a) => curr.map((c) => [...a, c])),
    [[]],
  );
}

// ─── Rich Text Editor ─────────────────────────────────────────────────────────
const RichTextEditor: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const ref = useRef<HTMLDivElement>(null);
  const exec = (cmd: string, val?: string) => { document.execCommand(cmd, false, val); ref.current?.focus(); };

  const tools = [
    { icon: Bold, cmd: 'bold', title: 'Bold' },
    { icon: Italic, cmd: 'italic', title: 'Italic' },
    { icon: Underline, cmd: 'underline', title: 'Underline' },
  ];

  return (
    <div className="border border-slate-300 dark:border-slate-600 rounded-xl overflow-hidden">
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600 flex-wrap gap-y-1">
        {tools.map(({ icon: Icon, cmd, title }) => (
          <button key={cmd} title={title} onMouseDown={(e) => { e.preventDefault(); exec(cmd); }}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300">
            <Icon size={13} />
          </button>
        ))}
        <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1" />
        <button title="Bullet list" onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"><List size={13} /></button>
        <button title="Align left" onMouseDown={(e) => { e.preventDefault(); exec('justifyLeft'); }}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"><AlignLeft size={13} /></button>
        <button title="Align center" onMouseDown={(e) => { e.preventDefault(); exec('justifyCenter'); }}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"><AlignCenter size={13} /></button>
        <button title="Align right" onMouseDown={(e) => { e.preventDefault(); exec('justifyRight'); }}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"><AlignRight size={13} /></button>
        <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1" />
        <select onChange={(e) => exec('formatBlock', e.target.value)} defaultValue=""
          className="text-xs border-none bg-transparent text-slate-600 dark:text-slate-300 cursor-pointer focus:outline-none">
          <option value="" disabled>Format</option>
          <option value="p">Paragraph</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="blockquote">Quote</option>
        </select>
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        dangerouslySetInnerHTML={{ __html: value }}
        className="min-h-40 p-3 text-sm text-slate-800 dark:text-slate-200 focus:outline-none" />
    </div>
  );
};

// ─── Tag Input ────────────────────────────────────────────────────────────────
const TagInput: React.FC<{ tags: string[]; onChange: (t: string[]) => void; placeholder?: string }> = ({ tags, onChange, placeholder = 'Add tag…' }) => {
  const [input, setInput] = useState('');
  const add = (val: string) => {
    const v = val.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput('');
  };
  return (
    <div className="flex flex-wrap gap-1.5 p-2 border border-slate-300 dark:border-slate-600 rounded-xl min-h-10 bg-white dark:bg-slate-900">
      {tags.map((t) => (
        <span key={t} className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium">
          {t} <button onClick={() => onChange(tags.filter((x) => x !== t))}><X size={11} /></button>
        </span>
      ))}
      <input value={input} onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input); } }}
        onBlur={() => add(input)}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-20 text-sm text-slate-800 dark:text-slate-200 bg-transparent focus:outline-none" />
    </div>
  );
};

// ─── Option Value Tags — Shopify-style chip input ─────────────────────────────
const OptionValueTags: React.FC<{
  values: string;
  onChange: (v: string) => void;
  optionName?: string;       // e.g. "Color" → placeholder says "Enter Color value"
}> = ({ values, onChange, optionName }) => {
  const [input,    setInput]    = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const tags = values.split(',').map((v) => v.trim()).filter(Boolean);

  const add = (raw: string) => {
    const v = raw.trim();
    if (v && !tags.includes(v)) onChange([...tags, v].join(', '));
    setInput('');
  };
  const commit = () => { add(input); };
  const cancel  = () => { setInput(''); setIsAdding(false); };
  const remove  = (tag: string) => onChange(tags.filter((t) => t !== tag).join(', '));

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
      {/* Chip list */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2.5 pb-2">
          {tags.map((tag) => (
            <span key={tag} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-full text-xs font-medium">
              {tag}
              <button type="button" onClick={() => remove(tag)}
                className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-red-200 dark:hover:bg-red-700 text-slate-400 hover:text-red-600 transition-colors">
                <X size={9} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input row — shown when adding, or always if no tags yet */}
      {(isAdding || tags.length === 0) ? (
        <div className={`flex items-center gap-2 px-2.5 py-2 ${tags.length > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}`}>
          <input
            ref={inputRef}
            value={input}
            autoFocus
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              if (e.key === 'Escape') cancel();
            }}
            placeholder={`Enter ${optionName ? optionName + ' ' : ''}value…`}
            className="flex-1 text-sm text-slate-800 dark:text-slate-200 bg-transparent focus:outline-none placeholder:text-slate-400"
          />
          <button type="button" onClick={commit}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors">
            Add
          </button>
          {tags.length > 0 && (
            <button type="button" onClick={cancel} className="text-xs text-slate-400 hover:text-slate-600 px-1">
              Cancel
            </button>
          )}
        </div>
      ) : (
        /* "+ Add another value" trigger */
        <button type="button" onClick={() => { setIsAdding(true); setTimeout(() => inputRef.current?.focus(), 0); }}
          className="flex items-center gap-1.5 w-full px-3 py-2.5 text-sm text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-t border-slate-100 dark:border-slate-800">
          <Plus size={13} className="flex-shrink-0" />
          Add another value
        </button>
      )}
    </div>
  );
};

// ─── Image Drop Zone ──────────────────────────────────────────────────────────
const ImageDropZone: React.FC<{ label: string; hint?: string; value: string; onChange: (v: string) => void; large?: boolean }> = ({
  label, hint, value, onChange, large,
}) => (
  <div
    onClick={() => { onChange(`https://picsum.photos/seed/${Math.random().toString(36).slice(2)}/800/600`); toast.success('Image uploaded'); }}
    className={`border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-indigo-400 transition-colors overflow-hidden group ${large ? 'aspect-video' : 'aspect-square'}`}
  >
    {value ? (
      <div className="relative w-full h-full">
        <img src={value} alt="preview" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <p className="text-white text-xs font-medium">Click to replace</p>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onChange(''); }}
          className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-colors">
          <X size={12} />
        </button>
      </div>
    ) : (
      <div className="flex flex-col items-center justify-center w-full h-full p-4 text-center">
        <Upload size={20} className="text-slate-400 mb-2" />
        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</p>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
    )}
  </div>
);

// ─── Toggle Switch ────────────────────────────────────────────────────────────
const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }> = ({ checked, onChange, label, hint }) => (
  <label className="flex items-center justify-between gap-3 cursor-pointer">
    <div>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</p>
      {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
    </div>
    <div onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </div>
  </label>
);

// ─── Field Label ──────────────────────────────────────────────────────────────
const Label: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required }) => (
  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
    {children}{required && <span className="text-red-500 ml-0.5">*</span>}
  </p>
);

// ─── Input ────────────────────────────────────────────────────────────────────
const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { prefix?: string; suffix?: string; error?: string }> = ({
  prefix, suffix, error, className, ...rest
}) => (
  <div className="relative">
    {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{prefix}</span>}
    <input
      {...rest}
      className={`w-full px-3 py-2 rounded-xl border ${error ? 'border-red-400' : 'border-slate-300 dark:border-slate-600'} bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-12' : ''} ${className ?? ''}`}
    />
    {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">{suffix}</span>}
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

// ─── Select ───────────────────────────────────────────────────────────────────
const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ children, className, ...rest }) => (
  <select {...rest} className={`w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none ${className ?? ''}`}>
    {children}
  </select>
);

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="mb-4">
    <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
    {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
  </div>
);

// ─── Default Form State ───────────────────────────────────────────────────────
const DEFAULT_FORM: ProductForm = {
  name: '', slug: '', shortDescription: '', description: '',
  productType: 'simple',
  categoryIds: [], collectionIds: [], brandId: '', tags: [], badges: [],
  featuredImage: '', gallery: [], videoUrl: '',
  price: '', comparePrice: '', costPrice: '',
  sku: '', barcode: '', stock: '', lowStockAlert: '5',
  trackInventory: true, allowBackorders: false, continueSelling: false,
  hasVariants: false,
  attributeSetId: '', attributeValues: {},
  isPhysical: true,
  weight: '', weightUnit: 'kg',
  length: '', width: '', height: '', dimensionUnit: 'cm',
  taxCategory: 'GST 18%', hsCode: '', priceIncludesTax: false,
  countryOfOrigin: 'IN',
  metaTitle: '', metaDescription: '', canonicalUrl: '',
  relatedProductIds: [], crossSellIds: [], upsellIds: [],
  status: 'draft',
  visibility: 'published',
  publishAt: '', expiresAt: '',
  allowReviews: true, moderateReviews: false,
  vendorId: '', vendorCommission: '15',
};

// ─── Main Component ───────────────────────────────────────────────────────────
const CreateProduct: React.FC<{ onBack: () => void; product?: any }> = ({ onBack, product }) => {
  const isEdit = !!product;
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  // Live data from API
  const { data: flatCatsData } = useFlatCategories();
  const { data: brandsData } = useBrands();
  const { data: collectionsData } = useCollections();

  const flatCats = flatCatsData ?? [];
  const brands: { id: string; name: string }[] = Array.isArray(brandsData)
    ? brandsData
    : (brandsData as any)?.items ?? [];
  const collections: { id: string; name: string }[] = Array.isArray(collectionsData)
    ? collectionsData
    : (collectionsData as any)?.items ?? [];
  const [tab, setTab] = useState('general');
  // Sanitize product from API: DB JSON fields can be null, but form expects arrays/strings
  const sanitizeProduct = (p: any): Partial<ProductForm> => ({
    ...p,
    categoryIds: Array.isArray(p.categoryIds) ? p.categoryIds : p.categoryId ? [p.categoryId] : [],
    collectionIds: Array.isArray(p.collectionIds) ? p.collectionIds : [],
    tags: Array.isArray(p.tags) ? p.tags : [],
    badges: Array.isArray(p.badges) ? p.badges : [],
    gallery: Array.isArray(p.gallery) ? p.gallery : (Array.isArray(p.images) ? p.images.map((url: string) => ({ url, alt: '' })) : []),
    relatedProductIds: Array.isArray(p.relatedProductIds) ? p.relatedProductIds : [],
    crossSellIds: Array.isArray(p.crossSellIds) ? p.crossSellIds : [],
    upsellIds: Array.isArray(p.upsellIds) ? p.upsellIds : [],
    attributeValues: p.attributeValues ?? {},
    price: p.price != null ? String(p.price) : '',
    // Treat 0 as unset — shows blank field, not "0.00"
    comparePrice: p.comparePrice && Number(p.comparePrice) > 0 ? String(p.comparePrice) : '',
    costPrice:    p.costPrice    && Number(p.costPrice)    > 0 ? String(p.costPrice)    : '',
    stock: p.stock != null ? String(p.stock) : '',
    lowStockAlert: p.lowStockThreshold != null ? String(p.lowStockThreshold) : '5',
    weight: p.weight != null ? String(p.weight) : '',
    featuredImage: p.thumbnail ?? p.featuredImage ?? '',
    // String fields that can be null in DB — always coerce to string for controlled inputs
    brandId: p.brandId ?? '',
    attributeSetId: p.attributeSetId ?? '',
    videoUrl: p.videoUrl ?? '',
    shortDescription: p.shortDescription ?? '',
    description: p.description ?? '',
    sku: p.sku ?? '',
    barcode: p.barcode ?? '',
    metaTitle: p.metaTitle ?? '',
    metaDescription: p.metaDescription ?? '',
    canonicalUrl: p.canonicalUrl ?? '',
    taxCategory: p.taxCategory ?? 'GST 18%',
    hsCode: p.hsCode ?? '',
    priceIncludesTax: p.priceIncludesTax ?? false,
    countryOfOrigin: p.countryOfOrigin ?? 'IN',
    vendorId: p.vendorId ?? '',
    vendorCommission: p.vendorCommission != null ? String(p.vendorCommission) : '15',
    publishAt: p.publishAt ?? '',
    expiresAt: p.expiresAt ?? '',
    status: (p.status ?? 'DRAFT').toLowerCase() as any,
    productType: p.productType ?? 'simple',
    hasVariants: Array.isArray(p.variants) && p.variants.length > 0,
  });

  const [form, setForm] = useState<ProductForm>(
    product ? { ...DEFAULT_FORM, ...sanitizeProduct(product) } : DEFAULT_FORM
  );
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>(() => {
    // When editing, rebuild option axes from the stored options JSON on each variant
    if (product?.variants?.length) {
      const axisMap: Record<string, Set<string>> = {};
      for (const v of product.variants as any[]) {
        const opts =
          v.options && typeof v.options === 'object' ? v.options : {};
        for (const [key, val] of Object.entries(opts)) {
          if (!axisMap[key]) axisMap[key] = new Set();
          axisMap[key].add(String(val));
        }
      }
      const restored = Object.entries(axisMap).map(([name, vals], i) => ({
        id: `axis-${i}`,
        name,
        values: [...vals].join(', '),
      }));
      if (restored.length > 0) return restored;
    }
    // Default: empty Color + Size axes
    return [
      { id: 'v1', name: 'Color', values: '' },
      { id: 'v2', name: 'Size', values: '' },
    ];
  });

  // When editing, restore existing variants from the product
  const [variants, setVariants] = useState<GeneratedVariant[]>(() => {
    if (!product?.variants?.length) return [];
    return (product.variants as any[]).map((v: any, i: number) => ({
      id: `existing-${i}`,
      // options JSON stores combination; fallback to parsing name ("Red / L")
      combination: v.options && typeof v.options === 'object'
        ? v.options
        : { Variant: v.name },
      price: String(v.price ?? ''),
      sku: v.sku ?? '',
      barcode: v.barcode ?? '',
      stock: String(v.stock ?? '0'),
      weight: String(v.weight ?? ''),
      image: v.image ?? '',
    }));
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [relSearch, setRelSearch] = useState('');

  const set = (k: keyof ProductForm, v: any) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  // Pricing auto-calc
  const price = parseFloat(form.price) || 0;
  const comparePrice = parseFloat(form.comparePrice) || 0;
  const costPrice = parseFloat(form.costPrice) || 0;
  const profit = price - costPrice;
  const margin = price > 0 ? ((profit / price) * 100).toFixed(1) : '0.0';
  const markup = costPrice > 0 ? ((profit / costPrice) * 100).toFixed(1) : '0.0';
  const discount = comparePrice > price && comparePrice > 0 ? Math.round(((comparePrice - price) / comparePrice) * 100) : 0;

  // Stable key for a combination — sorted so insertion order doesn't matter
  // Must be defined before any useMemo/useEffect that references it
  const comboKey = (combo: Record<string, string>) =>
    Object.entries(combo)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join('|');

  // ─── Out-of-sync detection ────────────────────────────────────────────────
  // Signature of the options state that was last used to generate variants
  const optionsSig = (opts: VariantOption[]) =>
    opts
      .filter((o) => o.name.trim() && o.values.trim())
      .map((o) => `${o.name.trim()}:${o.values.split(',').map((v) => v.trim()).filter(Boolean).sort().join(',')}`)
      .sort()
      .join('|');

  const [committedSig, setCommittedSig] = useState('');

  // On mount: if we're editing a product with existing variants, treat the restored
  // variantOptions as the committed state so we don't immediately show the warning
  useEffect(() => {
    if (variants.length > 0 && committedSig === '') {
      setCommittedSig(optionsSig(variantOptions));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentSig  = optionsSig(variantOptions);
  const isOutOfSync = variants.length > 0 && committedSig !== '' && currentSig !== committedSig;

  // ─── Live variant preview (computed from current options, not committed) ──
  const previewData = useMemo(() => {
    const opts = variantOptions.filter((o) => o.name.trim() && o.values.trim());
    if (opts.length === 0) return { combos: [], newOnes: [], removed: [], kept: [] };

    const arrays = opts.map((o) => o.values.split(',').map((v) => v.trim()).filter(Boolean));
    const combos = cartesian(arrays).map((combo) => {
      const comb: Record<string, string> = {};
      opts.forEach((o, i) => { comb[o.name] = combo[i]; });
      return comb;
    });

    const existingKeys = new Set(variants.map((v) => comboKey(v.combination)));
    const newKeys      = new Set(combos.map((c) => comboKey(c)));

    return {
      combos,
      newOnes:        combos.filter((c) => !existingKeys.has(comboKey(c))),
      kept:           variants.filter((v) =>  newKeys.has(comboKey(v.combination))),
      // "outside options" = exist but not in new combos — they are KEPT, not removed
      outsideOptions: variants.filter((v) => !newKeys.has(comboKey(v.combination))),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantOptions, variants]);

  // ─── Variant diff state ───────────────────────────────────────────────────
  // (Removal confirmation removed — variants are never auto-deleted, only added)
  // Bulk-edit state
  const [selectedIds,  setSelectedIds]  = useState<string[]>([]);
  const [bulkField,    setBulkField]    = useState('price');
  const [bulkMode,     setBulkMode]     = useState<'set' | 'increase'>('set');
  const [bulkValue,    setBulkValue]    = useState('');
  const [showBulkBar,  setShowBulkBar]  = useState(false);

  // Build a new variant row, preserving data from an existing one if the combo matches
  const buildVariantRow = (
    combo: string[],
    opts: VariantOption[],
    existingMap: Map<string, GeneratedVariant>,
  ): GeneratedVariant => {
    const combination: Record<string, string> = {};
    opts.forEach((o, i) => { combination[o.name] = combo[i]; });
    const key  = comboKey(combination);
    const prev = existingMap.get(key);
    return {
      id:      `var-${key}`,
      combination,
      price:   prev != null ? prev.price   : form.price,
      sku:     prev != null ? prev.sku     : `${form.sku || 'VAR'}-${combo.join('-').toUpperCase().replace(/\s+/g, '-')}`,
      barcode: prev != null ? prev.barcode : '',
      stock:   prev != null ? prev.stock   : (form.stock || '0'),
      weight:  prev != null ? prev.weight  : (form.weight || ''),
      image:   prev != null ? prev.image   : '',
    };
  };

  // Update variants: MERGE — add new combinations, keep ALL existing variants
  // (including "orphaned" ones outside current options).
  // Nothing is ever auto-removed. Merchant deletes with ✕ if they want.
  const smartUpdateVariants = () => {
    const opts = variantOptions.filter((o) => o.name.trim() && o.values.trim());
    if (opts.length === 0) { toast.error('Add at least one variant option with values'); return; }

    const arrays       = opts.map((o) => o.values.split(',').map((v) => v.trim()).filter(Boolean));
    const combinations = cartesian(arrays);

    setVariants((currentVariants) => {
      const existingMap = new Map(currentVariants.map((v) => [comboKey(v.combination), v]));
      const newKeySet   = new Set(combinations.map((combo) => {
        const comb: Record<string, string> = {};
        opts.forEach((o, i) => { comb[o.name] = combo[i]; });
        return comboKey(comb);
      }));

      // Build rows for every combination defined in options (preserving existing data)
      const fromOptions = combinations.map((combo) => buildVariantRow(combo, opts, existingMap));

      // Keep variants that are outside the current options — they are NOT removed
      const orphaned = currentVariants.filter((v) => !newKeySet.has(comboKey(v.combination)));

      return [...fromOptions, ...orphaned];
    });

    setCommittedSig(optionsSig(opts));
    const added = combinations.filter((combo) => {
      const comb: Record<string, string> = {};
      opts.forEach((o, i) => { comb[o.name] = combo[i]; });
      return !variants.some((v) => comboKey(v.combination) === comboKey(comb));
    });
    toast.success(added.length > 0 ? `+${added.length} new variant${added.length > 1 ? 's' : ''} added` : 'Variants up-to-date');
  };

  const updateVariant = (id: string, field: keyof GeneratedVariant, value: string) => {
    setVariants((v) => v.map((x) => x.id === id ? { ...x, [field]: value } : x));
  };

  const toggleSelect = (id: string) =>
    setSelectedIds((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const toggleSelectAll = () =>
    setSelectedIds(selectedIds.length === variants.length ? [] : variants.map((v) => v.id));

  const applyBulkEdit = () => {
    if (!bulkValue.trim()) return;
    const num = parseFloat(bulkValue);
    setVariants((prev) => prev.map((v) => {
      if (!selectedIds.includes(v.id)) return v;
      if (bulkField === 'price') {
        return { ...v, price: String(bulkMode === 'increase' ? Math.max(0, parseFloat(v.price || '0') + num) : num) };
      }
      if (bulkField === 'stock') {
        return { ...v, stock: String(bulkMode === 'increase' ? Math.max(0, parseInt(v.stock || '0') + Math.round(num)) : Math.round(num)) };
      }
      if (bulkField === 'weight') {
        return { ...v, weight: String(bulkMode === 'increase' ? Math.max(0, parseFloat(v.weight || '0') + num) : num) };
      }
      return v;
    }));
    setSelectedIds([]);
    setBulkValue('');
    setShowBulkBar(false);
    toast.success(`Bulk edit applied to ${selectedIds.length} variants`);
  };

  // Validation
  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Product name is required';
    if (!form.price) e.price = 'Selling price is required';
    if (form.hasVariants && variants.length === 0) {
      e.variants = 'Click "Update Variants" before saving';
      setTab('variants');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildPayload = (statusOverride?: string) => {
    // Map form state → CreateProductDto shape expected by backend
    const resolvedStatus = statusOverride
      ? statusOverride.toUpperCase()
      : form.status.toUpperCase();

    // Variant name = joined combination values (e.g. "Red / L")
    const productPrice = parseFloat(form.price) || 0;

    const variantPayload = form.hasVariants && variants.length > 0
      ? variants.map((v, i) => {
          const name = Object.values(v.combination).join(' / ') || `Variant ${i + 1}`;
          // Build a deterministic, unique SKU: base-COLOR-SIZE (no spaces)
          const skuSuffix = Object.values(v.combination)
            .map((x) => String(x).toUpperCase().replace(/\s+/g, ''))
            .join('-');
          const sku = (v.sku || '').trim() || `${form.sku || 'VAR'}-${skuSuffix}-${i + 1}`;
          const price = parseFloat(v.price) > 0 ? parseFloat(v.price) : productPrice;
          return {
            name,
            options: v.combination,
            sku,
            price: price > 0 ? price : productPrice,
            comparePrice: parseFloat(form.comparePrice) > 0 ? parseFloat(form.comparePrice) : undefined,
            stock: Math.max(0, parseInt(v.stock, 10) || 0),
            image: v.image || undefined,
          };
        })
      : undefined;

    return {
      name: form.name.trim(),
      slug: form.slug || toSlug(form.name),
      description: form.description || undefined,
      shortDescription: form.shortDescription || undefined,
      price: parseFloat(form.price),
      comparePrice: parseFloat(form.comparePrice) > 0 ? parseFloat(form.comparePrice) : undefined,
      costPrice:    parseFloat(form.costPrice)    > 0 ? parseFloat(form.costPrice)    : undefined,
      sku: form.sku || undefined,
      barcode: form.barcode || undefined,
      stock: form.stock ? parseInt(form.stock, 10) : 0,
      lowStockThreshold: form.lowStockAlert ? parseInt(form.lowStockAlert, 10) : 5,
      trackInventory: form.trackInventory,
      allowBackorders: form.allowBackorders,
      thumbnail: form.featuredImage || undefined,
      images: form.gallery.map((g) => g.url),
      // Backend takes single categoryId — use first selected
      categoryId: form.categoryIds[0] || undefined,
      brandId: form.brandId || undefined,
      tags: form.tags,
      badges: form.badges,
      status: resolvedStatus,
      isFeatured: false,
      weight: form.weight ? parseFloat(form.weight) : undefined,
      seo: (form.metaTitle || form.metaDescription)
        ? { title: form.metaTitle, description: form.metaDescription }
        : undefined,
      publishAt: form.publishAt || undefined,
      taxCategory: form.taxCategory || undefined,
      hsCode: form.hsCode || undefined,
      priceIncludesTax: form.priceIncludesTax,
      variants: variantPayload,
    };
  };

  const handleSave = (statusOverride?: string) => {
    if (!validate()) { setTab('general'); toast.error('Please fill required fields'); return; }
    const payload = buildPayload(statusOverride);

    if (isEdit) {
      updateProduct.mutate(
        { id: product.id, data: payload },
        { onSuccess: onBack },
      );
    } else {
      createProduct.mutate(payload, { onSuccess: onBack });
    }
  };

  const saving = createProduct.isPending || updateProduct.isPending;

  const toggleMulti = (arr: string[], id: string) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  const selectedSet = MOCK_ATTRIBUTE_SETS.find((s) => s.id === form.attributeSetId);

  // SEO meta defaults
  const seoTitle = form.metaTitle || form.name;
  const seoDesc = form.metaDescription || form.shortDescription;
  const seoSlug = form.slug || toSlug(form.name);

  // Related product search results
  const relResults = MOCK_PRODUCTS.filter(
    (p) => p.name.toLowerCase().includes(relSearch.toLowerCase()) && relSearch.length > 0
  );

  // ─── Tab: General ──────────────────────────────────────────────────────────
  const renderGeneral = () => (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Left: Core Info */}
      <div className="xl:col-span-2 space-y-5">
        {/* Basic Info */}
        <Card className="p-5">
          <SectionHeader title="Basic Information" />
          <div className="space-y-4">
            <div>
              <Label required>Product Name</Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  set('name', e.target.value);
                  if (!form.slug) set('slug', toSlug(e.target.value));
                }}
                placeholder="e.g. Women's Cotton Saree"
                error={errors.name}
              />
            </div>
            <div>
              <Label>Slug</Label>
              <div className="flex gap-2">
                <Input
                  value={form.slug}
                  onChange={(e) => set('slug', e.target.value)}
                  placeholder="auto-generated-from-name"
                  className="flex-1"
                />
                <button onClick={() => set('slug', toSlug(form.name))}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-500 hover:text-indigo-600 hover:border-indigo-400 transition-colors whitespace-nowrap">
                  <RefreshCw size={13} />
                </button>
              </div>
              {form.slug && (
                <p className="text-xs text-slate-400 mt-1">
                  yourstore.com/products/<span className="text-indigo-500">{form.slug}</span>
                </p>
              )}
            </div>
            <div>
              <Label>Short Description</Label>
              <textarea value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)}
                rows={2} placeholder="Brief product summary (shown in listings and cards)…"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none" />
              <p className="text-xs text-slate-400 mt-1">{(form.shortDescription ?? '').length}/160</p>
            </div>
            <div>
              <Label>Full Description</Label>
              <RichTextEditor value={form.description} onChange={(v) => set('description', v)} />
            </div>
          </div>
        </Card>

        {/* Product Type */}
        <Card className="p-5">
          <SectionHeader title="Product Type" subtitle="Determines pricing model, inventory tracking, and shipping behavior" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { value: 'simple', label: 'Simple', icon: Package, desc: 'Single SKU, no options' },
              { value: 'variable', label: 'Variable', icon: Grid3X3, desc: 'Multiple sizes/colors' },
              { value: 'digital', label: 'Digital', icon: FileText, desc: 'File download' },
              { value: 'bundle', label: 'Bundle', icon: Layers, desc: 'Group of products' },
            ].map(({ value, label, icon: Icon, desc }) => (
              <button key={value} onClick={() => set('productType', value as any)}
                className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                  form.productType === value
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                }`}>
                <Icon size={20} className={`mb-2 ${form.productType === value ? 'text-indigo-600' : 'text-slate-400'}`} />
                <p className={`text-sm font-semibold ${form.productType === value ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>{label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                {form.productType === value && (
                  <div className="mt-2 w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center">
                    <Check size={10} className="text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </Card>

        {/* Badges */}
        <Card className="p-5">
          <SectionHeader title="Product Badges" subtitle="Highlighted labels shown on the product card and detail page" />
          <div className="flex flex-wrap gap-2">
            {BADGE_OPTIONS.map((b) => (
              <button key={b} onClick={() => set('badges', toggleMulti(form.badges, b))}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                  form.badges.includes(b)
                    ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-amber-300'
                }`}>
                {form.badges.includes(b) && <Check size={11} className="inline mr-1" />}
                {b}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Right: Organization */}
      <div className="space-y-5">
        {/* Category */}
        <Card className="p-4">
          <Label>Category</Label>
          <p className="text-xs text-slate-400 mb-2">Multi-select supported</p>
          <div className="max-h-48 overflow-y-auto space-y-1 border border-slate-200 dark:border-slate-700 rounded-lg p-2">
            {flatCats.length === 0 && (
              <p className="text-xs text-slate-400 italic px-1 py-2">No categories yet — create them in the Categories section</p>
            )}
            {flatCats.map((c) => (
              <label key={c.id} className="flex items-center gap-2 py-1 px-1.5 rounded cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40"
                style={{ paddingLeft: `${6 + (c.depth ?? 0) * 12}px` }}>
                <input type="checkbox" checked={form.categoryIds.includes(c.id)}
                  onChange={() => set('categoryIds', toggleMulti(form.categoryIds, c.id))}
                  className="w-3.5 h-3.5 accent-indigo-600 flex-shrink-0" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {(c.depth ?? 0) > 0 && <span className="text-slate-400 mr-1">{'└'.repeat(1)}</span>}
                  {c.name}
                </span>
              </label>
            ))}
          </div>
          {form.categoryIds.length > 0 && (
            <p className="text-xs text-indigo-600 mt-2">{form.categoryIds.length} selected</p>
          )}
        </Card>

        {/* Collections */}
        <Card className="p-4">
          <Label>Collections</Label>
          <div className="space-y-1.5">
            {collections.length === 0 && (
              <p className="text-xs text-slate-400 italic">No collections yet</p>
            )}
            {collections.map((c) => (
              <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.collectionIds.includes(c.id)}
                  onChange={() => set('collectionIds', toggleMulti(form.collectionIds, c.id))}
                  className="w-4 h-4 accent-indigo-600" />
                <span className="text-sm text-slate-700 dark:text-slate-300">{c.name}</span>
              </label>
            ))}
          </div>
        </Card>

        {/* Brand */}
        <Card className="p-4">
          <Label>Brand</Label>
          <Select value={form.brandId} onChange={(e) => set('brandId', e.target.value)}>
            <option value="">Select brand…</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Card>

        {/* Tags */}
        <Card className="p-4">
          <Label>Tags</Label>
          <TagInput tags={form.tags} onChange={(t) => set('tags', t)} placeholder="Cotton, Wedding, Handloom… ↵" />
          <p className="text-xs text-slate-400 mt-1.5">Press Enter or comma to add</p>
        </Card>
      </div>
    </div>
  );

  // ─── Tab: Media ────────────────────────────────────────────────────────────
  const renderMedia = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Featured Image */}
        <Card className="p-5 lg:col-span-1">
          <SectionHeader title="Featured Image" subtitle="Main product image (1:1 ratio recommended)" />
          <ImageDropZone label="Click to upload" hint="JPG, PNG, WebP — max 5MB" value={form.featuredImage} onChange={(v) => set('featuredImage', v)} large />
          {form.featuredImage && (
            <div className="mt-3">
              <Label>Alt Text</Label>
              <Input placeholder="Describe the image for SEO and accessibility" />
            </div>
          )}
        </Card>

        {/* Gallery */}
        <Card className="p-5 lg:col-span-2">
          <SectionHeader title="Product Gallery" subtitle="Additional images — drag to reorder" />
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {form.gallery.map((img, i) => (
              <div key={i} className="relative aspect-square">
                <img src={img.url} alt={img.alt} className="w-full h-full object-cover rounded-xl" />
                <button onClick={() => set('gallery', form.gallery.filter((_, idx) => idx !== i))}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow">
                  <X size={10} />
                </button>
                <div className="absolute bottom-1 left-1 cursor-grab bg-black/40 rounded p-0.5 opacity-0 hover:opacity-100">
                  <Move size={12} className="text-white" />
                </div>
              </div>
            ))}
            <button
              onClick={() => {
                const url = `https://picsum.photos/seed/${Math.random().toString(36).slice(2)}/600/600`;
                set('gallery', [...form.gallery, { url, alt: '' }]);
                toast.success('Image added to gallery');
              }}
              className="aspect-square border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl flex flex-col items-center justify-center hover:border-indigo-400 transition-colors cursor-pointer">
              <Plus size={20} className="text-slate-400" />
              <p className="text-xs text-slate-400 mt-1">Add</p>
            </button>
          </div>
          {form.gallery.length > 1 && (
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1"><Move size={11} /> Drag images to reorder</p>
          )}
        </Card>
      </div>

      {/* Video & 360 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="p-5 md:col-span-2">
          <SectionHeader title="Product Video" subtitle="YouTube or Vimeo URL" />
          <div className="flex gap-3 items-start">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Video size={18} className="text-red-500" />
            </div>
            <div className="flex-1">
              <Input value={form.videoUrl} onChange={(e) => set('videoUrl', e.target.value)}
                placeholder="https://youtube.com/watch?v=..." />
              <p className="text-xs text-slate-400 mt-1">Supports YouTube, Vimeo, and direct video URLs</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <SectionHeader title="Advanced Media" />
          <div className="space-y-3">
            {[{ label: '360° View', hint: 'Spin product images', icon: RotateCcw },
              { label: '3D Model', hint: 'Upload .glb / .usdz', icon: Globe }].map(({ label, hint, icon: Icon }) => (
              <div key={label} className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div className="flex items-center gap-2">
                  <Icon size={15} className="text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
                    <p className="text-xs text-slate-400">{hint}</p>
                  </div>
                </div>
                <Btn variant="outline" onClick={() => toast.info(`${label} upload coming soon`)}>Upload</Btn>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );

  // ─── Tab: Pricing ──────────────────────────────────────────────────────────
  const renderPricing = () => (
    <div className="max-w-2xl space-y-5">
      <Card className="p-5">
        <SectionHeader title="Pricing" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label required>Selling Price</Label>
            <Input type="number" prefix="₹" value={form.price} onChange={(e) => set('price', e.target.value)}
              placeholder="0.00" error={errors.price} />
          </div>
          <div>
            <Label>Compare-at Price</Label>
            <Input type="number" prefix="₹" value={form.comparePrice} onChange={(e) => set('comparePrice', e.target.value)}
              placeholder="0.00" />
            <p className="text-xs text-slate-400 mt-1">Shows as crossed-out "was" price</p>
          </div>
          <div>
            <Label>Cost Price</Label>
            <Input type="number" prefix="₹" value={form.costPrice} onChange={(e) => set('costPrice', e.target.value)}
              placeholder="0.00" />
            <p className="text-xs text-slate-400 mt-1">Not shown to customers</p>
          </div>
        </div>
      </Card>

      {/* Auto-calculated */}
      {/* Only meaningful when cost price is entered — otherwise margin shows 100% which is misleading */}
      {price > 0 && costPrice > 0 && (
        <Card className="p-5">
          <SectionHeader title="Calculated Metrics" subtitle="Auto-updated based on prices above" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Profit', value: profit > 0 ? `₹${profit.toFixed(2)}` : '—', color: profit > 0 ? 'text-emerald-600' : 'text-red-500', icon: TrendingUp },
              { label: 'Margin', value: `${margin}%`, color: parseFloat(margin) > 30 ? 'text-emerald-600' : 'text-amber-600', icon: BarChart3 },
              { label: 'Markup', value: `${markup}%`, color: 'text-indigo-600', icon: BarChart3 },
              { label: 'Discount', value: discount > 0 ? `${discount}% off` : '—', color: discount > 0 ? 'text-violet-600' : 'text-slate-400', icon: Tag },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={13} className="text-slate-400" />
                  <p className="text-xs text-slate-500 font-medium">{label}</p>
                </div>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          {parseFloat(margin) < 20 && price > 0 && costPrice > 0 && (
            <div className="mt-3 flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
              <AlertTriangle size={14} /> Low margin warning — consider reviewing your pricing
            </div>
          )}
        </Card>
      )}

      {/* Tax */}
      <Card className="p-5">
        <SectionHeader title="Tax" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Tax Category</Label>
            <Select value={form.taxCategory} onChange={(e) => set('taxCategory', e.target.value)}>
              <option value="GST 5%">GST 5%</option>
              <option value="GST 12%">GST 12%</option>
              <option value="GST 18%">GST 18%</option>
              <option value="GST 28%">GST 28%</option>
              <option value="Tax Exempt">Tax Exempt</option>
            </Select>
          </div>
          <div>
            <Label>HSN Code</Label>
            <Input
              placeholder="e.g. 5208"
              value={form.hsCode}
              onChange={(e) => set('hsCode', e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">Harmonized System / tariff code</p>
          </div>
        </div>
        <label className="flex items-center gap-2 mt-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.priceIncludesTax}
            onChange={(e) => set('priceIncludesTax', e.target.checked)}
            className="w-4 h-4 accent-indigo-600"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">Price includes tax (MRP)</span>
        </label>
      </Card>
    </div>
  );

  // ─── Tab: Inventory ────────────────────────────────────────────────────────
  const renderInventory = () => (
    <div className="max-w-2xl space-y-5">
      <Card className="p-5">
        <SectionHeader title="Product Identifiers" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>SKU</Label>
            <Input value={form.sku} onChange={(e) => set('sku', e.target.value)}
              placeholder="e.g. SUTA-SAR-001" suffix="Auto" />
          </div>
          <div>
            <Label>Barcode</Label>
            <Input value={form.barcode} onChange={(e) => set('barcode', e.target.value)}
              placeholder="ISBN, UPC, GTIN…" />
          </div>
        </div>
        <button onClick={() => set('sku', `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`)}
          className="mt-2 text-xs text-indigo-600 hover:underline flex items-center gap-1">
          <RefreshCw size={11} /> Auto-generate SKU
        </button>
      </Card>

      <Card className="p-5">
        <SectionHeader title="Stock" />
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Label>Current Stock</Label>
            <Input type="number" value={form.stock} onChange={(e) => set('stock', e.target.value)}
              placeholder="0" suffix="units" />
          </div>
          <div>
            <Label>Low Stock Alert</Label>
            <Input type="number" value={form.lowStockAlert} onChange={(e) => set('lowStockAlert', e.target.value)}
              placeholder="5" suffix="units" />
            <p className="text-xs text-slate-400 mt-1">Alert when stock falls below this</p>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
          <Toggle checked={form.trackInventory} onChange={(v) => set('trackInventory', v)}
            label="Track Inventory" hint="Monitor stock levels and trigger alerts" />
          <Toggle checked={form.allowBackorders} onChange={(v) => set('allowBackorders', v)}
            label="Allow Backorders" hint="Accept orders even when out of stock" />
          <Toggle checked={form.continueSelling} onChange={(v) => set('continueSelling', v)}
            label="Continue Selling When Out of Stock"
            hint="Product stays visible and orderable when stock = 0" />
        </div>
      </Card>

      <Card className="p-5">
        <SectionHeader title="Warehouse Locations" subtitle="Where this product is stored" />
        <div className="space-y-2">
          {['Main Warehouse – Mumbai', 'Fulfillment Center – Delhi', 'Vendor Warehouse'].map((loc) => (
            <label key={loc} className="flex items-center justify-between gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40">
              <div className="flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4 accent-indigo-600" />
                <span className="text-sm text-slate-700 dark:text-slate-300">{loc}</span>
              </div>
              <input type="number" placeholder="Qty" className="w-20 px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200" />
            </label>
          ))}
        </div>
      </Card>
    </div>
  );

  // ─── Tab: Variants ─────────────────────────────────────────────────────────
  const renderVariants = () => {
    const axes = variants.length > 0 ? Object.keys(variants[0].combination) : [];
    const allSelected = selectedIds.length === variants.length && variants.length > 0;

    return (
    <div className="space-y-5">


      {/* ── Out-of-sync warning ── */}
      {isOutOfSync && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-sm font-medium">
            <AlertTriangle size={15} className="flex-shrink-0" />
            Options changed. Variant list must be updated.
          </div>
          <Btn onClick={() => { setErrors((e) => { const n = { ...e }; delete n.variants; return n; }); smartUpdateVariants(); }}>
            <Grid3X3 size={13} /> Update Variants
          </Btn>
        </div>
      )}

      {/* ── Options panel ── */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader title="Variant Options" subtitle="Define axes — Color, Size, Material…" />
          <Toggle checked={form.hasVariants} onChange={(v) => set('hasVariants', v)} label="" />
        </div>

        {!form.hasVariants ? (
          <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-sm text-slate-500">
            <Info size={16} className="text-slate-400 flex-shrink-0" />
            Enable variants to manage multiple sizes, colors, or other options for this product.
          </div>
        ) : (
          <>
            {errors.variants && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
                <AlertTriangle size={14} className="flex-shrink-0" /> {errors.variants}
              </div>
            )}

            {/* Option rows — tag chip input for values */}
            <div className="space-y-3">
              {variantOptions.map((opt) => (
                <div key={opt.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1">
                      <Label>Option Name</Label>
                      <Input value={opt.name}
                        onChange={(e) => setVariantOptions((v) => v.map((x) => x.id === opt.id ? { ...x, name: e.target.value } : x))}
                        placeholder="e.g. Color" />
                    </div>
                    <button onClick={() => setVariantOptions((v) => v.filter((x) => x.id !== opt.id))}
                      className="mt-5 p-2 text-slate-400 hover:text-red-500 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                  <div>
                    <Label>Values</Label>
                    <OptionValueTags
                      values={opt.values}
                      optionName={opt.name || undefined}
                      onChange={(v) => setVariantOptions((prev) => prev.map((x) => x.id === opt.id ? { ...x, values: v } : x))}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Preview of what will be generated */}
            {previewData.combos.length > 0 && (
              <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                {/* Preview header */}
                <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Will add {previewData.combos.length} variant{previewData.combos.length > 1 ? 's' : ''} from options
                    {previewData.newOnes.length > 0 && <span className="text-emerald-600 ml-1.5">(+{previewData.newOnes.length} new)</span>}
                    {previewData.outsideOptions.length > 0 && (
                      <span className="text-amber-600 ml-1.5" title="These variants exist but are not in current options — they will be KEPT">
                        · {previewData.outsideOptions.length} kept outside options
                      </span>
                    )}
                  </p>
                  <button
                    onClick={() => { setErrors((e) => { const n = { ...e }; delete n.variants; return n; }); smartUpdateVariants(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                  >
                    <Grid3X3 size={12} /> Update Variants
                  </button>
                </div>
                {/* Variant chips */}
                <div className="flex flex-wrap gap-1.5 p-3">
                  {previewData.combos.map((c) => {
                    const key   = comboKey(c);
                    const isNew = !previewData.kept.some((v) => comboKey(v.combination) === key);
                    return (
                      <span key={key} className={`text-xs px-2 py-1 rounded-full font-medium ${
                        isNew
                          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-400/60'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        {Object.values(c).join(' / ')}
                        {isNew && <span className="ml-1 opacity-60 text-[10px]">new</span>}
                      </span>
                    );
                  })}
                  {/* Outside-options variants — KEPT but shown with amber warning */}
                  {previewData.outsideOptions.map((v) => (
                    <span key={v.id} title="This variant exists but is outside current options. It will be KEPT — delete with ✕ in the table if you don't need it."
                      className="text-xs px-2 py-1 rounded-full font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 ring-1 ring-amber-300 dark:ring-amber-700 cursor-help">
                      {Object.values(v.combination).join(' / ')}
                      <span className="ml-1 opacity-70 text-[10px]">kept</span>
                    </span>
                  ))}
                </div>
                {/* Legend */}
                <div className="flex items-center gap-4 px-3 pb-3 pt-1">
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                    New variant
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 inline-block" />
                    Existing (unchanged)
                  </span>
                  {previewData.outsideOptions.length > 0 && (
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                      Outside options (kept — delete ✕ to remove)
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-4">
              <button onClick={() => setVariantOptions((v) => [...v, { id: `v${Date.now()}`, name: '', values: '' }])}
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:underline">
                <Plus size={14} /> Add Option
              </button>
              {/* Only show this button when preview is NOT visible — prevents two buttons doing the same thing */}
              {previewData.combos.length === 0 && (
                <Btn onClick={() => { setErrors((e) => { const n = { ...e }; delete n.variants; return n; }); smartUpdateVariants(); }}>
                  <Grid3X3 size={14} />
                  {variants.length > 0 ? 'Update Variants' : 'Generate Variants'}
                </Btn>
              )}
            </div>
          </>
        )}
      </Card>

      {/* ── Variant matrix ── */}
      {variants.length > 0 && (
        <Card className="p-5">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <p className="font-bold text-slate-900 dark:text-white text-sm">{variants.length} Variants</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {axes.map((axis) => (
                  <span key={axis} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-full">
                    {axis}: {[...new Set(variants.map(v => v.combination[axis]))].join(' · ')}
                  </span>
                ))}
              </div>
            </div>
            {selectedIds.length > 0 && (
              <Btn onClick={() => setShowBulkBar(b => !b)}>
                <Settings2 size={13} /> Bulk Edit ({selectedIds.length})
              </Btn>
            )}
          </div>

          {/* Bulk Edit bar */}
          {showBulkBar && selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl">
              <select value={bulkField} onChange={(e) => setBulkField(e.target.value)}
                className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                <option value="price">Price (₹)</option>
                <option value="stock">Stock</option>
                <option value="weight">Weight</option>
              </select>
              <select value={bulkMode} onChange={(e) => setBulkMode(e.target.value as any)}
                className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                <option value="set">Set to</option>
                <option value="increase">Increase by</option>
              </select>
              <input type="number" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}
                placeholder="Value"
                className="w-24 px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200" />
              <Btn onClick={applyBulkEdit}>Apply to {selectedIds.length}</Btn>
              <button onClick={() => { setShowBulkBar(false); setSelectedIds([]); }}
                className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th className="py-2 pl-3 pr-1 w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 accent-indigo-600" />
                  </th>
                  {axes.map((axis) => (
                    <th key={axis} className="text-left py-2 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">{axis}</th>
                  ))}
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Price (₹)</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Stock</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Weight</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Image</th>
                  <th className="py-2 px-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {variants.map((v) => {
                  const isSelected = selectedIds.includes(v.id);
                  return (
                    <tr key={v.id}
                      className={`group transition-colors ${isSelected ? 'bg-indigo-50/60 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}>
                      <td className="py-2 pl-3 pr-1">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(v.id)}
                          className="w-3.5 h-3.5 accent-indigo-600" />
                      </td>
                      {/* Combination cells — READ ONLY display chips */}
                      {Object.entries(v.combination).map(([axis, val], ci) => (
                        <td key={axis} className="py-2 px-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            ci % 2 === 0
                              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                              : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                          }`}>{val || '—'}</span>
                        </td>
                      ))}
                      {/* Editable fields */}
                      <td className="py-2 px-3">
                        <input type="number" value={v.price} onChange={(e) => updateVariant(v.id, 'price', e.target.value)}
                          className="w-24 px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200" />
                      </td>
                      <td className="py-2 px-3">
                        <input value={v.sku} onChange={(e) => updateVariant(v.id, 'sku', e.target.value)}
                          className="w-32 px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono" />
                      </td>
                      <td className="py-2 px-3">
                        <input type="number" value={v.stock} onChange={(e) => updateVariant(v.id, 'stock', e.target.value)}
                          className="w-16 px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200" />
                      </td>
                      <td className="py-2 px-3">
                        <input value={v.weight} onChange={(e) => updateVariant(v.id, 'weight', e.target.value)}
                          placeholder="kg" className="w-16 px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200" />
                      </td>
                      <td className="py-2 px-3">
                        <button onClick={() => updateVariant(v.id, 'image', `https://picsum.photos/seed/${v.id}/80/80`)}
                          className="w-8 h-8 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-400 flex items-center justify-center overflow-hidden">
                          {v.image ? <img src={v.image} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={12} className="text-slate-400" />}
                        </button>
                      </td>
                      <td className="py-2 px-2">
                        <button onClick={() => setVariants(prev => prev.filter(x => x.id !== v.id))}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-400 hover:text-red-600 flex items-center justify-center"
                          title="Remove this variant">
                          <X size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-400 mt-3">
            Color / Size values come from Options above — change them there and click <strong>Update Variants</strong>
          </p>
        </Card>
      )}
    </div>
  );};

  // ─── Tab: Attributes ───────────────────────────────────────────────────────
  const renderAttributes = () => (
    <div className="max-w-2xl space-y-5">
      <Card className="p-5">
        <SectionHeader title="Attribute Set" subtitle="Choose a preset that matches your product category" />
        <div className="grid grid-cols-2 gap-3 mb-4">
          {MOCK_ATTRIBUTE_SETS.map((s) => (
            <button key={s.id} onClick={() => { set('attributeSetId', s.id); set('attributeValues', {}); }}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                form.attributeSetId === s.id
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'
              }`}>
              <p className={`font-semibold text-sm ${form.attributeSetId === s.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>{s.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.attributes.length} attributes</p>
            </button>
          ))}
        </div>
      </Card>

      {selectedSet && (
        <Card className="p-5">
          <SectionHeader title={`${selectedSet.name} Attributes`} subtitle="Fill in all applicable fields" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {selectedSet.attributes.map((attr) => (
              <div key={attr.id}>
                <Label>{attr.name}</Label>
                {attr.type === 'dropdown' ? (
                  <Select value={form.attributeValues[attr.name] ?? ''}
                    onChange={(e) => set('attributeValues', { ...form.attributeValues, [attr.name]: e.target.value })}>
                    <option value="">Select {attr.name}…</option>
                    {attr.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </Select>
                ) : (
                  <Input value={form.attributeValues[attr.name] ?? ''}
                    onChange={(e) => set('attributeValues', { ...form.attributeValues, [attr.name]: e.target.value })}
                    placeholder={`Enter ${attr.name.toLowerCase()}…`} />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {!form.attributeSetId && (
        <div className="flex items-center gap-3 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-sm text-slate-500 border border-slate-200 dark:border-slate-700">
          <Zap size={18} className="text-slate-400 flex-shrink-0" />
          Select an attribute set above to see relevant fields for your product type.
        </div>
      )}
    </div>
  );

  // ─── Tab: Shipping ─────────────────────────────────────────────────────────
  const renderShipping = () => (
    <div className="max-w-2xl space-y-5">
      <Card className="p-5">
        <Toggle checked={form.isPhysical} onChange={(v) => set('isPhysical', v)}
          label="Physical Product"
          hint="Disable for digital products, services, or subscriptions" />
      </Card>

      {form.isPhysical && (
        <>
          <Card className="p-5">
            <SectionHeader title="Weight" />
            <div className="flex gap-3">
              <div className="flex-1">
                <Label>Weight</Label>
                <Input type="number" value={form.weight} onChange={(e) => set('weight', e.target.value)} placeholder="0.500" />
              </div>
              <div className="w-28">
                <Label>Unit</Label>
                <Select value={form.weightUnit} onChange={(e) => set('weightUnit', e.target.value as any)}>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="lb">lb</option>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionHeader title="Dimensions" />
              <Select value={form.dimensionUnit} onChange={(e) => set('dimensionUnit', e.target.value as any)} className="!w-24">
                <option value="cm">cm</option>
                <option value="in">inches</option>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: 'length', label: 'Length' },
                { key: 'width', label: 'Width' },
                { key: 'height', label: 'Height' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input type="number" value={(form as any)[key]}
                    onChange={(e) => set(key as any, e.target.value)}
                    placeholder="0" suffix={form.dimensionUnit} />
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <Card className="p-5">
        <SectionHeader title="Customs & International" subtitle="Required for international shipping" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>HS Code</Label>
            <Input value={form.hsCode} onChange={(e) => set('hsCode', e.target.value)} placeholder="e.g. 6204.69.9000" />
            <p className="text-xs text-slate-400 mt-1">Harmonized System code</p>
          </div>
          <div>
            <Label>Country of Origin</Label>
            <Select value={form.countryOfOrigin} onChange={(e) => set('countryOfOrigin', e.target.value)}>
              <option value="IN">India</option>
              <option value="CN">China</option>
              <option value="US">United States</option>
              <option value="BD">Bangladesh</option>
              <option value="VN">Vietnam</option>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <SectionHeader title="Shipping Profiles" subtitle="Override default shipping rules for this product" />
        <Select>
          <option value="">Use default store shipping</option>
          <option value="free">Free shipping</option>
          <option value="heavy">Heavy item — extra charge</option>
          <option value="fragile">Fragile — special handling</option>
        </Select>
      </Card>
    </div>
  );

  // ─── Tab: SEO ──────────────────────────────────────────────────────────────
  const renderSEO = () => (
    <div className="max-w-2xl space-y-5">
      <Card className="p-5">
        <SectionHeader title="Search Engine Optimization" />
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label>Meta Title</Label>
              <span className={`text-xs ${seoTitle.length > 60 ? 'text-red-500' : 'text-slate-400'}`}>{seoTitle.length}/70</span>
            </div>
            <Input value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)}
              placeholder={form.name || 'Product title for search engines'} />
            {seoTitle.length > 60 && <p className="text-xs text-amber-500 mt-1">Title is getting long — search engines may truncate it</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label>Meta Description</Label>
              <span className={`text-xs ${seoDesc.length > 155 ? 'text-red-500' : 'text-slate-400'}`}>{seoDesc.length}/160</span>
            </div>
            <textarea value={form.metaDescription} onChange={(e) => set('metaDescription', e.target.value)}
              rows={3} placeholder={form.shortDescription || 'Describe your product for search results…'}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none" />
          </div>

          <div>
            <Label>Canonical URL</Label>
            <Input value={form.canonicalUrl} onChange={(e) => set('canonicalUrl', e.target.value)}
              placeholder={`https://yourstore.com/products/${seoSlug}`} prefix="🔗" />
            <p className="text-xs text-slate-400 mt-1">Leave blank to use the default product URL</p>
          </div>
        </div>
      </Card>

      {/* Google Preview */}
      <Card className="p-5">
        <SectionHeader title="Search Engine Preview" subtitle="How this product may appear in Google" />
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <p className="text-xs text-slate-400 mb-3 font-medium">GOOGLE PREVIEW</p>
          <p className="text-blue-700 dark:text-blue-400 text-base font-medium leading-tight hover:underline cursor-pointer line-clamp-1">
            {seoTitle || 'Product Name | YourStore'}
          </p>
          <p className="text-emerald-700 dark:text-emerald-500 text-xs mt-0.5">
            yourstore.com › products › {seoSlug || 'product-slug'}
          </p>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1.5 line-clamp-2 leading-relaxed">
            {seoDesc || 'Your product description will appear here. Write a compelling meta description to improve click-through rates from search results.'}
          </p>
        </div>

        <div className="mt-4 flex items-center gap-4">
          {[
            { label: 'Title length', good: seoTitle.length <= 60 && seoTitle.length > 0, neutral: seoTitle.length === 0 },
            { label: 'Description length', good: seoDesc.length <= 155 && seoDesc.length > 50, neutral: seoDesc.length === 0 },
            { label: 'Slug', good: !!seoSlug, neutral: !seoSlug },
          ].map(({ label, good, neutral }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs">
              <div className={`w-2 h-2 rounded-full ${neutral ? 'bg-slate-300' : good ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <SectionHeader title="Structured Data" subtitle="Rich snippets for search results" />
        <div className="space-y-2">
          {['Product price & availability', 'Breadcrumb navigation', 'Product rating/reviews', 'Organization schema'].map((s) => (
            <label key={s} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4 accent-indigo-600" />
              <span className="text-sm text-slate-700 dark:text-slate-300">{s}</span>
            </label>
          ))}
        </div>
      </Card>
    </div>
  );

  // ─── Tab: Related Products ─────────────────────────────────────────────────
  const renderRelated = () => {
    const RelatedSection: React.FC<{ title: string; subtitle: string; field: 'relatedProductIds' | 'crossSellIds' | 'upsellIds'; color: string }> = ({
      title, subtitle, field, color,
    }) => {
      const [search, setSearch] = useState('');
      const results = MOCK_PRODUCTS.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) && search.length > 0);
      const selected = (form[field] as string[]);

      return (
        <Card className="p-5">
          <SectionHeader title={title} subtitle={subtitle} />
          {/* Search */}
          <div className="relative mb-3">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          </div>
          {results.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-3">
              {results.map((p) => (
                <button key={p.id} onClick={() => { if (!selected.includes(p.id)) set(field, [...selected, p.id]); setSearch(''); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 text-left border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{p.name}</span>
                  <span className="text-xs text-slate-400">₹{p.price.toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
          {/* Selected */}
          <div className="space-y-2">
            {selected.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No products selected yet</p>
            ) : selected.map((id) => {
              const p = MOCK_PRODUCTS.find((x) => x.id === id);
              if (!p) return null;
              return (
                <div key={id} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${color}`}>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">₹{p.price.toLocaleString()}</span>
                    <button onClick={() => set(field, selected.filter((x) => x !== id))}><X size={13} className="text-slate-400 hover:text-red-500" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      );
    };

    return (
      <div className="max-w-2xl space-y-5">
        <RelatedSection title="Related Products" subtitle="Similar products customers might also like"
          field="relatedProductIds" color="border-slate-200 dark:border-slate-700" />
        <RelatedSection title="Cross-sell" subtitle="Complementary items shown in cart (e.g. Matching Blouse with Saree)"
          field="crossSellIds" color="border-blue-200 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-900/10" />
        <RelatedSection title="Upsell" subtitle="Premium alternatives shown on the product page"
          field="upsellIds" color="border-violet-200 dark:border-violet-900/40 bg-violet-50/30 dark:bg-violet-900/10" />
      </div>
    );
  };

  // ─── Tab: Publishing ───────────────────────────────────────────────────────
  const renderPublishing = () => (
    <div className="max-w-2xl space-y-5">
      {/* Status */}
      <Card className="p-5">
        <SectionHeader title="Product Status" />
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'draft', label: 'Draft', desc: 'Not visible', color: 'amber' },
            { value: 'active', label: 'Active', desc: 'Live & visible', color: 'emerald' },
            { value: 'archived', label: 'Archived', desc: 'Hidden, kept', color: 'slate' },
          ].map(({ value, label, desc, color }) => (
            <button key={value} onClick={() => set('status', value as any)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                form.status === value ? `border-${color}-500 bg-${color}-50 dark:bg-${color}-900/20` : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}>
              <div className={`w-2.5 h-2.5 rounded-full mb-2 ${
                value === 'active' ? 'bg-emerald-500' : value === 'draft' ? 'bg-amber-500' : 'bg-slate-400'
              }`} />
              <p className={`text-sm font-semibold ${form.status === value ? `text-${color}-700 dark:text-${color}-300` : 'text-slate-700 dark:text-slate-300'}`}>{label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Visibility */}
      <Card className="p-5">
        <SectionHeader title="Visibility" subtitle="Who can see this product" />
        <div className="space-y-2">
          {[
            { value: 'published', label: 'Published', desc: 'Visible to everyone', icon: Globe },
            { value: 'hidden', label: 'Hidden', desc: 'Only accessible via direct link', icon: Link2 },
            { value: 'members_only', label: 'Members Only', desc: 'Logged-in customers only', icon: Shield },
            { value: 'wholesale_only', label: 'Wholesale Only', desc: 'Wholesale/B2B customers', icon: CreditCard },
          ].map(({ value, label, desc, icon: Icon }) => (
            <button key={value} onClick={() => set('visibility', value as any)}
              className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                form.visibility === value ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-200'
              }`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${form.visibility === value ? 'bg-indigo-100 dark:bg-indigo-900/40' : 'bg-slate-100 dark:bg-slate-800'}`}>
                <Icon size={16} className={form.visibility === value ? 'text-indigo-600' : 'text-slate-400'} />
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${form.visibility === value ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>{label}</p>
                <p className="text-xs text-slate-400">{desc}</p>
              </div>
              {form.visibility === value && <Check size={16} className="text-indigo-600 flex-shrink-0" />}
            </button>
          ))}
        </div>
      </Card>

      {/* Schedule */}
      <Card className="p-5">
        <SectionHeader title="Schedule" subtitle="Control when this product becomes visible or expires" />
        <div className="space-y-4">
          <div>
            <Label>Publish Date & Time</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="date" value={form.publishAt.split('T')[0] ?? ''}
                  onChange={(e) => set('publishAt', e.target.value + 'T00:00')}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div className="relative">
                <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="time"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1">Leave blank to publish immediately when status is set to Active</p>
          </div>
          <div>
            <Label>Expiry / Campaign End Date</Label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="date" value={form.expiresAt}
                onChange={(e) => set('expiresAt', e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
          </div>
        </div>
      </Card>

      {/* Reviews */}
      <Card className="p-5">
        <SectionHeader title="Reviews & Ratings" />
        <div className="space-y-3">
          <Toggle checked={form.allowReviews} onChange={(v) => set('allowReviews', v)}
            label="Allow Customer Reviews" hint="Customers can submit ratings and text reviews" />
          <Toggle checked={form.moderateReviews} onChange={(v) => set('moderateReviews', v)}
            label="Moderate Reviews Before Publishing"
            hint="Reviews go to a queue for admin approval before appearing" />
        </div>
      </Card>

      {/* Vendor */}
      <Card className="p-5">
        <SectionHeader title="Vendor / Marketplace" subtitle="Assign this product to a marketplace seller" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Vendor</Label>
            <Select value={form.vendorId} onChange={(e) => set('vendorId', e.target.value)}>
              <option value="">No vendor (own inventory)</option>
              {MOCK_VENDORS.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Commission %</Label>
            <Input type="number" value={form.vendorCommission} onChange={(e) => set('vendorCommission', e.target.value)}
              suffix="%" placeholder="15" disabled={!form.vendorId} />
          </div>
        </div>
        {form.vendorId && (
          <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-400">
            Vendor earns {100 - parseFloat(form.vendorCommission || '0')}% of each sale. Platform fee: {form.vendorCommission || '0'}%
          </div>
        )}
      </Card>
    </div>
  );

  // ─── Tab Content Map ───────────────────────────────────────────────────────
  const renderTab = () => {
    switch (tab) {
      case 'general': return renderGeneral();
      case 'media': return renderMedia();
      case 'pricing': return renderPricing();
      case 'inventory': return renderInventory();
      case 'variants': return renderVariants();
      case 'attributes': return renderAttributes();
      case 'shipping': return renderShipping();
      case 'seo': return renderSEO();
      case 'related': return renderRelated();
      case 'publishing': return renderPublishing();
      default: return renderGeneral();
    }
  };

  // ─── Completion score ─────────────────────────────────────────────────────
  const completedTabs = new Set<string>();
  if (form.name && form.productType) completedTabs.add('general');
  if (form.featuredImage) completedTabs.add('media');
  if (form.price) completedTabs.add('pricing');
  if (form.sku || form.stock) completedTabs.add('inventory');
  if (!form.hasVariants || variants.length > 0) completedTabs.add('variants');
  if (form.attributeSetId) completedTabs.add('attributes');
  if (!form.isPhysical || form.weight) completedTabs.add('shipping');
  if (form.metaTitle || form.metaDescription) completedTabs.add('seo');
  if ((form.relatedProductIds?.length ?? 0) > 0) completedTabs.add('related');
  if (form.status) completedTabs.add('publishing');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3 px-4 lg:px-6 py-3">
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors flex-shrink-0">
            <ArrowLeft size={16} /> Products
          </button>
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
          <h1 className="font-semibold text-slate-900 dark:text-white truncate flex-1">
            {form.name || <span className="text-slate-400 font-normal">New Product</span>}
          </h1>
          <div className="flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
            <span className="font-medium text-slate-600 dark:text-slate-400">{completedTabs.size}/{TABS.length}</span>
            <span>sections complete</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Btn variant="outline" onClick={() => toast.info('Preview opens in new tab')}>
              <Eye size={14} /> Preview
            </Btn>
            <Btn variant="outline" onClick={() => handleSave('draft')} disabled={saving}>
              <Save size={14} /> {saving ? 'Saving…' : 'Save Draft'}
            </Btn>
            <Btn onClick={() => handleSave('active')} disabled={saving}>
              {saving ? <RefreshCw size={14} className="animate-spin" /> : null}
              {isEdit ? 'Save Changes' : 'Publish'}
            </Btn>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex overflow-x-auto scrollbar-none border-t border-slate-100 dark:border-slate-800">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors relative flex-shrink-0 ${
                tab === t.id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}>
              <t.icon size={13} />
              {t.label}
              {completedTabs.has(t.id) && tab !== t.id && (
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute top-2 right-2" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Required field error banner */}
      {Object.keys(errors).length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-6 py-2.5 flex items-center gap-2 text-red-700 dark:text-red-300 text-sm">
          <AlertTriangle size={14} />
          {Object.values(errors).join(' • ')}
        </div>
      )}

      {/* Tab Content */}
      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6">
        {renderTab()}
      </div>
    </div>
  );
};

export default CreateProduct;
