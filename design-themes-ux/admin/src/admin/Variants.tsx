import React, { useState } from 'react';
import {
  Plus, Search, Edit, Trash2, Layers, Package,
  Image as ImageIcon, Eye, EyeOff, Grid3X3, List,
  Zap, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, PageHeader, Btn, Badge } from './ui';
import { useProducts } from '@/hooks/useProducts';

// ─── Mock variants for selected product ──────────────────────────────────────
const MOCK_PRODUCTS = [
  { id: 'p1', name: 'Classic Cotton Saree', sku: 'SKU-001', thumbnail: null, status: 'ACTIVE' },
  { id: 'p2', name: 'Silk Evening Gown', sku: 'SKU-002', thumbnail: null, status: 'ACTIVE' },
  { id: 'p3', name: 'Casual Kurti Set', sku: 'SKU-003', thumbnail: null, status: 'DRAFT' },
];

const MOCK_VARIANTS: Record<string, any[]> = {
  p1: [
    { id: 'v1', name: 'Red / S', sku: 'SKU-001-RED-S', price: 1200, comparePrice: 1500, stock: 24, image: null, options: { Color: 'Red', Size: 'S' }, isAvailable: true },
    { id: 'v2', name: 'Red / M', sku: 'SKU-001-RED-M', price: 1200, comparePrice: 1500, stock: 18, image: null, options: { Color: 'Red', Size: 'M' }, isAvailable: true },
    { id: 'v3', name: 'Red / L', sku: 'SKU-001-RED-L', price: 1200, comparePrice: 1500, stock: 0, image: null, options: { Color: 'Red', Size: 'L' }, isAvailable: false },
    { id: 'v4', name: 'Blue / S', sku: 'SKU-001-BLU-S', price: 1300, comparePrice: 1600, stock: 12, image: null, options: { Color: 'Blue', Size: 'S' }, isAvailable: true },
    { id: 'v5', name: 'Blue / M', sku: 'SKU-001-BLU-M', price: 1300, comparePrice: 1600, stock: 8, image: null, options: { Color: 'Blue', Size: 'M' }, isAvailable: true },
    { id: 'v6', name: 'Blue / L', sku: 'SKU-001-BLU-L', price: 1300, comparePrice: 1600, stock: 0, image: null, options: { Color: 'Blue', Size: 'L' }, isAvailable: false },
  ],
};

// ─── Variant Generator ────────────────────────────────────────────────────────
const VariantGenerator: React.FC<{ productId: string; onGenerate: (variants: any[]) => void; onClose: () => void }> = ({
  productId, onGenerate, onClose,
}) => {
  const [axes, setAxes] = useState([
    { label: 'Color', values: 'Red, Blue, Black' },
    { label: 'Size', values: 'S, M, L, XL' },
  ]);

  const addAxis = () => setAxes([...axes, { label: '', values: '' }]);
  const removeAxis = (i: number) => setAxes(axes.filter((_, idx) => idx !== i));
  const updateAxis = (i: number, k: string, v: string) => {
    const next = [...axes];
    next[i] = { ...next[i], [k]: v };
    setAxes(next);
  };

  const generate = () => {
    const axesWithValues = axes.filter((a) => a.label && a.values).map((a) => ({
      label: a.label,
      values: a.values.split(',').map((v) => v.trim()).filter(Boolean),
    }));

    if (axesWithValues.length === 0) { toast.error('Add at least one axis with values'); return; }

    // Cartesian product
    const cartesian = (arrays: string[][]): string[][] => {
      if (arrays.length === 0) return [[]];
      return arrays[0].flatMap((v) => cartesian(arrays.slice(1)).map((rest) => [v, ...rest]));
    };

    const combos = cartesian(axesWithValues.map((a) => a.values));
    const variants = combos.map((combo) => {
      const options: Record<string, string> = {};
      axesWithValues.forEach((a, i) => { options[a.label] = combo[i]; });
      return {
        id: `new-${Date.now()}-${Math.random()}`,
        name: combo.join(' / '),
        sku: `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        price: 0,
        comparePrice: null,
        stock: 0,
        image: null,
        options,
        isAvailable: true,
      };
    });

    toast.success(`Generated ${variants.length} variants`);
    onGenerate(variants);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Zap size={18} className="text-amber-500" /> Variant Generator
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-slate-500">Define option axes. All combinations will be auto-generated.</p>
          {axes.map((axis, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={axis.label}
                onChange={(e) => updateAxis(i, 'label', e.target.value)}
                placeholder="Axis (e.g. Color)"
                className="w-28 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
              <input
                value={axis.values}
                onChange={(e) => updateAxis(i, 'values', e.target.value)}
                placeholder="Values (comma separated)"
                className="flex-1 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
              <button onClick={() => removeAxis(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
          <button onClick={addAxis} className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
            <Plus size={13} /> Add Axis
          </button>

          {/* Preview count */}
          {axes.every((a) => a.label && a.values) && axes.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
              Will generate {axes.reduce((acc, a) => acc * a.values.split(',').filter((v) => v.trim()).length, 1)} variants
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn onClick={generate}><Zap size={14} /> Generate Variants</Btn>
        </div>
      </div>
    </div>
  );
};

// ─── Bulk Edit Modal ──────────────────────────────────────────────────────────
const BulkEditModal: React.FC<{ selected: string[]; variants: any[]; onSave: (data: any) => void; onClose: () => void }> = ({
  selected, variants, onSave, onClose,
}) => {
  const [changes, setChanges] = useState({ price: '', stock: '', comparePrice: '' });
  const set = (k: string, v: string) => setChanges((c) => ({ ...c, [k]: v }));

  const apply = () => {
    const data: any = {};
    if (changes.price) data.price = parseFloat(changes.price);
    if (changes.stock) data.stock = parseInt(changes.stock);
    if (changes.comparePrice) data.comparePrice = parseFloat(changes.comparePrice);
    onSave(data);
    onClose();
    toast.success(`Updated ${selected.length} variants`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Bulk Edit ({selected.length})</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-500">Leave blank to keep existing values.</p>
          {[
            { key: 'price', label: 'Price (₹)', placeholder: 'e.g. 1200' },
            { key: 'comparePrice', label: 'Compare Price (₹)', placeholder: 'e.g. 1500' },
            { key: 'stock', label: 'Stock', placeholder: 'e.g. 50' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">{label}</label>
              <input
                type="number"
                value={(changes as any)[key]}
                onChange={(e) => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn onClick={apply}>Apply Changes</Btn>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const Variants: React.FC = () => {
  const [selectedProduct, setSelectedProduct] = useState<string>('p1');
  const [variants, setVariants] = useState<any[]>(MOCK_VARIANTS['p1'] ?? []);
  const [selected, setSelected] = useState<string[]>([]);
  const [view, setView] = useState<'matrix' | 'list'>('matrix');
  const [showGenerator, setShowGenerator] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [search, setSearch] = useState('');

  const { data: productsData } = useProducts({ limit: 50 });
  const products: any[] = productsData?.items ?? MOCK_PRODUCTS;

  const filtered = search
    ? variants.filter((v) => v.name.toLowerCase().includes(search.toLowerCase()) || v.sku.toLowerCase().includes(search.toLowerCase()))
    : variants;

  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const toggleAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map((v) => v.id));

  const handleProductChange = (pid: string) => {
    setSelectedProduct(pid);
    setVariants(MOCK_VARIANTS[pid] ?? []);
    setSelected([]);
  };

  const handleGenerate = (newVariants: any[]) => {
    setVariants((v) => [...v, ...newVariants]);
  };

  const handleBulkEdit = (data: any) => {
    setVariants((vs) => vs.map((v) => selected.includes(v.id) ? { ...v, ...data } : v));
    setSelected([]);
  };

  const toggleAvailability = (id: string) => {
    setVariants((vs) => vs.map((v) => v.id === id ? { ...v, isAvailable: !v.isAvailable } : v));
  };

  const deleteVariant = (id: string) => {
    setVariants((vs) => vs.filter((v) => v.id !== id));
    toast.success('Variant deleted');
  };

  // Matrix headers = unique option keys
  const optionKeys = variants.length > 0 ? Object.keys(variants[0]?.options ?? {}) : [];
  const matrixGroups = optionKeys.length > 0
    ? [...new Set(variants.map((v) => v.options[optionKeys[0]]))]
    : [];

  const outOfStock = variants.filter((v) => v.stock === 0).length;
  const totalStock = variants.reduce((acc, v) => acc + (v.stock ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Variants"
        subtitle="Manage product variants — matrix view, bulk edit, image mapping"
        action={
          <div className="flex items-center gap-2">
            {selected.length > 0 && (
              <Btn variant="outline" onClick={() => setShowBulkEdit(true)}>
                <Edit size={14} /> Bulk Edit ({selected.length})
              </Btn>
            )}
            <Btn onClick={() => setShowGenerator(true)}><Zap size={16} /> Generate Variants</Btn>
          </div>
        }
      />

      {/* Product Selector */}
      <Card className="p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Select Product:</label>
          <select
            value={selectedProduct}
            onChange={(e) => handleProductChange(e.target.value)}
            className="flex-1 max-w-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
            ))}
          </select>

          {/* Stats */}
          <div className="flex items-center gap-4 ml-auto text-sm">
            <span className="text-slate-500"><Package size={14} className="inline mr-1" />{variants.length} variants</span>
            <span className={outOfStock > 0 ? 'text-red-500' : 'text-slate-500'}>
              {outOfStock > 0 && <AlertTriangle size={13} className="inline mr-1" />}
              {outOfStock} out of stock
            </span>
            <span className="text-slate-500">Total stock: {totalStock}</span>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0} onChange={toggleAll} className="w-4 h-4 accent-indigo-600" />
            <span className="text-sm text-slate-600 dark:text-slate-300">Select all</span>
          </label>
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search variants..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div className="ml-auto flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            <button onClick={() => setView('matrix')} className={`p-1.5 rounded ${view === 'matrix' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600' : 'text-slate-400'}`}>
              <Grid3X3 size={16} />
            </button>
            <button onClick={() => setView('list')} className={`p-1.5 rounded ${view === 'list' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600' : 'text-slate-400'}`}>
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Matrix View (Shopify-style) */}
        {view === 'matrix' && optionKeys.length >= 2 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 px-3 text-slate-500 font-medium w-8">
                    <input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0} onChange={toggleAll} className="w-4 h-4 accent-indigo-600" />
                  </th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Variant</th>
                  {optionKeys.map((k) => (
                    <th key={k} className="text-left py-2 px-3 text-slate-500 font-medium">{k}</th>
                  ))}
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">SKU</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Price</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Stock</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Status</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id} className={`border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 ${selected.includes(v.id) ? 'bg-indigo-50 dark:bg-indigo-900/10' : ''}`}>
                    <td className="py-2 px-3">
                      <input type="checkbox" checked={selected.includes(v.id)} onChange={() => toggle(v.id)} className="w-4 h-4 accent-indigo-600" />
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 cursor-pointer hover:border-indigo-400" title="Click to assign image">
                          <ImageIcon size={14} className="text-slate-400" />
                        </div>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{v.name}</span>
                      </div>
                    </td>
                    {optionKeys.map((k) => (
                      <td key={k} className="py-2 px-3 text-slate-600 dark:text-slate-400">{v.options?.[k] ?? '—'}</td>
                    ))}
                    <td className="py-2 px-3 text-slate-500 font-mono text-xs">{v.sku}</td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        value={v.price}
                        onChange={(e) => setVariants((vs) => vs.map((vv) => vv.id === v.id ? { ...vv, price: parseFloat(e.target.value) || 0 } : vv))}
                        className="w-20 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        value={v.stock}
                        onChange={(e) => setVariants((vs) => vs.map((vv) => vv.id === v.id ? { ...vv, stock: parseInt(e.target.value) || 0 } : vv))}
                        className={`w-16 px-2 py-1 rounded border text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${v.stock === 0 ? 'border-red-400 bg-red-50 dark:bg-red-900/10' : 'border-slate-300 dark:border-slate-600'}`}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <button
                        onClick={() => toggleAvailability(v.id)}
                        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                          v.isAvailable ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                        }`}
                      >
                        {v.isAvailable ? <Eye size={10} /> : <EyeOff size={10} />}
                        {v.isAvailable ? 'Available' : 'Hidden'}
                      </button>
                    </td>
                    <td className="py-2 px-3">
                      <button onClick={() => deleteVariant(v.id)} className="p-1 text-slate-300 hover:text-red-500 rounded">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          // List view
          <div className="space-y-2">
            {filtered.map((v) => (
              <div
                key={v.id}
                className={`flex items-center gap-3 p-3 border rounded-xl transition-colors ${
                  selected.includes(v.id) ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/10' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30'
                }`}
              >
                <input type="checkbox" checked={selected.includes(v.id)} onChange={() => toggle(v.id)} className="w-4 h-4 accent-indigo-600" />

                {/* Image */}
                <div className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center cursor-pointer hover:border-indigo-400 flex-shrink-0">
                  <ImageIcon size={16} className="text-slate-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white text-sm">{v.name}</p>
                  <p className="text-xs text-slate-400 font-mono">{v.sku}</p>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Price</p>
                    <p className="font-semibold text-slate-900 dark:text-white">₹{v.price}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Stock</p>
                    <p className={`font-semibold ${v.stock === 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>{v.stock}</p>
                  </div>
                </div>

                <button
                  onClick={() => toggleAvailability(v.id)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${
                    v.isAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {v.isAvailable ? <Eye size={11} /> : <EyeOff size={11} />}
                  {v.isAvailable ? 'Available' : 'Hidden'}
                </button>

                <button onClick={() => deleteVariant(v.id)} className="p-1.5 text-slate-300 hover:text-red-500 rounded">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-400">
            <Layers size={36} className="mx-auto mb-2 opacity-30" />
            <p className="font-semibold">No variants yet</p>
            <p className="text-sm mt-1">Use the generator to create all combinations automatically</p>
            <Btn className="mt-4" onClick={() => setShowGenerator(true)}><Zap size={14} /> Generate Variants</Btn>
          </div>
        )}

        {/* Save button */}
        {variants.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
            <Btn onClick={() => toast.success('Variants saved successfully!')}>Save All Changes</Btn>
          </div>
        )}
      </Card>

      {showGenerator && (
        <VariantGenerator
          productId={selectedProduct}
          onGenerate={handleGenerate}
          onClose={() => setShowGenerator(false)}
        />
      )}

      {showBulkEdit && (
        <BulkEditModal
          selected={selected}
          variants={variants}
          onSave={handleBulkEdit}
          onClose={() => setShowBulkEdit(false)}
        />
      )}
    </div>
  );
};

export default Variants;
