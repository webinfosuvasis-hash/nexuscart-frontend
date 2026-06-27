import React from 'react';
import type { AppUser as User } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  LayoutDashboard, Package, FolderTree, ShoppingCart, Warehouse, Users,
  Megaphone, Palette, CreditCard, Truck, Award, Search, Store, Sparkles,
  Settings, X, ShoppingBag, LogOut, Globe, Layers, Crown, Building2,
  Tag, FileText, BarChart3, Zap, Grid3X3, LayoutList,
} from 'lucide-react';

export const NAV = [
  {
    group: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    group: 'Catalog',
    items: [
      { id: 'products', label: 'Products', icon: Package },
      { id: 'categories', label: 'Categories', icon: FolderTree },
      { id: 'brands', label: 'Brands', icon: Tag },
      { id: 'collections', label: 'Collections', icon: Layers },
      { id: 'attributes', label: 'Attributes', icon: Zap },
      { id: 'variants', label: 'Variants', icon: Grid3X3 },
      { id: 'inventory', label: 'Inventory', icon: Warehouse },
    ],
  },
  {
    group: 'Sales',
    items: [
      { id: 'orders', label: 'Orders', icon: ShoppingCart },
      { id: 'customers', label: 'Customers', icon: Users },
      { id: 'payments', label: 'Payments', icon: CreditCard },
    ],
  },
  {
    group: 'Growth',
    items: [
      { id: 'marketing', label: 'Marketing', icon: Megaphone },
      { id: 'loyalty', label: 'Loyalty', icon: Award },
      { id: 'search', label: 'Search & Discovery', icon: Search },
      { id: 'seo', label: 'SEO', icon: BarChart3 },
      { id: 'ai', label: 'AI Features', icon: Sparkles },
    ],
  },
  {
    group: 'Storefront',
    items: [
      { id: 'homepage-builder', label: 'Homepage Builder', icon: LayoutList },
      { id: 'themes', label: 'Theme Engine', icon: Palette },
      { id: 'cms', label: 'Page Builder', icon: Layers },
      { id: 'cms-pages', label: 'CMS Pages', icon: FileText },
      { id: 'shipping', label: 'Shipping', icon: Truck },
    ],
  },
  {
    group: 'Operations',
    items: [
      { id: 'marketplace', label: 'Marketplace', icon: Store },
    ],
  },
  {
    group: 'Platform',
    items: [
      { id: 'stores', label: 'Store Management', icon: Building2 },
      { id: 'subscriptions', label: 'Plans & Billing', icon: Crown },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  active: string;
  setActive: (id: string) => void;
  open: boolean;
  close: () => void;
  user: User;
  onSignOut: () => Promise<void>;
}

const Sidebar: React.FC<SidebarProps> = ({ active, setActive, open, close, user, onSignOut }) => {
  const email = user.email || 'staff@nexuscart.com';
  const name = (user.user_metadata?.name as string) || email.split('@')[0];
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    await onSignOut();
    toast.success('Signed out successfully');
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={close} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[#1a1f36] flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg">
              <ShoppingBag size={18} className="text-white" />
            </div>
            <div>
              <span className="text-white font-bold text-base leading-none">NexusCart</span>
              <p className="text-white/40 text-[10px] leading-none mt-0.5">SaaS Platform</p>
            </div>
          </div>
          <button onClick={close} className="lg:hidden text-white/60 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
          {NAV.map((section) => (
            <div key={section.group}>
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/30">{section.group}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <button key={item.id} onClick={() => { setActive(item.id); close(); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                      active === item.id
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                        : 'text-white/60 hover:bg-white/8 hover:text-white'
                    }`}>
                    <item.icon size={17} className="flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate capitalize">{name}</p>
              <p className="text-[11px] text-white/40 truncate">{email}</p>
            </div>
            <button onClick={handleSignOut} title="Sign out"
              className="p-1.5 rounded-lg text-white/40 hover:bg-white/10 hover:text-white transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
