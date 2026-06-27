import React, { useState } from 'react';
import {
  Plus, Search, Edit, Trash2, ChevronDown, ChevronRight,
  Sliders, Type, List, Palette, Image as ImageIcon,
  Hash, ToggleLeft, Layers, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, PageHeader, Btn, Badge } from './ui';
import {
  useAttributes, useAttributeSets,
  useCreateAttribute, useUpdateAttribute, useDeleteAttribute,
  useAddAttributeValue, useDeleteAttributeValue,
  useCreateAttributeSet, useDeleteAttributeSet,
} from '@/hooks/useAttributes';

// ─── Constants ────────────────────────────────────────────────────────────────
const ATTR_TYPES = [
  { value: 'TEXT', label: 'Text', icon: Type, color: 'text-blue-500' },
  { value: 'DROPDOWN', label: 'Dropdown', icon: List, color: 'text-violet-500' },
  { value: 'COLOR', label: 'Color Swatch', icon: Palette, color: 'text-pink-500' },
  { value: 'IMAGE', label: 'Image Swatch', icon: ImageIcon, color: 'text-emerald-500' },
  { value: 'NUMBER', label: 'Number', icon: Hash, color: 'text-orange-500' },
  { value: 'BOOLEAN', label: 'Yes/No', icon: ToggleLeft, color: 'text-cyan-500' },
];

const MOCK_ATTRIBUTES = [
  {
    id: '1', name: 'Color', slug: 'color', type: 'COLOR', isFilterable: true, isVisible: true,
    values: [
      { id: 'v1', value: '#FF0000', label: 'Red', color: '#FF0000', image: null, sortOrder: 0 },
      { id: 'v2', value: '#0000FF', label: 'Blue', color: '#0000FF', image: null, sortOrder: 1 },
      { id: 'v3', value: '#000000', label: 'Black', color: '#000000', image: null, sortOrder: 2 },
      { id: 'v4', value: '#FFFFFF', label: 'White', color: '#FFFFFF', image: null, sortOrder: 3 },
    ],
    _count: { sets: 3 },
  },
  {
    id: '2', name: 'Size', slug: 'size', type: 'DROPDOWN', isFilterable: true, isVisible: true,
    values: [
      { id: 'v5', value: 'XS', label: 'XS', color: null, image: null, sortOrder: 0 },
      { id: 'v6', value: 'S', label: 'S', color: null, image: null, sortOrder: 1 },
      { id: 'v7', value: 'M', label: 'M', color: null, image: null, sortOrder: 2 },
      { id: 'v8', value: 'L', label: 'L', color: null, image: null, sortOrder: 3 },
      { id: 'v9', value: 'XL', label: 'XL', color: null, image: null, sortOrder: 4 },
    ],
    _count: { sets: 2 },
  },
  {
    id: '3', name: 'Material', slug: 'material', type: 'DROPDOWN', isFilterable: true, isVisible: true,
    values: [
      { id: 'v10', value: 'cotton', label: 'Cotton', color: null, image: null, sortOrder: 0 },
      { id: 'v11', value: 'silk', label: 'Silk', color: null, image: null, sortOrder: 1 },
      { id: 'v12', value: 'polyester', label: 'Polyester', color: null, image: null, sortOrder: 2 },
    ],
    _count: { sets: 1 },
  },
  {
    id: '4', name: 'RAM', slug: 'ram', type: 'DROPDOWN', isFilterable: true, isVisible: true,
    values: [
      { id: 'v13', value: '4gb', label: '4 GB', color: null, image: null, sortOrder: 0 },
      { id: 'v14', value: '8gb', label: '8 GB', color: null, image: null, sortOrder: 1 },
      { id: 'v15', value: '16gb', label: '16 GB', color: null, image: null, sortOrder: 2 },
    ],
    _count: { sets: 1 },
  },
];

const MOCK_SETS = [
  { id: 's1', name: 'Fashion', attributes: [{ attribute: MOCK_ATTRIBUTES[0] }, { attribute: MOCK_ATTRIBUTES[1] }, { attribute: MOCK_ATTRIBUTES[2] }] },
  { id: 's2', name: 'Electronics', attributes: [{ attribute: MOCK_ATTRIBUTES[3] }] },
];

// ─── Attribute Modal ──────────────────────────────────────────────────────────
const AttributeModal: React.FC<{
  attr?: any; onClose: () => void; onCreate: (d: any) => void; onUpdate: (id: string, d: any) => void;
}> = ({ attr, onClose, onCreate, onUpdate }) => {
  const isEdit = !!attr;
  const [form, setForm] = useState({
    name: attr?.name ?? '',
    slug: attr?.slug ?? '',
    type: attr?.type ?? 'DROPDOWN',
    isFilterable: attr?.isFilterable ?? true,
    isVisible: attr?.isVisible ?? true,
    isRequired: attr?.isRequired ?? false,
    values: (attr?.values ?? []).map((v: any) => ({ ...v })),
  });
  const [newValue, setNewValue] = useState({ label: '', value: '', color: '#000000', image: '' });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const autoSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const addValue = () => {
    if (!newValue.label.trim()) { toast.error('Label required'); return; }
    set('values', [...form.values, { ...newValue, id: `new-${Date.now()}`, sortOrder: form.values.length }]);
    setNewValue({ label: '', value: '', color: '#000000', image: '' });
  };

  const removeValue = (id: string) => set('values', form.values.filter((v: any) => v.id !== id));

  const submit = () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    const payload = { ...form, slug: form.slug || autoSlug(form.name) };
    isEdit ? onUpdate(attr.id, payload) : onCreate(payload);
    onClose();
  };

  const typeInfo = ATTR_TYPES.find((t) => t.value === form.type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{isEdit ? 'Edit Attribute' : 'New Attribute'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Name *</label>
              <input
                value={form.name}
                onChange={(e) => { set('name', e.target.value); if (!form.slug) set('slug', autoSlug(e.target.value)); }}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Color"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Type</label>
              <select
                value={form.type}
                onChange={(e) => set('type', e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
              >
                {ATTR_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-5">
            {[
              { key: 'isFilterable', label: 'Filterable' },
              { key: 'isVisible', label: 'Visible on PDP' },
              { key: 'isRequired', label: 'Required' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={(form as any)[key]} onChange={(e) => set(key, e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
              </label>
            ))}
          </div>

          {/* Values section */}
          {['DROPDOWN', 'COLOR', 'IMAGE'].includes(form.type) && (
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-3">Values</p>
              <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                {form.values.map((v: any) => (
                  <div key={v.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700/40 rounded-lg">
                    {form.type === 'COLOR' && (
                      <div className="w-6 h-6 rounded border border-slate-300 flex-shrink-0" style={{ backgroundColor: v.color || v.value }} />
                    )}
                    <span className="flex-1 text-sm text-slate-800 dark:text-slate-200">{v.label}</span>
                    <span className="text-xs text-slate-400">{v.value}</span>
                    <button onClick={() => removeValue(v.id)} className="text-slate-300 hover:text-red-500"><X size={12} /></button>
                  </div>
                ))}
              </div>
              {/* Add new value */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                {form.type === 'COLOR' && (
                  <input type="color" value={newValue.color} onChange={(e) => setNewValue((n) => ({ ...n, color: e.target.value, value: e.target.value }))}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                )}
                <input
                  value={newValue.label}
                  onChange={(e) => setNewValue((n) => ({ ...n, label: e.target.value, value: n.value || e.target.value.toLowerCase() }))}
                  placeholder="Label (e.g. Red)"
                  className="flex-1 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
                <input
                  value={newValue.value}
                  onChange={(e) => setNewValue((n) => ({ ...n, value: e.target.value }))}
                  placeholder="Value"
                  className="w-20 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
                <button onClick={addValue} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-semibold hover:bg-indigo-700">
                  <Plus size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700 sticky bottom-0 bg-white dark:bg-slate-800">
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn onClick={submit}>{isEdit ? 'Save Changes' : 'Create Attribute'}</Btn>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const Attributes: React.FC = () => {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [modal, setModal] = useState<{ open: boolean; attr?: any }>({ open: false });
  const [tab, setTab] = useState<'attributes' | 'sets'>('attributes');

  const { data: attrsData, isLoading } = useAttributes({ search: search || undefined });
  const { data: setsData } = useAttributeSets();
  const createAttr = useCreateAttribute();
  const updateAttr = useUpdateAttribute();
  const deleteAttr = useDeleteAttribute();
  const createSet = useCreateAttributeSet();
  const deleteSet = useDeleteAttributeSet();

  const attrs: any[] = attrsData ?? MOCK_ATTRIBUTES;
  const sets: any[] = setsData ?? MOCK_SETS;

  const filtered = search ? attrs.filter((a) => a.name.toLowerCase().includes(search.toLowerCase())) : attrs;

  const toggle = (id: string) => setExpanded((e) => e.includes(id) ? e.filter((x) => x !== id) : [...e, id]);

  const TypeIcon = ({ type }: { type: string }) => {
    const info = ATTR_TYPES.find((t) => t.value === type);
    if (!info) return null;
    return <info.icon size={14} className={info.color} />;
  };

  return (
    <div>
      <PageHeader
        title="Attributes"
        subtitle="Define product attributes, swatches, and attribute sets"
        action={<Btn onClick={() => setModal({ open: true })}><Plus size={16} /> New Attribute</Btn>}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {ATTR_TYPES.map((t) => {
          const count = attrs.filter((a) => a.type === t.value).length;
          return (
            <Card key={t.value} className="p-3 flex items-center gap-2">
              <t.icon size={18} className={t.color} />
              <div>
                <p className="text-xs text-slate-500">{t.label}</p>
                <p className="font-bold text-slate-900 dark:text-white">{count}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
        {(['attributes', 'sets'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors capitalize ${
              tab === t ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'sets' ? 'Attribute Sets' : 'Attributes'}
          </button>
        ))}
      </div>

      {tab === 'attributes' ? (
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search attributes..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="space-y-2">
              {filtered.map((attr) => (
                <div key={attr.id} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  {/* Attribute header */}
                  <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <button
                      onClick={() => toggle(attr.id)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {expanded.includes(attr.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <TypeIcon type={attr.type} />
                    <span className="font-semibold text-slate-900 dark:text-white flex-1">{attr.name}</span>
                    <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                      {attr.values?.length ?? 0} values
                    </span>
                    {attr.isFilterable && (
                      <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full">Filterable</span>
                    )}
                    <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                      {ATTR_TYPES.find((t) => t.value === attr.type)?.label}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setModal({ open: true, attr })}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => deleteAttr.mutate(attr.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded values */}
                  {expanded.includes(attr.id) && (
                    <div className="border-t border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/30">
                      <div className="flex flex-wrap gap-2">
                        {(attr.values ?? []).map((v: any) => (
                          <div
                            key={v.id}
                            className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
                          >
                            {attr.type === 'COLOR' && (
                              <div className="w-4 h-4 rounded-full border border-slate-300 flex-shrink-0" style={{ backgroundColor: v.color || v.value }} />
                            )}
                            <span className="text-sm text-slate-800 dark:text-slate-200">{v.label}</span>
                            {attr.type !== 'COLOR' && <span className="text-xs text-slate-400">({v.value})</span>}
                          </div>
                        ))}
                        {(attr.values ?? []).length === 0 && (
                          <p className="text-xs text-slate-400 italic">No values yet. Click Edit to add values.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                  <Sliders size={36} className="mx-auto mb-2 opacity-30" />
                  <p>No attributes yet</p>
                </div>
              )}
            </div>
          )}
        </Card>
      ) : (
        // Attribute Sets
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers size={16} className="text-indigo-500" /> Attribute Sets
            </h3>
            <Btn
              onClick={() => {
                const name = window.prompt('Set name (e.g. Fashion, Electronics):');
                if (name) createSet.mutate({ name, attributeIds: [] });
              }}
            >
              <Plus size={14} /> New Set
            </Btn>
          </div>
          <div className="space-y-3">
            {sets.map((set) => (
              <div key={set.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-900 dark:text-white">{set.name}</h4>
                  <button onClick={() => deleteSet.mutate(set.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {set.attributes.map(({ attribute }: any) => (
                    <div key={attribute.id} className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg px-2.5 py-1">
                      <TypeIcon type={attribute.type} />
                      <span className="text-sm text-indigo-700 dark:text-indigo-300">{attribute.name}</span>
                    </div>
                  ))}
                  {set.attributes.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No attributes in this set.</p>
                  )}
                </div>
              </div>
            ))}
            {sets.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <Layers size={32} className="mx-auto mb-2 opacity-30" />
                <p>No attribute sets yet</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {modal.open && (
        <AttributeModal
          attr={modal.attr}
          onClose={() => setModal({ open: false })}
          onCreate={(d) => createAttr.mutate(d)}
          onUpdate={(id, d) => updateAttr.mutate({ id, data: d })}
        />
      )}
    </div>
  );
};

export default Attributes;
