import React, { useState, useCallback, useMemo } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragEndEvent, DragOverlay, DragStartEvent, DragMoveEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, ChevronRight, ChevronDown, FolderTree, GripVertical, Edit,
  Image as ImageIcon, Trash2, Eye, EyeOff, Star, Home, Navigation,
  MoveRight, Merge, Search, Settings2, Zap, Globe,
  Layout, X, AlertTriangle, RefreshCw, Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, PageHeader, Btn, Badge } from './ui';
import ImageUpload from '@/components/ImageUpload';
import {
  useCategoryTree, useCreateCategory, useUpdateCategory, useDeleteCategory,
  useReorderCategories, useBulkMoveCategories, useMergeCategories, useUpdateCategoryVisibility,
} from '@/hooks/useCategories';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId: string | null;
  isActive: boolean;
  isFeatured: boolean;
  showOnHomepage: boolean;
  menuVisibility: string;
  sortOrder: number;
  bannerImage?: string;
  metaTitle?: string;
  metaDescription?: string;
  rules?: any[];
  _count: { products: number };
  children: Category[];
}

// Static mock data removed — tree is loaded from API via useCategoryTree()

// ─── Tree helpers ─────────────────────────────────────────────────────────────
type FlatItem = Category & { depth: number };

function flattenTree(nodes: Category[], depth = 0): FlatItem[] {
  return nodes.flatMap((n) => [
    { ...n, depth },
    ...flattenTree(n.children ?? [], depth + 1),
  ]);
}

// All visible items in tree order (respects expand/collapse state)
function flattenVisible(nodes: Category[], expanded: string[], depth = 0): FlatItem[] {
  return nodes.flatMap((n) => {
    const row = { ...n, depth };
    if (expanded.includes(n.id) && (n.children ?? []).length > 0) {
      return [row, ...flattenVisible(n.children, expanded, depth + 1)];
    }
    return [row];
  });
}

// IDs of all descendants of a node (used for circular-dep guard)
function getDescendantIds(nodes: Category[], id: string): string[] {
  const find = (ns: Category[]): Category | null => {
    for (const n of ns) {
      if (n.id === id) return n;
      const f = find(n.children ?? []);
      if (f) return f;
    }
    return null;
  };
  const collect = (ns: Category[]): string[] =>
    ns.flatMap((n) => [n.id, ...collect(n.children ?? [])]);
  const node = find(nodes);
  return node ? collect(node.children ?? []) : [];
}

// Remove a node from the tree and return it
function removeFromTree(nodes: Category[], id: string): [Category[], Category | null] {
  let removed: Category | null = null;
  const result = nodes
    .filter((n) => { if (n.id === id) { removed = n; return false; } return true; })
    .map((n) => {
      const [children, r] = removeFromTree(n.children ?? [], id);
      if (r) removed = r;
      return { ...n, children };
    });
  return [result, removed];
}

// Compute projected depth + parentId while dragging
function getProjection(
  flat: FlatItem[],
  activeId: string,
  overId: string,
  dragOffsetX: number,
): { depth: number; parentId: string | null } | null {
  const activeIdx = flat.findIndex((i) => i.id === activeId);
  const overIdx   = flat.findIndex((i) => i.id === overId);
  if (activeIdx === -1 || overIdx === -1) return null;

  const activeItem = flat[activeIdx];
  const reordered  = arrayMove(flat, activeIdx, overIdx);
  const prevItem   = reordered[overIdx - 1];
  const nextItem   = reordered[overIdx + 1];

  const depthDelta  = Math.round(dragOffsetX / INDENT_PX);
  const rawDepth    = activeItem.depth + depthDelta;
  const maxDepth    = prevItem ? prevItem.depth + 1 : 0;
  const minDepth    = nextItem ? nextItem.depth : 0;
  const depth       = Math.max(minDepth, Math.min(rawDepth, maxDepth));

  let parentId: string | null = null;
  if (depth > 0) {
    const candidates = reordered.slice(0, overIdx).reverse();
    parentId = candidates.find((c) => c.depth === depth - 1)?.id ?? null;
  }
  return { depth, parentId };
}

// Apply projected move: remove active, insert near overId under newParentId
function applyMove(
  tree: Category[],
  activeId: string,
  overId: string,
  newParentId: string | null,
): Category[] {
  const [without, removed] = removeFromTree(tree, activeId);
  if (!removed) return tree;
  const item = { ...removed, parentId: newParentId };

  if (!newParentId) {
    // Insert at root level adjacent to overId
    const idx = without.findIndex((n) => n.id === overId);
    const result = [...without];
    result.splice(idx !== -1 ? idx + 1 : result.length, 0, item);
    return result.map((n, i) => ({ ...n, sortOrder: i }));
  }

  const insertUnder = (nodes: Category[]): Category[] =>
    nodes.map((n) => {
      if (n.id === newParentId) {
        const kids = [...(n.children ?? [])];
        const idx  = kids.findIndex((c) => c.id === overId);
        kids.splice(idx !== -1 ? idx + 1 : kids.length, 0, item);
        return { ...n, children: kids.map((c, i) => ({ ...c, sortOrder: i })) };
      }
      return { ...n, children: insertUnder(n.children ?? []) };
    });
  return insertUnder(without);
}

// Collect {id, sortOrder} for API save
function collectOrders(nodes: Category[]): { id: string; sortOrder: number }[] {
  return nodes.flatMap((n) => [
    { id: n.id, sortOrder: n.sortOrder },
    ...collectOrders(n.children ?? []),
  ]);
}

const INDENT_PX = 20;
const VISIBILITY_OPTIONS = [
  { value: 'BOTH', label: 'Header & Footer', icon: Navigation },
  { value: 'HEADER', label: 'Header only', icon: Navigation },
  { value: 'FOOTER', label: 'Footer only', icon: Globe },
  { value: 'HIDDEN', label: 'Hide from Nav', icon: EyeOff },
];

// ─── Category Modal ───────────────────────────────────────────────────────────
const CategoryModal: React.FC<{
  cat?: Category; parent?: Category; allCategories: Category[];
  onClose: () => void; onSave: (data: any) => void;
}> = ({ cat, parent, allCategories, onClose, onSave }) => {
  const isEdit = !!cat;
  const [tab, setTab] = useState<'basic' | 'seo' | 'rules' | 'page'>('basic');
  const [form, setForm] = useState({
    name: cat?.name ?? '',
    slug: cat?.slug ?? '',
    description: cat?.description ?? '',
    parentId: cat?.parentId ?? parent?.id ?? '',
    isActive: cat?.isActive ?? true,
    isFeatured: cat?.isFeatured ?? false,
    showOnHomepage: cat?.showOnHomepage ?? false,
    menuVisibility: cat?.menuVisibility ?? 'BOTH',
    metaTitle: cat?.metaTitle ?? '',
    metaDescription: cat?.metaDescription ?? '',
    rules: cat?.rules ?? [],
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const autoSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const addRule = () => set('rules', [...form.rules, { field: 'brand', operator: 'eq', value: '' }]);
  const removeRule = (i: number) => set('rules', form.rules.filter((_: any, idx: number) => idx !== i));
  const updateRule = (i: number, k: string, v: string) => {
    const next = [...form.rules]; next[i] = { ...next[i], [k]: v }; set('rules', next);
  };

  const submit = () => {
    if (!form.name.trim()) { toast.error('Category name is required'); return; }
    onSave({ ...form, slug: form.slug || autoSlug(form.name) });
    onClose();
  };

  const flatAll = flattenTree(allCategories).filter((c) => c.id !== cat?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{isEdit ? `Edit: ${cat!.name}` : 'Add Category'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>

        <div className="flex gap-1 px-5 pt-3 border-b border-slate-200 dark:border-slate-700">
          {(['basic', 'seo', 'rules', 'page'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-sm font-medium rounded-t-lg capitalize transition-colors -mb-px ${
                tab === t ? 'bg-white dark:bg-slate-800 text-indigo-600 border-t border-l border-r border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {t === 'rules' ? 'Auto Rules' : t === 'page' ? 'Landing Page' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'basic' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide block mb-1.5">Category Banner</label>
                <ImageUpload
                  value={form.bannerImage ?? ''}
                  onChange={(url) => set('bannerImage', url)}
                  label="Click or drag to upload banner"
                  hint="1920×400 recommended • JPG, PNG, WebP — max 5 MB"
                  aspectClass="aspect-[4/1]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Category Name *</label>
                  <input value={form.name}
                    onChange={(e) => { set('name', e.target.value); if (!form.slug) set('slug', autoSlug(e.target.value)); }}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="e.g. Sarees" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Slug</label>
                  <input value={form.slug} onChange={(e) => set('slug', e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="auto-generated" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Parent Category</label>
                  <select value={form.parentId} onChange={(e) => set('parentId', e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white">
                    <option value="">None (Root Level)</option>
                    {flatAll.map((c) => (
                      <option key={c.id} value={c.id}>{'  '.repeat(c.depth)}{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Description</label>
                <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white resize-none" />
              </div>
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-3">Visibility</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => set('menuVisibility', opt.value)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-colors ${
                        form.menuVisibility === opt.value ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                      }`}>
                      <opt.icon size={14} /> {opt.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-4">
                  {[{ key: 'isActive', label: 'Active' }, { key: 'isFeatured', label: 'Featured' }, { key: 'showOnHomepage', label: 'Show on Homepage' }].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={(form as any)[key]} onChange={(e) => set(key, e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'seo' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Meta Title</label>
                <input value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="SEO title..." />
                <p className="text-xs text-slate-400 mt-1">{form.metaTitle.length}/70 characters</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Meta Description</label>
                <textarea value={form.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} rows={3}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white resize-none"
                  placeholder="Describe this category for search engines..." />
                <p className="text-xs text-slate-400 mt-1">{form.metaDescription.length}/160 characters</p>
              </div>
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-900/40">
                <p className="text-xs font-semibold text-slate-500 mb-2">Google Preview</p>
                <p className="text-blue-700 dark:text-blue-400 text-sm font-medium truncate">{form.metaTitle || form.name || 'Category Title'}</p>
                <p className="text-xs text-green-700 dark:text-green-500">yourstore.com/category/{form.slug || 'slug'}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{form.metaDescription || form.description || 'Category description...'}</p>
              </div>
            </div>
          )}

          {tab === 'rules' && (
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <p>Auto-rules assign products to this category based on matching conditions.</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Auto-assign Rules</label>
                  <button onClick={addRule} className="text-xs text-indigo-600 hover:underline flex items-center gap-1"><Plus size={12} /> Add Rule</button>
                </div>
                <div className="space-y-2">
                  {form.rules.map((rule: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <select value={rule.field} onChange={(e) => updateRule(i, 'field', e.target.value)}
                        className="w-28 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                        <option value="brand">Brand</option>
                        <option value="tags">Tag</option>
                        <option value="status">Status</option>
                      </select>
                      <span className="text-slate-400 text-sm">=</span>
                      <input value={rule.value} onChange={(e) => updateRule(i, 'value', e.target.value)}
                        placeholder="value"
                        className="flex-1 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                      <button onClick={() => removeRule(i)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                    </div>
                  ))}
                  {form.rules.length === 0 && <p className="text-xs text-slate-400 italic">No rules yet. Add one above.</p>}
                </div>
              </div>
            </div>
          )}

          {tab === 'page' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">Build a custom landing page for this category.</p>
              <div className="grid grid-cols-2 gap-3">
                {['Hero Banner', 'Featured Collection', 'Brand Showcase', 'Promotional Strip'].map((section) => (
                  <button key={section} onClick={() => toast.info(`Add "${section}" section`)}
                    className="flex items-center gap-2 p-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
                    <Plus size={14} /> {section}
                  </button>
                ))}
              </div>
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center text-sm text-slate-400">
                <Layout size={24} className="mx-auto mb-1 opacity-40" />
                Drag section types to build your category landing page
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn onClick={submit}>{isEdit ? 'Save Changes' : 'Create Category'}</Btn>
        </div>
      </div>
    </div>
  );
};

// ─── Merge Modal ──────────────────────────────────────────────────────────────
const MergeModal: React.FC<{
  sources: Category[]; allFlat: (Category & { depth: number })[];
  onMerge: (targetId: string) => void; onClose: () => void;
}> = ({ sources, allFlat, onMerge, onClose }) => {
  const [targetId, setTargetId] = useState('');
  const sourceIds = new Set(sources.map((s) => s.id));
  const eligible = allFlat.filter((c) => !sourceIds.has(c.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><Merge size={18} className="text-violet-500" /> Merge Categories</h2>
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-slate-50 dark:bg-slate-700/40 rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-500 mb-2">Merging:</p>
            {sources.map((s) => <p key={s.id} className="text-sm text-slate-800 dark:text-slate-200">• {s.name}</p>)}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Merge Into</label>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white">
              <option value="">Select target…</option>
              {eligible.map((c) => (
                <option key={c.id} value={c.id}>{'—'.repeat(c.depth)} {c.name}</option>
              ))}
            </select>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <AlertTriangle size={12} /> Products from source categories move to target. Sources are deleted.
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn onClick={() => { if (!targetId) { toast.error('Select a target'); return; } onMerge(targetId); onClose(); }}>
            <Merge size={14} /> Merge
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ─── Bulk Move Modal ──────────────────────────────────────────────────────────
const BulkMoveModal: React.FC<{
  sources: Category[]; allFlat: (Category & { depth: number })[];
  onMove: (parentId: string | null) => void; onClose: () => void;
}> = ({ sources, allFlat, onMove, onClose }) => {
  const [targetId, setTargetId] = useState<string>('');
  const sourceIds = new Set(sources.map((s) => s.id));
  const eligible = allFlat.filter((c) => !sourceIds.has(c.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><MoveRight size={18} className="text-blue-500" /> Bulk Move</h2>
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-slate-50 dark:bg-slate-700/40 rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-500 mb-1">Moving {sources.length} categories:</p>
            {sources.map((s) => <p key={s.id} className="text-sm text-slate-700 dark:text-slate-300">• {s.name}</p>)}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Move Under</label>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white">
              <option value="">Root (no parent)</option>
              {eligible.map((c) => (
                <option key={c.id} value={c.id}>{'—'.repeat(c.depth)} {c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn onClick={() => { onMove(targetId || null); onClose(); }}>
            <MoveRight size={14} /> Move & Save
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ─── Sortable Tree Node ───────────────────────────────────────────────────────
interface TreeNodeProps {
  node: Category;
  depth: number;
  expanded: string[];
  selected: string[];
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onEdit: (cat: Category) => void;
  onDelete: (id: string) => void;
  onAddChild: (parent: Category) => void;
  onVisibility: (id: string, key: string, val: any) => void;
}

const SortableTreeNode: React.FC<TreeNodeProps> = ({
  node, depth, expanded, selected, onToggle, onSelect, onEdit, onDelete, onAddChild, onVisibility,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasChildren = (node.children ?? []).length > 0;
  const isExpanded = expanded.includes(node.id);
  const isSelected = selected.includes(node.id);

  const visibilityIcon = () => {
    switch (node.menuVisibility) {
      case 'HIDDEN': return <EyeOff size={11} className="text-slate-400" title="Hidden" />;
      case 'HEADER': return <Navigation size={11} className="text-blue-400" title="Header only" />;
      case 'FOOTER': return <Globe size={11} className="text-slate-400" title="Footer only" />;
      default: return <Eye size={11} className="text-emerald-400" title="Visible everywhere" />;
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* Row */}
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded-lg group transition-colors ${
          isDragging ? 'opacity-40 bg-indigo-50 dark:bg-indigo-900/30 border border-dashed border-indigo-300' :
          isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700' :
          'hover:bg-slate-50 dark:hover:bg-slate-700/40'
        }`}
        style={{ paddingLeft: `${12 + depth * INDENT_PX}px` }}
      >
        {/* Drag handle — only this triggers drag */}
        <button
          {...attributes}
          {...listeners}
          className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>

        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(node.id)}
          className="w-4 h-4 accent-indigo-600 flex-shrink-0"
        />

        {hasChildren ? (
          <button onClick={() => onToggle(node.id)} className="text-slate-400 hover:text-slate-700 flex-shrink-0">
            {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        <span className={`font-medium flex-1 truncate text-sm ${
          depth === 0 ? 'text-slate-900 dark:text-white font-semibold' :
          depth === 1 ? 'text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'
        }`}>
          {node.name}
        </span>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {node.isFeatured && <Star size={11} className="text-amber-500 fill-amber-400" title="Featured" />}
          {node.showOnHomepage && <Home size={11} className="text-indigo-500" title="On Homepage" />}
          {visibilityIcon()}
          <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">{node._count?.products ?? 0}</span>
          <Badge status={node.isActive ? 'Active' : 'Inactive'} />
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={() => onAddChild(node)} className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" title="Add child">
            <Plus size={13} />
          </button>
          <button onClick={() => onEdit(node)} className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20" title="Edit">
            <Edit size={13} />
          </button>
          <button onClick={() => onVisibility(node.id, 'isFeatured', !node.isFeatured)} className="p-1 rounded text-slate-400 hover:text-amber-500" title="Toggle featured">
            <Star size={13} />
          </button>
          <button onClick={() => onDelete(node.id)} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Children — no nested SortableContext; the parent DndContext has one flat list */}
      {isExpanded && hasChildren && (
        <div>
          {(node.children ?? []).map((child) => (
            <SortableTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              selected={selected}
              onToggle={onToggle}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onVisibility={onVisibility}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const Categories: React.FC = () => {
  // ─── API ─────────────────────────────────────────────────────────────────
  const { data: apiTree, isLoading } = useCategoryTree();
  const createCategory   = useCreateCategory();
  const updateCategory_  = useUpdateCategory();
  const deleteCategory_  = useDeleteCategory();
  const reorderCats      = useReorderCategories();
  const bulkMove_        = useBulkMoveCategories();
  const merge_           = useMergeCategories();
  const updateVisibility_= useUpdateCategoryVisibility();

  // ─── Local optimistic tree ────────────────────────────────────────────────
  const [tree, setTree] = useState<Category[]>([]);

  // Sync local state when API data arrives (or refreshes)
  React.useEffect(() => {
    if (apiTree && Array.isArray(apiTree)) setTree(apiTree as Category[]);
  }, [apiTree]);

  const [expanded, setExpanded] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; cat?: Category; parent?: Category } | null>(null);
  const [mergeModal, setMergeModal] = useState(false);
  const [moveModal, setMoveModal] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const allFlat      = flattenTree(tree);
  const flatVisible  = useMemo(() => flattenVisible(tree, expanded), [tree, expanded]);
  const selectedCats = allFlat.filter((c) => selected.includes(c.id));
  const activeNode   = activeId ? allFlat.find((c) => c.id === activeId) : null;

  // Live projection while dragging (depth + parentId)
  const projection = useMemo(() => {
    if (!activeId) return null;
    const overId = flatVisible.find((n) => n.id !== activeId)?.id ?? null;
    return overId ? getProjection(flatVisible, activeId, overId, offsetLeft) : null;
  }, [activeId, flatVisible, offsetLeft]);

  const searchFlat = search
    ? allFlat.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.slug.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  const resetDrag = useCallback(() => { setActiveId(null); setOffsetLeft(0); }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setOffsetLeft(0);
  }, []);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    setOffsetLeft(event.delta.x);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = active.id as string;
    const overId   = over?.id as string | undefined;
    resetDrag();

    if (!overId || activeId === overId) return;

    const proj = getProjection(flatVisible, activeId, overId, offsetLeft);
    if (!proj) return;

    // Circular dependency guard: can't drop a node under its own descendant
    if (proj.parentId && getDescendantIds(tree, activeId).includes(proj.parentId)) {
      toast.error("Can't move a category under its own child");
      return;
    }

    setTree((prev) => applyMove(prev, activeId, overId, proj.parentId));
    setIsDirty(true);
  }, [flatVisible, offsetLeft, tree, resetDrag]);

  const handleSaveOrder = () => {
    setSaving(true);
    const orders = collectOrders(tree);
    reorderCats.mutate(orders, {
      onSettled: () => { setSaving(false); setIsDirty(false); },
    });
  };

  const toggle = (id: string) =>
    setExpanded((e) => e.includes(id) ? e.filter((x) => x !== id) : [...e, id]);
  const selectCat = (id: string) =>
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const addCategory = (data: any) => {
    createCategory.mutate(data, {
      onSuccess: () => {
        if (data.parentId) setExpanded((e) => e.includes(data.parentId) ? e : [...e, data.parentId]);
      },
    });
  };

  const updateCategory = (id: string, data: Partial<Category>, showToast = true) => {
    // Optimistic local update for instant UI
    const patch = (nodes: Category[]): Category[] =>
      nodes.map((n) =>
        n.id === id ? { ...n, ...data, children: n.children } : { ...n, children: patch(n.children ?? []) }
      );
    setTree(patch);
    // Persist to API
    if (showToast) {
      updateCategory_.mutate({ id, data });
    } else {
      // Visibility toggles — fire-and-forget, invalidate silently
      updateVisibility_.mutate({ id, data });
    }
  };

  const deleteCategory = (id: string) => {
    const remove = (nodes: Category[]): Category[] =>
      nodes.filter((n) => n.id !== id).map((n) => ({ ...n, children: remove(n.children ?? []) }));
    setTree(remove);
    setSelected((s) => s.filter((x) => x !== id));
    deleteCategory_.mutate(id);
  };

  const handleMerge = (targetId: string) => {
    const sourceIds = selectedCats.map((s) => s.id);
    setSelected([]);
    merge_.mutate({ sourceIds, targetId });
  };

  const handleBulkMove = (parentId: string | null) => {
    const sourceIds = selectedCats.map((s) => s.id);
    setSelected([]);
    if (parentId) setExpanded((e) => e.includes(parentId) ? e : [...e, parentId]);
    bulkMove_.mutate({ ids: sourceIds, parentId });
  };

  const featuredCats = allFlat.filter((c) => c.isFeatured);
  const homepageCats = allFlat.filter((c) => c.showOnHomepage);
  const totalProducts = allFlat.reduce((acc, c) => acc + (c._count?.products ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Drag to reorder • Multi-select for bulk move & merge • N-th level tree"
        action={<Btn onClick={() => setModal({ open: true })}><Plus size={16} /> Add Category</Btn>}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Categories', value: allFlat.length, empty: 'No categories', icon: FolderTree, color: 'bg-indigo-500' },
          { label: 'Products Covered', value: totalProducts, empty: 'Add products', icon: Settings2, color: 'bg-emerald-500' },
          { label: 'Featured',         value: featuredCats.length, empty: 'None featured', icon: Star, color: 'bg-amber-500' },
          { label: 'On Homepage',      value: homepageCats.length, empty: 'None selected', icon: Home, color: 'bg-blue-500' },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                {s.value > 0 ? (
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{s.value}</p>
                ) : (
                  <p className="text-sm text-slate-400 italic mt-1">{s.empty}</p>
                )}
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.value > 0 ? s.color : 'bg-slate-200 dark:bg-slate-700'}`}>
                <s.icon size={18} className={s.value > 0 ? 'text-white' : 'text-slate-400'} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tree */}
        <div className="lg:col-span-2">
          <Card className="p-5">
            {/* Unsaved banner */}
            {isDirty && (
              <div className="flex items-center justify-between gap-3 mb-4 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg">
                <span className="text-sm text-amber-700 dark:text-amber-300 font-medium flex items-center gap-2">
                  <AlertTriangle size={14} /> You have unsaved order changes
                </span>
                <div className="flex gap-2">
                  <button onClick={() => { if (apiTree) setTree(apiTree as Category[]); setIsDirty(false); }} className="text-xs text-slate-500 hover:text-slate-700 underline">Discard</button>
                  <Btn onClick={handleSaveOrder}>
                    {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                    Save Order
                  </Btn>
                </div>
              </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search categories..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>

              {selected.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">{selected.length} selected</span>
                  <button onClick={() => setMoveModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <MoveRight size={13} /> Move
                  </button>
                  <button onClick={() => { if (selectedCats.length < 2) { toast.error('Select at least 2 to merge'); return; } setMergeModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700">
                    <Merge size={13} /> Merge
                  </button>
                  <button onClick={() => setSelected([])} className="px-2 py-1.5 text-sm text-slate-400 hover:text-slate-700">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Loading */}
            {isLoading && (
              <div className="space-y-2 py-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-9 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" style={{ width: `${90 - i * 10}%` }} />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!isLoading && tree.length === 0 && !search && (
              <div className="py-10 text-center text-slate-400 text-sm">
                <FolderTree size={32} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No categories yet</p>
                <p className="text-xs mt-1">Click "Add Category" to create your first one</p>
              </div>
            )}

            {/* Search results (flat list) or DnD tree */}
            {!isLoading && searchFlat ? (
              <div className="space-y-1">
                {searchFlat.length === 0 ? (
                  <p className="text-center py-6 text-slate-400 text-sm">No categories found</p>
                ) : searchFlat.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/40 group">
                    <input type="checkbox" checked={selected.includes(cat.id)} onChange={() => selectCat(cat.id)} className="w-4 h-4 accent-indigo-600" />
                    <span className="text-slate-400 text-xs">{'›'.repeat(cat.depth)}</span>
                    <span className="flex-1 text-sm text-slate-800 dark:text-slate-200 font-medium">{cat.name}</span>
                    <span className="text-xs text-slate-400">{cat._count?.products ?? 0} products</span>
                    <button onClick={() => setModal({ open: true, cat })} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600"><Edit size={13} /></button>
                  </div>
                ))}
              </div>
            ) : !isLoading && tree.length > 0 ? (
              // Drag-and-drop tree
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
                onDragCancel={resetDrag}
              >
                {/* Single flat SortableContext — all visible items — enables cross-level DnD */}
                <SortableContext items={flatVisible.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-0.5">
                    {tree.map((node) => (
                      <SortableTreeNode
                        key={node.id}
                        node={node}
                        depth={0}
                        expanded={expanded}
                        selected={selected}
                        onToggle={toggle}
                        onSelect={selectCat}
                        onEdit={(cat) => setModal({ open: true, cat })}
                        onDelete={deleteCategory}
                        onAddChild={(parent) => setModal({ open: true, parent })}
                        onVisibility={(id, key, val) => updateCategory(id, { [key]: val } as any, false)}
                      />
                    ))}
                  </div>
                </SortableContext>

                {/* Drag ghost overlay */}
                <DragOverlay dropAnimation={null}>
                  {activeNode ? (
                    <div className="shadow-xl opacity-95 w-72">
                      {projection && (
                        <div className="flex items-center gap-1 mb-1 px-2">
                          {'→'.repeat(projection.depth + 1)}
                          <span className="text-xs text-indigo-500 font-medium ml-1">
                            {projection.parentId
                              ? `under "${allFlat.find(n => n.id === projection.parentId)?.name}"`
                              : 'root level'}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border-2 border-indigo-400 rounded-lg"
                        style={{ paddingLeft: `${12 + (projection?.depth ?? activeNode.depth) * INDENT_PX}px` }}>
                        <GripVertical size={14} className="text-indigo-400" />
                        <span className="font-semibold text-slate-900 dark:text-white text-sm truncate">{activeNode.name}</span>
                        <span className="text-xs text-slate-400 ml-auto">{activeNode._count?.products} products</span>
                      </div>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            ) : null}

            <p className="text-xs text-slate-400 mt-4 text-center">
              Drag <GripVertical size={11} className="inline" /> vertically to reorder • Drag right/left to nest or lift • Multi-select + Move to change parent
            </p>
          </Card>
        </div>

        {/* Right Panel */}
        <div className="space-y-5">
          {/* Featured */}
          <Card className="p-4">
            <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Star size={15} className="text-amber-500" /> Featured Categories
            </h3>
            <div className="space-y-1.5">
              {featuredCats.length === 0 && <p className="text-xs text-slate-400 italic">None featured yet</p>}
              {featuredCats.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-300 truncate">{cat.name}</span>
                  <button onClick={() => updateCategory(cat.id, { isFeatured: false }, false)} className="text-slate-300 hover:text-red-500 flex-shrink-0"><X size={13} /></button>
                </div>
              ))}
            </div>
          </Card>

          {/* Homepage */}
          <Card className="p-4">
            <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Home size={15} className="text-indigo-500" /> Homepage Display
            </h3>
            <div className="space-y-1.5">
              {homepageCats.length === 0 && <p className="text-xs text-slate-400 italic">None on homepage</p>}
              {homepageCats.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-300 truncate">{cat.name}</span>
                  <button onClick={() => updateCategory(cat.id, { showOnHomepage: false }, false)} className="text-slate-300 hover:text-red-500 flex-shrink-0"><X size={13} /></button>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="p-4">
            <h3 className="font-bold text-slate-900 dark:text-white mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Btn variant="outline" className="w-full justify-start gap-2" onClick={() => setExpanded(allFlat.map((c) => c.id))}>
                <ChevronDown size={14} /> Expand All
              </Btn>
              <Btn variant="outline" className="w-full justify-start gap-2" onClick={() => setExpanded([])}>
                <ChevronRight size={14} /> Collapse All
              </Btn>
              <Btn
                variant="outline"
                className={`w-full justify-start gap-2 ${isDirty ? 'border-amber-400 text-amber-600 hover:bg-amber-50' : ''}`}
                onClick={handleSaveOrder}
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                {isDirty ? 'Save Pending Order' : 'Save Order'}
              </Btn>
              <Btn variant="outline" className="w-full justify-start gap-2" onClick={() => {
                const withRules = allFlat.filter((c) => c.rules && c.rules.length > 0);
                toast.info(`Applying rules for ${withRules.length} categories...`);
              }}>
                <Zap size={14} /> Apply All Rules
              </Btn>
            </div>
          </Card>

          {/* Banner Upload */}
          <Card className="p-4">
            <h3 className="font-bold text-slate-900 dark:text-white mb-3">Category Banner</h3>
            <p className="text-xs text-slate-400 mb-3">Open a category to edit its banner, or upload a default banner here.</p>
            <ImageUpload
              value=""
              onChange={() => {}}
              label="Click to upload"
              hint="1920×400 recommended"
              aspectClass="aspect-[4/1]"
            />
          </Card>
        </div>
      </div>

      {/* Modals */}
      {modal?.open && (
        <CategoryModal
          cat={modal.cat}
          parent={modal.parent}
          allCategories={tree}
          onClose={() => setModal(null)}
          onSave={(data) => modal.cat ? updateCategory(modal.cat.id, data) : addCategory(data)}
        />
      )}

      {mergeModal && selectedCats.length >= 2 && (
        <MergeModal
          sources={selectedCats}
          allFlat={allFlat}
          onMerge={handleMerge}
          onClose={() => setMergeModal(false)}
        />
      )}

      {moveModal && selectedCats.length > 0 && (
        <BulkMoveModal
          sources={selectedCats}
          allFlat={allFlat}
          onMove={handleBulkMove}
          onClose={() => setMoveModal(false)}
        />
      )}
    </div>
  );
};

export default Categories;
