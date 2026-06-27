import React, { useState } from 'react';
import {
  Plus, Search, Edit, Trash2, Star, GripVertical, Globe, Package,
  MoreVertical, Image as ImageIcon, ExternalLink, Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, PageHeader, Btn, Badge } from './ui';
import {
  useBrands, useCreateBrand, useUpdateBrand, useDeleteBrand,
  useToggleBrandFeatured, useReorderBrands,
} from '@/hooks/useBrands';

// ─── Mock data fallback ──────────────────────────────────────────────────────
const MOCK_BRANDS = [
  { id: '1', name: 'Nike', slug: 'nike', logo: null, isFeatured: true, isActive: true, sortOrder: 0, _count: { products: 48 }, websiteUrl: 'https://nike.com' },
  { id: '2', name: 'Adidas', slug: 'adidas', logo: null, isFeatured: true, isActive: true, sortOrder: 1, _count: { products: 36 }, websiteUrl: null },
  { id: '3', name: 'Puma', slug: 'puma', logo: null, isFeatured: false, isActive: true, sortOrder: 2, _count: { products: 24 }, websiteUrl: null },
  { id: '4', name: 'Levi\'s', slug: 'levis', logo: null, isFeatured: false, isActive: true, sortOrder: 3, _count: { products: 18 }, websiteUrl: null },
  { id: '5', name: 'H&M', slug: 'hm', logo: null, isFeatured: false, isActive: false, sortOrder: 4, _count: { products: 12 }, websiteUrl: null },
];

// ─── Modal ────────────────────────────────────────────────────────────────────
interface BrandModalProps {
  brand?: any;
  onClose: () => void;
  onCreate: (d: any) => void;
  onUpdate: (id: string, d: any) => void;
}
const BrandModal: React.FC<BrandModalProps> = ({ brand, onClose, onCreate, onUpdate }) => {
  const isEdit = !!brand;
  const [form, setForm] = useState({
    name: brand?.name ?? '',
    slug: brand?.slug ?? '',
    description: brand?.description ?? '',
    websiteUrl: brand?.websiteUrl ?? '',
    metaTitle: brand?.metaTitle ?? '',
    metaDescription: brand?.metaDescription ?? '',
    isFeatured: brand?.isFeatured ?? false,
    isActive: brand?.isActive ?? true,
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const submit = () => {
    if (!form.name.trim()) { toast.error('Brand name is required'); return; }
    const payload = { ...form, slug: form.slug || autoSlug(form.name) };
    isEdit ? onUpdate(brand.id, payload) : onCreate(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{isEdit ? 'Edit Brand' : 'Add Brand'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Logo upload area */}
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-400 transition-colors">
            <ImageIcon size={28} className="mx-auto text-slate-400 mb-1" />
            <p className="text-sm text-slate-500">Click to upload brand logo</p>
            <p className="text-xs text-slate-400">200×200px recommended</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Brand Name *</label>
              <input
                value={form.name}
                onChange={(e) => { set('name', e.target.value); if (!form.slug) set('slug', autoSlug(e.target.value)); }}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. Nike"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Slug</label>
              <input
                value={form.slug}
                onChange={(e) => set('slug', e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="auto-generated"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Website URL</label>
              <input
                value={form.websiteUrl}
                onChange={(e) => set('websiteUrl', e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="https://brand.com"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
              placeholder="Brand story, history..."
            />
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2">SEO</p>
            <input
              value={form.metaTitle}
              onChange={(e) => set('metaTitle', e.target.value)}
              className="w-full mb-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="Meta title"
            />
            <textarea
              value={form.metaDescription}
              onChange={(e) => set('metaDescription', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
              placeholder="Meta description"
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} className="w-4 h-4 accent-indigo-600" />
              <span className="text-sm text-slate-700 dark:text-slate-300">Featured on homepage</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="w-4 h-4 accent-indigo-600" />
              <span className="text-sm text-slate-700 dark:text-slate-300">Active</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn onClick={submit}>{isEdit ? 'Save Changes' : 'Create Brand'}</Btn>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const Brands: React.FC = () => {
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; brand?: any }>({ open: false });
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const { data, isLoading } = useBrands({ search: search || undefined });
  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();
  const deleteBrand = useDeleteBrand();
  const toggleFeatured = useToggleBrandFeatured();

  const brands: any[] = data?.items ?? MOCK_BRANDS;
  const filtered = search
    ? brands.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()))
    : brands;

  const featuredCount = brands.filter((b) => b.isFeatured).length;
  const activeCount = brands.filter((b) => b.isActive).length;

  return (
    <div>
      <PageHeader
        title="Brands"
        subtitle="Manage brand pages, logos, and featured brands"
        action={<Btn onClick={() => setModal({ open: true })}><Plus size={16} /> Add Brand</Btn>}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Brands', value: brands.length, icon: Tag, accent: 'bg-indigo-500' },
          { label: 'Active', value: activeCount, icon: Package, accent: 'bg-emerald-500' },
          { label: 'Featured', value: featuredCount, icon: Star, accent: 'bg-amber-500' },
          { label: 'With Website', value: brands.filter((b) => b.websiteUrl).length, icon: Globe, accent: 'bg-blue-500' },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{s.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.accent}`}>
                <s.icon size={18} className="text-white" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        {/* Search */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search brands..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <p className="text-sm text-slate-500">{filtered.length} brands</p>
        </div>

        {/* Brands grid */}
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Tag size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No brands found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((brand) => (
              <div
                key={brand.id}
                className="relative border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <GripVertical size={16} className="text-slate-300 mt-1 cursor-grab flex-shrink-0" />
                  {/* Logo placeholder */}
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center flex-shrink-0 text-slate-400 font-bold text-lg">
                    {brand.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white truncate">{brand.name}</span>
                      {brand.isFeatured && <Star size={12} className="text-amber-500 fill-amber-500 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">/{brand.slug}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-slate-400"><Package size={11} className="inline mr-0.5" />{brand._count?.products ?? 0} products</span>
                      {brand.websiteUrl && (
                        <a href={brand.websiteUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">
                          <ExternalLink size={10} /> Website
                        </a>
                      )}
                    </div>
                    <div className="mt-2">
                      <Badge status={brand.isActive ? 'Active' : 'Inactive'} />
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === brand.id ? null : brand.id)}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {menuOpen === brand.id && (
                      <div className="absolute right-0 top-8 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg w-40 py-1">
                        <button
                          onClick={() => { setModal({ open: true, brand }); setMenuOpen(null); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          <Edit size={14} /> Edit
                        </button>
                        <button
                          onClick={() => { toggleFeatured.mutate(brand.id); setMenuOpen(null); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          <Star size={14} /> {brand.isFeatured ? 'Unfeature' : 'Feature'}
                        </button>
                        <button
                          onClick={() => {
                            deleteBrand.mutate(brand.id);
                            setMenuOpen(null);
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Brand landing page URL hint */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-mono">/brand/{brand.slug}</span>
                  <button
                    onClick={() => toast.info(`Brand page: /brand/${brand.slug}`)}
                    className="text-xs text-indigo-500 hover:underline"
                  >
                    View page →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Featured Section */}
      <Card className="p-5 mt-6">
        <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Star size={16} className="text-amber-500" /> Featured Brands — Homepage Display
        </h3>
        <div className="flex flex-wrap gap-3">
          {brands.filter((b) => b.isFeatured).map((b) => (
            <div key={b.id} className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2">
              <div className="w-7 h-7 rounded bg-amber-200 dark:bg-amber-700 flex items-center justify-center text-amber-700 dark:text-amber-200 font-bold text-sm">{b.name[0]}</div>
              <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">{b.name}</span>
              <button onClick={() => toggleFeatured.mutate(b.id)} className="text-amber-400 hover:text-red-500 ml-1">×</button>
            </div>
          ))}
          {brands.filter((b) => b.isFeatured).length === 0 && (
            <p className="text-sm text-slate-400">No featured brands yet. Use the ⋮ menu on any brand to feature it.</p>
          )}
        </div>
      </Card>

      {/* Click-away for menu */}
      {menuOpen && <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />}

      {modal.open && (
        <BrandModal
          brand={modal.brand}
          onClose={() => setModal({ open: false })}
          onCreate={(d) => createBrand.mutate(d)}
          onUpdate={(id, d) => updateBrand.mutate({ id, data: d })}
        />
      )}
    </div>
  );
};

export default Brands;
