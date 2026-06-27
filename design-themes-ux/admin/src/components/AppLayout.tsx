import React, { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Login from '@/admin/Login';
import ThemeEditor from '@/admin/ThemeEditor';
import Sidebar, { NAV } from '@/admin/Sidebar';
import Topbar from '@/admin/Topbar';
import Dashboard from '@/admin/Dashboard';
import Products from '@/admin/Products';
import Categories from '@/admin/Categories';
import Inventory from '@/admin/Inventory';
import Orders from '@/admin/Orders';
import Customers from '@/admin/Customers';
import Marketing from '@/admin/Marketing';
import CMSBuilder from '@/admin/CMSBuilder';
import Settings from '@/admin/Settings';
import AIFeatures from '@/admin/AIFeatures';
import ThemeEngine from '@/admin/ThemeEngine';
import StoreManagement from '@/admin/StoreManagement';
import Subscriptions from '@/admin/Subscriptions';
import SearchDiscovery from '@/admin/SearchDiscovery';
import Brands from '@/admin/Brands';
import Collections from '@/admin/Collections';
import Attributes from '@/admin/Attributes';
import Variants from '@/admin/Variants';
import { Payments, Shipping, Loyalty, SEO, Marketplace } from '@/admin/Modules';
import HomepageBuilder from '@/admin/HomepageBuilder';

// ─── CMS Pages Placeholder ─────────────────────────────────────────────────────

const CMSPages: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-64 text-slate-400">
    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
      <span className="text-3xl">📄</span>
    </div>
    <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-1">CMS Pages</h3>
    <p className="text-sm">Manage static pages (About, Contact, Privacy, Terms)</p>
  </div>
);

const AppLayout: React.FC = () => {
  const { user, loading, signOut } = useAuth();
  const [active, setActive]         = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editorOpen, setEditorOpen]   = useState(false);

  const openEditor  = useCallback(() => setEditorOpen(true),  []);
  const closeEditor = useCallback(() => setEditorOpen(false), []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1f36]">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-indigo-400 mx-auto mb-3" />
          <p className="text-white/50 text-sm">Loading NexusCart…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  const allItems = NAV.flatMap((s) => s.items);
  const title = allItems.find((i) => i.id === active)?.label || 'Dashboard';

  const render = () => {
    switch (active) {
      // Overview
      case 'dashboard': return <Dashboard />;
      // Catalog
      case 'products': return <Products />;
      case 'categories': return <Categories />;
      case 'brands': return <Brands />;
      case 'collections': return <Collections />;
      case 'attributes': return <Attributes />;
      case 'variants': return <Variants />;
      case 'inventory': return <Inventory />;
      // Sales
      case 'orders': return <Orders />;
      case 'customers': return <Customers />;
      case 'payments': return <Payments />;
      // Growth
      case 'marketing': return <Marketing />;
      case 'loyalty': return <Loyalty />;
      case 'search': return <SearchDiscovery />;
      case 'seo': return <SEO />;
      case 'ai': return <AIFeatures />;
      // Storefront
      case 'homepage-builder': return <HomepageBuilder />;
      case 'themes': return <ThemeEngine onOpenEditor={openEditor} />;
      case 'cms': return <CMSBuilder />;
      case 'cms-pages': return <CMSPages />;
      case 'shipping': return <Shipping />;
      // Operations
      case 'marketplace': return <Marketplace />;
      // Platform
      case 'stores': return <StoreManagement />;
      case 'subscriptions': return <Subscriptions />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <>
      {/* Full-screen Theme Editor — renders on top of everything, hides admin UI */}
      {editorOpen && (
        <ThemeEditor onClose={closeEditor} />
      )}

      {/* Normal admin layout — hidden (via pointer-events/display) while editor is open */}
      <div className={`flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden ${editorOpen ? 'hidden' : ''}`}>
        <Sidebar
          active={active}
          setActive={setActive}
          open={sidebarOpen}
          close={() => setSidebarOpen(false)}
          user={user}
          onSignOut={signOut}
        />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Topbar onMenu={() => setSidebarOpen(true)} title={title} />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {render()}
          </main>
        </div>
      </div>
    </>
  );
};

export default AppLayout;
