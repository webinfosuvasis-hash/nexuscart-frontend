import React, { useState } from 'react';
import { Sparkles, Loader2, FileText, Search, Tag, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Card, PageHeader, Btn } from './ui';

const AIFeatures: React.FC = () => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [tool, setTool] = useState<'description' | 'seo' | 'tags'>('description');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const tools = [
    { id: 'description', name: 'Product Description', icon: FileText, desc: 'Generate persuasive copy' },
    { id: 'seo', name: 'SEO Generator', icon: Search, desc: 'Meta tags & keywords' },
    { id: 'tags', name: 'Product Tagging', icon: Tag, desc: 'Auto-categorize products' },
  ] as const;

  const generate = async () => {
    if (!name) { toast.error('Enter a product name'); return; }
    setLoading(true); setResult('');
    try {
      const { data, error } = await supabase.functions.invoke('ai-generate', {
        body: { type: tool, productName: name, category },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setResult((data.content || '').replace(/```json?|```/g, '').trim());
      toast.success('Generated successfully');
    } catch (e: any) { toast.error('Failed: ' + e.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <PageHeader title="AI Features" subtitle="Generate content automatically with AI" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {tools.map((t) => (
          <Card key={t.id} className={`p-5 cursor-pointer transition-all ${tool === t.id ? 'ring-2 ring-indigo-500' : 'hover:shadow-md'}`} >
            <button onClick={() => setTool(t.id)} className="text-left w-full">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center mb-3"><t.icon size={20} className="text-white" /></div>
              <p className="font-bold text-slate-900 dark:text-white">{t.name}</p>
              <p className="text-xs text-slate-500 mt-1">{t.desc}</p>
            </button>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4"><Sparkles size={18} className="text-indigo-600" /><h3 className="font-bold text-slate-900 dark:text-white">AI Generator</h3></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name..." className="sm:col-span-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
            {['Electronics', 'Apparel', 'Home & Living', 'Beauty', 'Sports'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <Btn onClick={generate} className="mb-4">{loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Generate {tools.find((t) => t.id === tool)?.name}</Btn>

        {result && (
          <div className="relative p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <button onClick={() => { navigator.clipboard.writeText(result); toast.success('Copied'); }} className="absolute top-3 right-3 p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"><Copy size={15} /></button>
            <pre className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap font-sans pr-8">{result}</pre>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AIFeatures;
