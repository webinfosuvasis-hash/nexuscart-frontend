import React, { useState } from 'react';
import {
  Plus, Search, Copy, Trash2, Edit, Star, Download, Upload,
  ChevronLeft, ChevronRight, LayoutGrid, LayoutList, Eye,
  TrendingUp, Package, AlertTriangle, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, PageHeader, Btn, Badge } from './ui';
import ProductModal from './ProductModal';
import CreateProduct from './CreateProduct';
import {
  useProducts, useProductStats, useDeleteProduct,
  useBulkDeleteProducts, useBulkStatusProducts, useDuplicateProduct,
  useCreateProduct, useUpdateProduct,
} from '@/hooks/useProducts';

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest First' },
  { value: 'name:asc', label: 'Name A–Z' },
  { value: 'name:desc', label: 'Name Z–A' },
  { value: 'price:desc', label: 'Price High–Low' },
  { value: 'price:asc', label: 'Price Low–High' },
  { value: 'stock:asc', label: 'Low Stock First' },
];

const fmtPrice = (p: any) => `$${Number(p).toFixed(2)}`;

const Products: React.FC = () => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('createdAt:desc');
  const [selected, setSelected] = useState<string[]>([]);
  const [modal, setModal] = useState<{ open: boolean; product?: any }>({ open: false });
  const [createScreen, setCreateScreen] = useState<{ open: boolean; product?: any } | null>(null);
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [page, setPage] = useState(1);

  const [sortBy, sortOrder] = sort.split(':');

  const { data, isLoading } = useProducts({ page, limit: PAGE_SIZE, search: query || undefined, status: status || undefined, sortBy, sortOrder });
  const { data: statsData } = useProductStats();
  const deleteProduct = useDeleteProduct();
  const bulkDelete = useBulkDeleteProducts();
  const bulkStatus = useBulkStatusProducts();
  const duplicate = useDuplicateProduct();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const items: any[] = data?.items ?? [];
  const pagination = data?.pagination;

  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const toggleAll = () => setSelected(selected.length === items.length ? [] : items.map((p) => p.id));

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this product?')) return;
    deleteProduct.mutate(id);
  };

  const handleBulkDelete = () => {
    if (!window.confirm(`Delete ${selected.length} products?`)) return;
    bulkDelete.mutate(selected, { onSuccess: () => setSelected([]) });
  };

  const handleBulkStatus = (s: string) => {
    bulkStatus.mutate({ ids: selected, status: s }, { onSuccess: () => setSelected([]) });
  };

  const handleSave = (form: any) => {
    if (modal.product) {
      updateProduct.mutate({ id: modal.product.id, data: form }, { onSuccess: () => setModal({ open: false }) });
    } else {
      createProduct.mutate(form, { onSuccess: () => setModal({ open: false }) });
    }
  };

  // Full-screen create/edit mode
  if (createScreen?.open) {
    return <CreateProduct onBack={() => setCreateScreen(null)} product={createScreen.product} />;
  }

  return (
    <div>
      <PageHeader title="Products" subtitle={`${statsData?.total ?? '…'} products in your catalog`}
        action={
          <div className="flex gap-2">
            <Btn variant="outline" onClick={() => toast.success('CSV import dialog opened')}><Upload size={16} /> Import</Btn>
            <Btn variant="outline" onClick={() => toast.success('Products exported to CSV')}><Download size={16} /> Export</Btn>
            <Btn onClick={() => setCreateScreen({ open: true })}><Plus size={16} /> Add Product</Btn>
          </div>
        }
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Products', value: statsData?.total ?? '—', icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
          { label: 'Active', value: statsData?.active ?? '—', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Draft', value: statsData?.draft ?? '—', icon: Eye, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Low Stock', value: statsData?.lowStock ?? '—', icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
        ].map((s) => (
          <Card key={s.label} className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bg}`}>
              <s.icon size={18} className={s.color} />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search by name, SKU…"
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm" />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm">
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}
            className="px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm">
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="flex gap-1">
            <button onClick={() => setView('table')} className={`p-2.5 rounded-lg border ${view === 'table' ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'border-slate-300 dark:border-slate-600 text-slate-400'}`}><LayoutList size={16} /></button>
            <button onClick={() => setView('grid')} className={`p-2.5 rounded-lg border ${view === 'grid' ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'border-slate-300 dark:border-slate-600 text-slate-400'}`}><LayoutGrid size={16} /></button>
          </div>
        </div>

        {selected.length > 0 && (
          <div className="flex items-center gap-3 mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-700">
            <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{selected.length} selected</span>
            <div className="h-4 w-px bg-indigo-200 dark:bg-indigo-700" />
            <button onClick={() => handleBulkStatus('ACTIVE')} className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">Set Active</button>
            <button onClick={() => handleBulkStatus('DRAFT')} className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline">Set Draft</button>
            <button onClick={() => handleBulkStatus('ARCHIVED')} className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:underline">Archive</button>
            <button onClick={handleBulkDelete} className="text-xs font-semibold text-red-600 hover:underline ml-auto">Delete Selected</button>
          </div>
        )}
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading products…
        </div>
      )}

      {!isLoading && view === 'table' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <th className="p-3 w-10"><input type="checkbox" checked={selected.length === items.length && items.length > 0} onChange={toggleAll} className="rounded" /></th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Product</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Category</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Price</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Stock</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Orders</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Status</th>
                  <th className="p-3 text-right font-semibold text-slate-600 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {items.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="p-3"><input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} className="rounded" /></td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img src={p.thumbnail || `https://picsum.photos/seed/${p.id}/80`} alt="" className="w-10 h-10 rounded-lg object-cover bg-slate-100 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                            {p.name}
                            {p.isFeatured && <Star size={11} className="text-amber-400 fill-amber-400 flex-shrink-0" />}
                          </p>
                          <p className="text-xs text-slate-400">{p.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {p.category?.name ?? '—'}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">{fmtPrice(p.price)}</td>
                    <td className="p-3">
                      <span className={`font-semibold ${p.stock < 10 ? 'text-rose-600' : p.stock < 30 ? 'text-amber-600' : 'text-slate-600 dark:text-slate-300'}`}>
                        {p.stock}{p.stock < 10 && <span className="ml-1 text-xs">⚠</span>}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{p._count?.orderItems ?? 0}</td>
                    <td className="p-3"><Badge status={p.status} /></td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setCreateScreen({ open: true, product: p })} title="Edit"
                          className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-400 hover:text-indigo-600 transition-colors"><Edit size={15} /></button>
                        <button onClick={() => duplicate.mutate(p.id)} title="Duplicate"
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-400 hover:text-slate-600 transition-colors"><Copy size={15} /></button>
                        <button onClick={() => handleDelete(p.id)} title="Delete"
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-400 text-sm">No products found. Add your first product to get started.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {pagination && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
              <p className="text-sm text-slate-500">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700">
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const tp = pagination.totalPages;
                  const pg = tp <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= tp - 2 ? tp - 4 + i : page - 2 + i;
                  return (
                    <button key={pg} onClick={() => setPage(pg)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium ${pg === page ? 'bg-indigo-600 text-white' : 'border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      {pg}
                    </button>
                  );
                })}
                <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {!isLoading && view === 'grid' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((p) => (
            <Card key={p.id} className="overflow-hidden group cursor-pointer hover:shadow-md transition-shadow">
              <div className="relative">
                <img src={p.thumbnail || `https://picsum.photos/seed/${p.id}/80`} alt={p.name} className="w-full h-36 object-cover bg-slate-100" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button onClick={() => setCreateScreen({ open: true, product: p })} className="p-2 rounded-full bg-white shadow text-slate-700 hover:text-indigo-600"><Edit size={14} /></button>
                  <button onClick={() => duplicate.mutate(p.id)} className="p-2 rounded-full bg-white shadow text-slate-700 hover:text-indigo-600"><Copy size={14} /></button>
                  <button onClick={() => handleDelete(p.id)} className="p-2 rounded-full bg-white shadow text-slate-700 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
                {p.isFeatured && (
                  <span className="absolute top-2 left-2 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center">
                    <Star size={12} className="text-white fill-white" />
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{p.name}</p>
                <p className="text-xs text-slate-400 mb-2">{p.sku}</p>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">{fmtPrice(p.price)}</span>
                  <Badge status={p.status} />
                </div>
                <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                  <span>Stock: <span className={p.stock < 10 ? 'text-rose-600 font-semibold' : ''}>{p.stock}</span></span>
                  <span>{p._count?.orderItems ?? 0} orders</span>
                </div>
              </div>
            </Card>
          ))}
          {items.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-400 text-sm">No products found.</div>
          )}
        </div>
      )}

      {modal.open && <ProductModal product={modal.product} onClose={() => setModal({ open: false })} onSave={handleSave} />}
    </div>
  );
};

export default Products;
