import React, { useState } from 'react';
import {
  Plus, Search, Edit, Trash2, Layers, Zap, Clock, Pin,
  MoreVertical, RefreshCw, Package, Calendar, TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, PageHeader, Btn, Badge } from './ui';
import {
  useCollections, useCreateCollection, useUpdateCollection,
  useDeleteCollection, useSyncCollection,
} from '@/hooks/useCollections';

const MOCK_COLLECTIONS = [
  { id: '1', name: 'Summer Sale 2025', slug: 'summer-sale-2025', type: 'MANUAL', isFeatured: true, isActive: true, _count: { products: 34 }, startsAt: '2025-06-01', endsAt: '2025-08-31', sortBy: 'MANUAL' },
  { id: '2', name: 'New Arrivals', slug: 'new-arrivals', type: 'AUTO', isFeatured: true, isActive: true, _count: { products: 18 }, startsAt: null, endsAt: null, sortBy: 'NEWEST' },
  { id: '3', name: 'Premium Collection', slug: 'premium', type: 'SMART', isFeatured: false, isActive: true, _count: { products: 22 }, startsAt: null, endsAt: null, sortBy: 'PRICE_DESC' },
  { id: '4', name: 'Festival Picks', slug: 'festival-picks', type: 'MANUAL', isFeatured: false, isActive: false, _count: { products: 10 }, startsAt: '2025-10-01', endsAt: '2025-10-31', sortBy: 'MANUAL' },
];

const TYPE_COLORS: Record<string, string> = {
  MANUAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  SMART: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  AUTO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

const SORT_OPTIONS = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'BEST_SELLING', label: 'Best Selling' },
  { value: 'NEWEST', label: 'Newest First' },
  { value: 'PRICE_ASC', label: 'Price: Low → High' },
  { value: 'PRICE_DESC', label: 'Price: High → Low' },
  { value: 'HIGHEST_MARGIN', label: 'Highest Margin' },
];

// ─── Smart Rule Builder ───────────────────────────────────────────────────────
const RuleBuilder: React.FC<{ rules: any[]; onChange: (r: any[]) => void }> = ({ rules, onChange }) => {
  const addRule = () => onChange([...rules, { field: 'price', operator: 'gt', value: '' }]);
  const removeRule = (i: number) => onChange(rules.filter((_, idx) => idx !== i));
  const updateRule = (i: number, key: string, val: string) => {
    const next = [...rules];
    next[i] = { ...next[i], [key]: val };
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Smart Rules</span>
        <button onClick={addRule} className="text-xs text-indigo-600 hover:underline flex items-center gap-1"><Plus size={12} /> Add Rule</button>
      </div>
      {rules.length === 0 && (
        <p className="text-xs text-slate-400 italic">No rules. All products match (auto-include).</p>
      )}
      <div className="space-y-2">
        {rules.map((rule, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={rule.field}
              onChange={(e) => updateRule(i, 'field', e.target.value)}
              className="flex-1 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
            >
              <option value="price">Price</option>
              <option value="brandId">Brand</option>
              <option value="tags">Tag</option>
              <option value="status">Status</option>
            </select>
            <select
              value={rule.operator}
              onChange={(e) => updateRule(i, 'operator', e.target.value)}
              className="w-20 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
            >
              <option value="gt">&gt;</option>
              <option value="lt">&lt;</option>
              <option value="eq">is</option>
              <option value="contains">contains</option>
            </select>
            <input
              value={rule.value}
              onChange={(e) => updateRule(i, 'value', e.target.value)}
              placeholder="value"
              className="flex-1 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
            />
            <button onClick={() => removeRule(i)} className="text-red-400 hover:text-red-600">×</button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Modal ────────────────────────────────────────────────────────────────────
const CollectionModal: React.FC<{ col?: any; onClose: () => void; onCreate: (d: any) => void; onUpdate: (id: string, d: any) => void }> = ({
  col, onClose, onCreate, onUpdate,
}) => {
  const isEdit = !!col;
  const [form, setForm] = useState({
    name: col?.name ?? '',
    slug: col?.slug ?? '',
    description: col?.description ?? '',
    type: col?.type ?? 'MANUAL',
    sortBy: col?.sortBy ?? 'MANUAL',
    isFeatured: col?.isFeatured ?? false,
    isActive: col?.isActive ?? true,
    startsAt: col?.startsAt ? col.startsAt.slice(0, 10) : '',
    endsAt: col?.endsAt ? col.endsAt.slice(0, 10) : '',
    rules: col?.rules ?? [],
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const autoSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const submit = () => {
    if (!form.name.trim()) { toast.error('Collection name required'); return; }
    const payload = { ...form, slug: form.slug || autoSlug(form.name) };
    isEdit ? onUpdate(col.id, payload) : onCreate(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{isEdit ? 'Edit Collection' : 'New Collection'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Collection Name *</label>
              <input
                value={form.name}
                onChange={(e) => { set('name', e.target.value); if (!form.slug) set('slug', autoSlug(e.target.value)); }}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Type</label>
              <select
                value={form.type}
                onChange={(e) => set('type', e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
              >
                <option value="MANUAL">Manual</option>
                <option value="SMART">Smart (rules)</option>
                <option value="AUTO">Auto (new arrivals)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Default Sort</label>
              <select
                value={form.sortBy}
                onChange={(e) => set('sortBy', e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
              >
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white resize-none"
            />
          </div>

          {/* Scheduling */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2 flex items-center gap-1"><Calendar size={12} /> Scheduling (optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Start Date</label>
                <input type="date" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="text-xs text-slate-500">End Date</label>
                <input type="date" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white" />
              </div>
            </div>
          </div>

          {/* Smart rules (shown only for SMART type) */}
          {form.type === 'SMART' && (
            <div className="border border-violet-200 dark:border-violet-800 rounded-xl p-3 bg-violet-50/40 dark:bg-violet-900/10">
              <RuleBuilder rules={form.rules} onChange={(r) => set('rules', r)} />
            </div>
          )}

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} className="w-4 h-4 accent-indigo-600" />
              <span className="text-sm text-slate-700 dark:text-slate-300">Featured</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="w-4 h-4 accent-indigo-600" />
              <span className="text-sm text-slate-700 dark:text-slate-300">Active</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700 sticky bottom-0 bg-white dark:bg-slate-800">
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn onClick={submit}>{isEdit ? 'Save Changes' : 'Create Collection'}</Btn>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const Collections: React.FC = () => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modal, setModal] = useState<{ open: boolean; col?: any }>({ open: false });
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const { data, isLoading } = useCollections({ search: search || undefined, type: typeFilter || undefined });
  const createCol = useCreateCollection();
  const updateCol = useUpdateCollection();
  const deleteCol = useDeleteCollection();
  const syncCol = useSyncCollection();

  const cols: any[] = data?.items ?? MOCK_COLLECTIONS;
  const filtered = search || typeFilter
    ? cols.filter((c) => {
        const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
        const matchType = !typeFilter || c.type === typeFilter;
        return matchSearch && matchType;
      })
    : cols;

  return (
    <div>
      <PageHeader
        title="Collections"
        subtitle="Group products into smart, auto, or manual collections"
        action={<Btn onClick={() => setModal({ open: true })}><Plus size={16} /> New Collection</Btn>}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: cols.length, accent: 'bg-indigo-500' },
          { label: 'Manual', value: cols.filter((c) => c.type === 'MANUAL').length, accent: 'bg-blue-500' },
          { label: 'Smart', value: cols.filter((c) => c.type === 'SMART').length, accent: 'bg-violet-500' },
          { label: 'Auto', value: cols.filter((c) => c.type === 'AUTO').length, accent: 'bg-emerald-500' },
        ].map((s) => (
          <Card key={s.label} className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${s.accent} flex items-center justify-center`}>
              <Layers size={18} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{s.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-48 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search collections..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
          >
            <option value="">All Types</option>
            <option value="MANUAL">Manual</option>
            <option value="SMART">Smart</option>
            <option value="AUTO">Auto</option>
          </select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            {filtered.map((col) => (
              <div key={col.id} className="flex items-center gap-4 p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <GripVertical size={16} className="text-slate-300 cursor-grab flex-shrink-0" />

                {/* Icon */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  col.type === 'SMART' ? 'bg-violet-100 dark:bg-violet-900/40' :
                  col.type === 'AUTO' ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-blue-100 dark:bg-blue-900/40'
                }`}>
                  {col.type === 'SMART' ? <Zap size={16} className="text-violet-600" /> :
                   col.type === 'AUTO' ? <RefreshCw size={16} className="text-emerald-600" /> :
                   <Package size={16} className="text-blue-600" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 dark:text-white">{col.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[col.type]}`}>{col.type}</span>
                    {col.isFeatured && <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">Featured</span>}
                    <Badge status={col.isActive ? 'Active' : 'Inactive'} />
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                    <span><Package size={10} className="inline mr-0.5" />{col._count?.products ?? 0} products</span>
                    {col.startsAt && <span><Calendar size={10} className="inline mr-0.5" />{col.startsAt.slice(0, 10)} → {col.endsAt?.slice(0, 10) ?? '∞'}</span>}
                    <span><TrendingUp size={10} className="inline mr-0.5" />{SORT_OPTIONS.find((o) => o.value === col.sortBy)?.label ?? col.sortBy}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {col.type !== 'MANUAL' && (
                    <button
                      onClick={() => syncCol.mutate(col.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                      title="Sync smart rules"
                    >
                      <RefreshCw size={14} />
                    </button>
                  )}
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === col.id ? null : col.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {menuOpen === col.id && (
                      <div className="absolute right-0 top-8 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg w-36 py-1">
                        <button onClick={() => { setModal({ open: true, col }); setMenuOpen(null); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">
                          <Edit size={13} /> Edit
                        </button>
                        <button onClick={() => { deleteCol.mutate(col.id); setMenuOpen(null); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-10 text-slate-400">
                <Layers size={36} className="mx-auto mb-2 opacity-30" />
                <p>No collections found</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {menuOpen && <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />}

      {modal.open && (
        <CollectionModal
          col={modal.col}
          onClose={() => setModal({ open: false })}
          onCreate={(d) => createCol.mutate(d)}
          onUpdate={(id, d) => updateCol.mutate({ id, data: d })}
        />
      )}
    </div>
  );
};

export default Collections;
