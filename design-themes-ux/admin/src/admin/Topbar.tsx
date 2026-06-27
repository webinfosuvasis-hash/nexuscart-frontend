import React from 'react';
import { Menu, Search, Bell, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { toast } from 'sonner';

const Topbar: React.FC<{ onMenu: () => void; title: string }> = ({ onMenu, title }) => {
  const { theme, setTheme } = useTheme();
  return (
    <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button onClick={onMenu} className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><Menu size={20} /></button>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white capitalize hidden sm:block">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input placeholder="Search anything..." className="pl-9 pr-4 py-2 w-56 rounded-lg bg-slate-100 dark:bg-slate-700 text-sm border-0 focus:ring-2 focus:ring-indigo-500 dark:text-white" />
        </div>
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
          {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        <button onClick={() => toast.info('3 new notifications')} className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
          <Bell size={19} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
        </button>
      </div>
    </header>
  );
};

export default Topbar;
