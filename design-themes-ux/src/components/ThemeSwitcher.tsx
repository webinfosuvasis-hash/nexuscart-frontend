import React, { useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { ThemeKey, THEME_META } from '@/data/products';
import { Palette, X } from 'lucide-react';

const themes: { key: ThemeKey; dot: string; bg: string }[] = [
  { key: 'craft', dot: 'bg-amber-700', bg: 'from-amber-700 to-orange-600' },
  { key: 'jewel', dot: 'bg-rose-300', bg: 'from-rose-300 to-slate-400' },
  { key: 'fashion', dot: 'bg-emerald-700', bg: 'from-emerald-700 to-stone-500' },
  { key: 'market', dot: 'bg-blue-600', bg: 'from-blue-600 to-fuchsia-600' },
  { key: 'aurus', dot: 'bg-yellow-700', bg: 'from-yellow-700 to-amber-400' },
];

const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useStore();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-[100]">
      {open && (
        <div className="mb-3 w-64 rounded-2xl bg-white shadow-2xl border border-gray-200 p-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-gray-800">Switch Brand Universe</span>
            <button onClick={() => setOpen(false)}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <div className="space-y-2">
            {themes.map(t => (
              <button
                key={t.key}
                onClick={() => { setTheme(t.key); }}
                className={`w-full flex items-center gap-3 rounded-xl p-2.5 text-left transition ${theme === t.key ? 'ring-2 ring-gray-900 bg-gray-50' : 'hover:bg-gray-50'}`}
              >
                <span className={`w-9 h-9 rounded-lg bg-gradient-to-br ${t.bg}`} />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">{THEME_META[t.key].brand}</span>
                  <span className="block text-xs text-gray-500">{THEME_META[t.key].label}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-full bg-gray-900 text-white px-5 py-3 shadow-2xl hover:bg-gray-800 transition"
      >
        <Palette className="w-5 h-5" />
        <span className="text-sm font-semibold hidden sm:inline">Themes</span>
      </button>
    </div>
  );
};

export default ThemeSwitcher;
