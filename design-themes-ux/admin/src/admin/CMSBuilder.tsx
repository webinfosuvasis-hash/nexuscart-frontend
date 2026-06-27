import React, { useState, useRef } from 'react';
import {
  Eye, Save, Trash2, Plus, Smartphone, Monitor, Tablet,
  GripVertical, Settings2, ChevronDown, ChevronUp, Copy,
  Image, Grid3x3, ShoppingBag, Quote, Mail, Megaphone, Video,
  HelpCircle, Star, LayoutDashboard, Box, Tag, FileText,
  Type, Clock, Layers, ArrowUp, ArrowDown, Check, Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, PageHeader, Btn } from './ui';
import type { SectionType, CMSPage, PageSection } from '@/types';

// ─── Section Definitions ──────────────────────────────────────────────────────

const SECTION_LIBRARY: Array<{
  id: SectionType;
  name: string;
  desc: string;
  icon: typeof Image;
  category: string;
  defaultSettings: Record<string, any>;
}> = [
  // Media
  { id: 'hero', name: 'Hero Banner', desc: 'Full-width hero with headline and CTA buttons', icon: Image, category: 'Media', defaultSettings: { title: 'Welcome to Our Store', subtitle: 'Discover amazing products', cta: 'Shop Now', ctaLink: '/collections', overlay: 0.4 } },
  { id: 'banner', name: 'Promo Banner', desc: 'Slim promotional strip with countdown', icon: Megaphone, category: 'Media', defaultSettings: { text: 'Free shipping on orders over $50!', link: '/collections', bg: '#4f46e5' } },
  { id: 'video', name: 'Video Block', desc: 'Embed YouTube or Vimeo video', icon: Video, category: 'Media', defaultSettings: { url: '', autoplay: false, muted: true, poster: '' } },
  { id: 'image_gallery', name: 'Image Gallery', desc: 'Masonry or grid image gallery', icon: Grid3x3, category: 'Media', defaultSettings: { layout: 'masonry', columns: 3, gap: 8 } },
  { id: 'countdown', name: 'Countdown Timer', desc: 'Flash sale countdown', icon: Clock, category: 'Media', defaultSettings: { endsAt: '', title: 'Sale Ends In', cta: 'Shop Now' } },
  // Products
  { id: 'product_grid', name: 'Product Grid', desc: 'Show products from collection or featured', icon: ShoppingBag, category: 'Products', defaultSettings: { title: 'Featured Products', source: 'featured', limit: 8, columns: 4 } },
  { id: 'collection_grid', name: 'Collection Grid', desc: 'Display multiple collection tiles', icon: Layers, category: 'Products', defaultSettings: { title: 'Shop by Collection', style: 'grid', columns: 3 } },
  { id: 'category_grid', name: 'Category Grid', desc: 'Visual category navigation', icon: LayoutDashboard, category: 'Products', defaultSettings: { title: 'Shop by Category', style: 'circle', showCount: true } },
  // Content
  { id: 'rich_text', name: 'Rich Text', desc: 'Heading, paragraph, and buttons', icon: Type, category: 'Content', defaultSettings: { heading: '', content: '', alignment: 'center' } },
  { id: 'feature_grid', name: 'Feature Grid', desc: '3–6 column feature highlights', icon: Box, category: 'Content', defaultSettings: { columns: 3, items: [] } },
  { id: 'testimonials', name: 'Testimonials', desc: 'Customer review slider', icon: Quote, category: 'Content', defaultSettings: { title: 'What Our Customers Say', style: 'carousel' } },
  { id: 'faq', name: 'FAQ Accordion', desc: 'Frequently asked questions', icon: HelpCircle, category: 'Content', defaultSettings: { title: 'Frequently Asked Questions', items: [] } },
  { id: 'blog', name: 'Blog Posts', desc: 'Latest blog posts grid', icon: FileText, category: 'Content', defaultSettings: { title: 'From Our Blog', limit: 3, columns: 3 } },
  // Social
  { id: 'newsletter', name: 'Newsletter', desc: 'Email subscription form', icon: Mail, category: 'Social', defaultSettings: { title: 'Stay in the Loop', subtitle: 'Subscribe for exclusive deals', placeholder: 'Enter your email' } },
  { id: 'brands', name: 'Brand Logos', desc: 'Partner and brand logo strip', icon: Tag, category: 'Social', defaultSettings: { title: 'As Featured In', logos: [] } },
  { id: 'promo_bar', name: 'Promo Strip', desc: 'Top sticky announcement bar', icon: Star, category: 'Social', defaultSettings: { messages: ['Free shipping over $50', 'Use code WELCOME10 for 10% off'], speed: 30 } },
];

const CATEGORIES = ['All', ...Array.from(new Set(SECTION_LIBRARY.map((s) => s.category)))];

// ─── Page List ────────────────────────────────────────────────────────────────

const PAGES = [
  { id: 'home', label: 'Homepage', slug: '/' },
  { id: 'collection', label: 'Collection Page', slug: '/collections' },
  { id: 'landing', label: 'Landing Page', slug: '/landing/sale' },
  { id: 'about', label: 'About Us', slug: '/about' },
  { id: 'contact', label: 'Contact', slug: '/contact' },
];

// ─── Section Block Component ──────────────────────────────────────────────────

interface SectionBlockProps {
  section: PageSection & { icon: typeof Image; category: string };
  idx: number;
  total: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  expanded: boolean;
  onToggle: () => void;
}

const SectionBlock: React.FC<SectionBlockProps> = ({
  section, idx, total, onRemove, onMoveUp, onMoveDown, onDuplicate, expanded, onToggle,
}) => {
  const Icon = section.icon || Box;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden group">
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={onToggle}>
        <GripVertical size={16} className="text-slate-300 cursor-grab flex-shrink-0" />
        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{section.name}</p>
          <p className="text-xs text-slate-400">{section.settings?.title || (section.type ?? section.name ?? '').replace(/_/g, ' ')}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={idx === 0}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-400">
            <ArrowUp size={13} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={idx === total - 1}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-400">
            <ArrowDown size={13} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
            <Copy size={13} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500">
            <Trash2 size={13} />
          </button>
        </div>
        {expanded ? <ChevronUp size={15} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={15} className="text-slate-400 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-700 p-3 space-y-2.5 bg-slate-50 dark:bg-slate-900/50">
          {Object.entries(section.settings || {}).map(([key, val]) => (
            <div key={key}>
              <label className="text-xs font-semibold text-slate-500 capitalize block mb-1">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </label>
              {typeof val === 'boolean' ? (
                <input type="checkbox" defaultChecked={val} className="rounded" />
              ) : typeof val === 'number' ? (
                <input type="number" defaultValue={val} className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
              ) : (
                <input type="text" defaultValue={val as string} className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const CMSBuilder: React.FC = () => {
  const [activePage, setActivePage] = useState('home');
  const [canvas, setCanvas] = useState<any[]>([
    { ...SECTION_LIBRARY[0], type: SECTION_LIBRARY[0].id, settings: { ...SECTION_LIBRARY[0].defaultSettings }, uid: 1, order: 0, isVisible: true, id: 'sec-1' },
    { ...SECTION_LIBRARY[5], type: SECTION_LIBRARY[5].id, settings: { ...SECTION_LIBRARY[5].defaultSettings }, uid: 2, order: 1, isVisible: true, id: 'sec-2' },
    { ...SECTION_LIBRARY[10], type: SECTION_LIBRARY[10].id, settings: { ...SECTION_LIBRARY[10].defaultSettings }, uid: 3, order: 2, isVisible: true, id: 'sec-3' },
  ]);
  const [view, setView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [libCat, setLibCat] = useState('All');
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [libSearch, setLibSearch] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragItem = useRef<any>(null);

  const filteredLib = SECTION_LIBRARY.filter((s) =>
    (libCat === 'All' || s.category === libCat) &&
    (!libSearch || s.name.toLowerCase().includes(libSearch.toLowerCase()))
  );

  const addSection = (def: typeof SECTION_LIBRARY[0]) => {
    const uid = Date.now();
    setCanvas((c) => [...c, {
      ...def,
      type: def.id,
      uid,
      order: c.length,
      isVisible: true,
      id: `sec-${uid}`,
      settings: { ...def.defaultSettings },
    }]);
    toast.success(`${def.name} added to page`);
  };

  const removeSection = (uid: number) => setCanvas((c) => c.filter((b) => b.uid !== uid));
  const duplicateSection = (uid: number) => {
    const s = canvas.find((b) => b.uid === uid);
    if (!s) return;
    const newUid = Date.now();
    setCanvas((c) => {
      const idx = c.findIndex((b) => b.uid === uid);
      const copy = { ...s, uid: newUid, id: `sec-${newUid}`, settings: { ...s.settings } };
      return [...c.slice(0, idx + 1), copy, ...c.slice(idx + 1)];
    });
  };
  const moveUp = (uid: number) => {
    setCanvas((c) => {
      const i = c.findIndex((b) => b.uid === uid);
      if (i === 0) return c;
      const n = [...c];
      [n[i - 1], n[i]] = [n[i], n[i - 1]];
      return n;
    });
  };
  const moveDown = (uid: number) => {
    setCanvas((c) => {
      const i = c.findIndex((b) => b.uid === uid);
      if (i === c.length - 1) return c;
      const n = [...c];
      [n[i], n[i + 1]] = [n[i + 1], n[i]];
      return n;
    });
  };
  const toggleExpanded = (uid: number) =>
    setExpandedIds((ids) => ids.includes(uid) ? ids.filter((x) => x !== uid) : [...ids, uid]);

  const onDragStartLib = (e: React.DragEvent, def: typeof SECTION_LIBRARY[0]) => {
    e.dataTransfer.setData('section', JSON.stringify(def));
    dragItem.current = def;
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    try {
      const def = JSON.parse(e.dataTransfer.getData('section'));
      addSection(def);
    } catch { /* no-op */ }
  };

  const previewWidth = view === 'desktop' ? 'w-full' : view === 'tablet' ? 'max-w-[768px]' : 'max-w-[390px]';

  return (
    <div>
      <PageHeader title="Page Builder" subtitle="Drag sections to build and customize your store pages"
        action={
          <div className="flex gap-2">
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
              {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([id, Icon]) => (
                <button key={id} onClick={() => setView(id)}
                  className={`p-1.5 rounded ${view === id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}>
                  <Icon size={15} />
                </button>
              ))}
            </div>
            <Btn variant="outline" onClick={() => toast.info('Live preview opened in new tab')}><Eye size={16} /> Preview</Btn>
            <Btn onClick={() => toast.success('Page published successfully!')}><Save size={16} /> Publish</Btn>
          </div>
        }
      />

      {/* Page Selector */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {PAGES.map((p) => (
          <button key={p.id} onClick={() => setActivePage(p.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activePage === p.id ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400'}`}>
            <Globe size={13} /> {p.label}
          </button>
        ))}
        <button onClick={() => toast.info('Create new page dialog')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-indigo-400 hover:text-indigo-600">
          <Plus size={13} /> New Page
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sections Library */}
        <div className="space-y-3">
          <Card className="p-3">
            <h3 className="font-bold text-slate-900 dark:text-white mb-2 text-sm flex items-center gap-2">
              <Layers size={15} className="text-indigo-600" /> Sections Library
            </h3>
            <input value={libSearch} onChange={(e) => setLibSearch(e.target.value)}
              placeholder="Search sections…"
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white mb-2" />
            <div className="flex gap-1 flex-wrap mb-2">
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setLibCat(c)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${libCat === c ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                  {c}
                </button>
              ))}
            </div>
            <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
              {filteredLib.map((def) => {
                const Icon = def.icon;
                return (
                  <div key={def.id} draggable onDragStart={(e) => onDragStartLib(e, def)}
                    onClick={() => addSection(def)}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 cursor-grab hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 active:cursor-grabbing transition-colors group">
                    <Icon size={15} className="text-indigo-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{def.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{def.desc}</p>
                    </div>
                    <Plus size={13} className="ml-auto text-slate-300 group-hover:text-indigo-400 flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Canvas */}
        <div className="lg:col-span-3 space-y-4">
          {/* Canvas Header */}
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{canvas.length} sections on this page</span>
            <button onClick={() => { setCanvas([]); toast.success('Page cleared'); }}
              className="text-rose-500 hover:underline text-xs font-semibold">
              Clear All
            </button>
          </div>

          {/* Drop Zone */}
          <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragLeave={() => setIsDraggingOver(false)}
            className={`rounded-2xl border-2 border-dashed p-4 min-h-[200px] transition-colors ${isDraggingOver ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10' : 'border-slate-200 dark:border-slate-700'}`}>
            {canvas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <Layers size={36} className="mb-2 opacity-30" />
                <p className="font-semibold">Drag sections here or click from library</p>
                <p className="text-sm mt-1 opacity-70">Build your page by adding sections</p>
              </div>
            ) : (
              <div className="space-y-2">
                {canvas.map((s, idx) => (
                  <SectionBlock
                    key={s.uid}
                    section={s}
                    idx={idx}
                    total={canvas.length}
                    onRemove={() => removeSection(s.uid)}
                    onMoveUp={() => moveUp(s.uid)}
                    onMoveDown={() => moveDown(s.uid)}
                    onDuplicate={() => duplicateSection(s.uid)}
                    expanded={expandedIds.includes(s.uid)}
                    onToggle={() => toggleExpanded(s.uid)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Page Preview (simplified) */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Page Preview</h3>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Check size={12} className="text-emerald-500" /> Live on {PAGES.find((p) => p.id === activePage)?.slug}
              </div>
            </div>
            <div className={`bg-slate-50 dark:bg-slate-900 p-6 flex justify-center`}>
              <div className={`${previewWidth} transition-all bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm`}>
                {/* Mini header */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-800">
                  <div className="flex items-center gap-1.5">
                    <ShoppingBag size={14} className="text-indigo-400" />
                    <span className="text-white text-xs font-bold">nexuscart.com</span>
                  </div>
                  <div className="flex gap-2 text-[10px] text-slate-400">
                    <span>Home</span><span>Shop</span><span>About</span>
                  </div>
                </div>
                {canvas.map((s) => {
                  const Icon = s.icon || Box;
                  return (
                    <div key={s.uid} className="border-b border-dashed border-slate-100 dark:border-slate-700 px-4 py-3 flex items-center gap-2">
                      <Icon size={12} className="text-indigo-400 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="h-2 bg-slate-200 dark:bg-slate-600 rounded w-24 mb-1" />
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded w-40" />
                      </div>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">{s.name}</span>
                    </div>
                  );
                })}
                {canvas.length === 0 && (
                  <div className="py-8 text-center text-slate-400 text-xs">Empty page — add sections</div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CMSBuilder;
