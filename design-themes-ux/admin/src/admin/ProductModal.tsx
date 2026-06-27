import React, { useState } from 'react';
import { X, Sparkles, Loader2, Tag, Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Btn } from './ui';

const ProductModal: React.FC<{ product?: any; onClose: () => void; onSave: (p: any) => void }> = ({ product, onClose, onSave }) => {
  const [form, setForm] = useState({
    name: product?.name || '',
    category: product?.category || 'Electronics',
    price: product?.price || '',
    stock: product?.stock || '',
    description: product?.description || '',
    seo: product?.seo || '',
    tags: product?.tags || '',
  });
  const [loading, setLoading] = useState('');

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const aiGen = async (type: string) => {
    if (!form.name) { toast.error('Enter a product name first'); return; }
    setLoading(type);
    try {
      const { data, error } = await supabase.functions.invoke('ai-generate', {
        body: { type, productName: form.name, category: form.category },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      const content = (data.content || '').trim();
      if (type === 'description') set('description', content);
      else if (type === 'seo') {
        try { const j = JSON.parse(content.replace(/```json?|```/g, '')); set('seo', `${j.title}\n${j.metaDescription}\nKeywords: ${j.keywords}`); }
        catch { set('seo', content); }
      } else if (type === 'tags') {
        try { const j = JSON.parse(content.replace(/```json?|```/g, '')); set('tags', j.tags.join(', ')); }
        catch { set('tags', content); }
      }
      toast.success(`AI ${type} generated`);
    } catch (e: any) {
      toast.error('AI generation failed: ' + e.message);
    } finally { setLoading(''); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{product ? 'Edit Product' : 'Add Product'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Product Name</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" placeholder="e.g. Wireless Earbuds Pro" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
              <select value={form.category} onChange={(e) => set('category', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
                {['Electronics', 'Apparel', 'Home & Living', 'Beauty', 'Sports', 'Accessories'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Price ($)</label>
              <input type="number" value={form.price} onChange={(e) => set('price', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" placeholder="49.99" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Stock</label>
              <input type="number" value={form.stock} onChange={(e) => set('stock', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" placeholder="120" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
              <button onClick={() => aiGen('description')} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                {loading === 'description' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} AI Generate
              </button>
            </div>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" placeholder="Product description..." />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">SEO Metadata</label>
              <button onClick={() => aiGen('seo')} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                {loading === 'seo' ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} AI SEO
              </button>
            </div>
            <textarea value={form.seo} onChange={(e) => set('seo', e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" placeholder="SEO title, meta description, keywords..." />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tags</label>
              <button onClick={() => aiGen('tags')} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                {loading === 'tags' ? <Loader2 size={13} className="animate-spin" /> : <Tag size={13} />} AI Tags
              </button>
            </div>
            <input value={form.tags} onChange={(e) => set('tags', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" placeholder="comma, separated, tags" />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn onClick={() => { if (!form.name) { toast.error('Name required'); return; } onSave(form); }}>Save Product</Btn>
        </div>
      </div>
    </div>
  );
};

export default ProductModal;
