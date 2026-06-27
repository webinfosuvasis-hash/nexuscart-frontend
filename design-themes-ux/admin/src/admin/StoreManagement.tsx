import React, { useState, useMemo } from 'react';
import {
  Store, Search, Plus, CheckCircle2, XCircle, Clock, AlertTriangle,
  MoreHorizontal, Globe, Users, Package, DollarSign, Crown,
  Ban, RefreshCw, ExternalLink, Settings2, Zap, X, Mail, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, PageHeader, Btn, Badge } from './ui';
import type { Store as StoreType, BusinessType, PlanTier } from '@/types';

// ─── Mock Store Data ──────────────────────────────────────────────────────────

const BUSINESS_TYPE_ICONS: Record<BusinessType, string> = {
  fashion: '👗', electronics: '📱', furniture: '🛋️',
  grocery: '🛒', cosmetics: '💄', gifts: '🎁', lifestyle: '✨',
};

const SEED_STORES: StoreType[] = [
  { id: 's1', name: 'Trendy Closet', slug: 'trendy-closet', domain: 'trendy-closet.nexuscart.com', businessType: 'fashion', plan: 'growth', status: 'active', ownerId: 'u1', ownerName: 'Priya Patel', ownerEmail: 'priya@trendycloset.in', revenue: 84200, orders: 621, products: 284, createdAt: '2024-03-15', settings: { primaryColor: '#ec4899', currency: 'INR', language: 'en', timezone: 'Asia/Kolkata', taxEnabled: true, taxRate: 18 } },
  { id: 's2', name: 'TechMart Pro', slug: 'techmart-pro', domain: 'techmart-pro.nexuscart.com', businessType: 'electronics', plan: 'pro', status: 'active', ownerId: 'u2', ownerName: 'Arjun Sharma', ownerEmail: 'arjun@techmart.in', revenue: 312400, orders: 1842, products: 567, createdAt: '2023-11-08', settings: { primaryColor: '#3b82f6', currency: 'INR', language: 'en', timezone: 'Asia/Kolkata', taxEnabled: true, taxRate: 18 } },
  { id: 's3', name: 'Casa Bella', slug: 'casa-bella', domain: 'casa-bella.nexuscart.com', businessType: 'furniture', plan: 'starter', status: 'trial', ownerId: 'u3', ownerName: 'Meera Iyer', ownerEmail: 'meera@casabella.in', revenue: 12800, orders: 48, products: 92, createdAt: '2025-05-28', trialEndsAt: '2025-06-28', settings: { primaryColor: '#92400e', currency: 'INR', language: 'en', timezone: 'Asia/Kolkata', taxEnabled: false, taxRate: 0 } },
  { id: 's4', name: 'GlowUp Beauty', slug: 'glowup-beauty', domain: 'glowup-beauty.nexuscart.com', businessType: 'cosmetics', plan: 'growth', status: 'active', ownerId: 'u4', ownerName: 'Ananya Singh', ownerEmail: 'ananya@glowup.in', revenue: 156800, orders: 2310, products: 198, createdAt: '2024-01-20', settings: { primaryColor: '#db2777', currency: 'INR', language: 'en', timezone: 'Asia/Kolkata', taxEnabled: true, taxRate: 18 } },
  { id: 's5', name: 'FreshBasket', slug: 'freshbasket', domain: 'freshbasket.nexuscart.com', businessType: 'grocery', plan: 'enterprise', status: 'active', ownerId: 'u5', ownerName: 'Rahul Verma', ownerEmail: 'rahul@freshbasket.in', revenue: 842000, orders: 18420, products: 1240, createdAt: '2023-06-12', settings: { primaryColor: '#16a34a', currency: 'INR', language: 'en', timezone: 'Asia/Kolkata', taxEnabled: true, taxRate: 5 } },
  { id: 's6', name: 'Gift Garden', slug: 'gift-garden', domain: 'gift-garden.nexuscart.com', businessType: 'gifts', plan: 'starter', status: 'suspended', ownerId: 'u6', ownerName: 'Deepa Nair', ownerEmail: 'deepa@giftgarden.in', revenue: 8400, orders: 96, products: 145, createdAt: '2024-07-05', settings: { primaryColor: '#f59e0b', currency: 'INR', language: 'en', timezone: 'Asia/Kolkata', taxEnabled: true, taxRate: 18 } },
  { id: 's7', name: 'ZenLife Store', slug: 'zenlife', domain: 'zenlife.nexuscart.com', businessType: 'lifestyle', plan: 'growth', status: 'active', ownerId: 'u7', ownerName: 'Kabir Mehta', ownerEmail: 'kabir@zenlife.in', revenue: 64200, orders: 842, products: 312, createdAt: '2024-02-14', settings: { primaryColor: '#6366f1', currency: 'INR', language: 'en', timezone: 'Asia/Kolkata', taxEnabled: true, taxRate: 18 } },
];

const PLAN_COLORS: Record<PlanTier, string> = {
  starter: 'text-slate-600 bg-slate-100 dark:bg-slate-700',
  growth: 'text-blue-700 bg-blue-50 dark:bg-blue-900/20',
  pro: 'text-violet-700 bg-violet-50 dark:bg-violet-900/20',
  enterprise: 'text-amber-700 bg-amber-50 dark:bg-amber-900/20',
};

const STATUS_META = {
  active: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  trial: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  suspended: { icon: Ban, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' },
  cancelled: { icon: XCircle, color: 'text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
};

// ─── Component ────────────────────────────────────────────────────────────────

const StoreManagement: React.FC = () => {
  const [stores, setStores] = useState(SEED_STORES);
  const [query, setQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<PlanTier | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bizFilter, setBizFilter] = useState<BusinessType | 'all'>('all');
  const [detail, setDetail] = useState<StoreType | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const filtered = useMemo(() => stores.filter((s) =>
    (planFilter === 'all' || s.plan === planFilter) &&
    (statusFilter === 'all' || s.status === statusFilter) &&
    (bizFilter === 'all' || s.businessType === bizFilter) &&
    (!query || s.name.toLowerCase().includes(query.toLowerCase()) || s.ownerEmail.toLowerCase().includes(query.toLowerCase()))
  ), [stores, query, planFilter, statusFilter, bizFilter]);

  const suspendStore = (id: string) => {
    setStores((ss) => ss.map((s) => s.id === id ? { ...s, status: 'suspended' } : s));
    toast.warning('Store suspended');
    setDetail(null);
  };
  const activateStore = (id: string) => {
    setStores((ss) => ss.map((s) => s.id === id ? { ...s, status: 'active' } : s));
    toast.success('Store reactivated');
    setDetail(null);
  };

  const platformStats = {
    totalRevenue: stores.reduce((a, s) => a + s.revenue, 0),
    totalOrders: stores.reduce((a, s) => a + s.orders, 0),
    totalProducts: stores.reduce((a, s) => a + s.products, 0),
    activeStores: stores.filter((s) => s.status === 'active').length,
  };

  return (
    <div>
      <PageHeader title="Store Management" subtitle="Manage all tenant stores across the platform"
        action={
          <Btn onClick={() => setShowCreate(true)}><Plus size={16} /> Create Store</Btn>
        }
      />

      {/* Platform Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Stores', value: platformStats.activeStores, icon: Store, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Total Revenue', value: `₹${(platformStats.totalRevenue / 100000).toFixed(1)}L`, icon: DollarSign, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
          { label: 'Total Orders', value: platformStats.totalOrders.toLocaleString(), icon: Package, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
          { label: 'Total Stores', value: stores.length, icon: Globe, color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
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
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search stores or owner email…"
              className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          </div>
          {[
            { label: 'All Plans', options: ['all', 'starter', 'growth', 'pro', 'enterprise'], value: planFilter, set: setPlanFilter },
            { label: 'All Status', options: ['all', 'active', 'trial', 'suspended', 'cancelled'], value: statusFilter, set: setStatusFilter },
            { label: 'All Types', options: ['all', 'fashion', 'electronics', 'furniture', 'grocery', 'cosmetics', 'gifts', 'lifestyle'], value: bizFilter, set: setBizFilter },
          ].map(({ label, options, value, set }) => (
            <select key={label} value={value} onChange={(e) => set(e.target.value as any)}
              className="px-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white capitalize">
              {options.map((o) => <option key={o} value={o} className="capitalize">{o === 'all' ? label : o}</option>)}
            </select>
          ))}
        </div>
      </Card>

      {/* Store Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Store</th>
                <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Owner</th>
                <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Type</th>
                <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Plan</th>
                <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Revenue</th>
                <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Orders</th>
                <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filtered.map((s) => {
                const statusM = STATUS_META[s.status as keyof typeof STATUS_META];
                const StatusIcon = statusM?.icon || CheckCircle2;
                return (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
                    onClick={() => setDetail(s)}>
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/40 flex items-center justify-center text-lg flex-shrink-0">
                          {BUSINESS_TYPE_ICONS[s.businessType]}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{s.name}</p>
                          <p className="text-xs text-slate-400">{s.domain}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <p className="font-medium text-slate-700 dark:text-slate-200">{s.ownerName}</p>
                      <p className="text-xs text-slate-400">{s.ownerEmail}</p>
                    </td>
                    <td className="p-3">
                      <span className="text-xs font-semibold capitalize text-slate-600 dark:text-slate-300">{s.businessType}</span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${PLAN_COLORS[s.plan]}`}>
                        {s.plan}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white">
                      ₹{(s.revenue / 1000).toFixed(1)}K
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{s.orders.toLocaleString()}</td>
                    <td className="p-3">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${statusM?.bg} ${statusM?.color}`}>
                        <StatusIcon size={11} />
                        <span className="capitalize">{s.status}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setOpenMenu(openMenu === s.id ? null : s.id)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                          <MoreHorizontal size={16} />
                        </button>
                        {openMenu === s.id && (
                          <div className="absolute right-0 top-8 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 w-40">
                            {[
                              { label: 'View Details', icon: Settings2, action: () => { setDetail(s); setOpenMenu(null); } },
                              { label: 'Impersonate', icon: Users, action: () => { toast.success('Switched to store: ' + s.name); setOpenMenu(null); } },
                              { label: 'Send Email', icon: Mail, action: () => { toast.success('Email dialog opened'); setOpenMenu(null); } },
                              s.status === 'active'
                                ? { label: 'Suspend', icon: Ban, action: () => { suspendStore(s.id); setOpenMenu(null); } }
                                : { label: 'Activate', icon: RefreshCw, action: () => { activateStore(s.id); setOpenMenu(null); } },
                            ].map(({ label, icon: Icon, action }) => (
                              <button key={label} onClick={action}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                <Icon size={14} /> {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 text-sm text-slate-500">
          Showing {filtered.length} of {stores.length} stores
        </div>
      </Card>

      {/* Store Detail Drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" onClick={() => setDetail(null)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-5 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-xl">
                  {BUSINESS_TYPE_ICONS[detail.businessType]}
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white">{detail.name}</h2>
                  <p className="text-xs text-slate-400">{detail.domain}</p>
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Status & Plan */}
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-bold capitalize ${PLAN_COLORS[detail.plan]}`}>
                  <Crown size={12} className="inline mr-1" />{detail.plan}
                </span>
                <Badge status={detail.status} />
                {detail.trialEndsAt && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                    <Clock size={11} className="inline mr-1" />Trial ends {detail.trialEndsAt}
                  </span>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Revenue', value: `₹${(detail.revenue / 1000).toFixed(1)}K`, icon: DollarSign },
                  { label: 'Orders', value: detail.orders.toLocaleString(), icon: Package },
                  { label: 'Products', value: detail.products.toLocaleString(), icon: Store },
                ].map((s) => (
                  <div key={s.label} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 text-center">
                    <s.icon size={16} className="text-indigo-500 mx-auto mb-1" />
                    <p className="font-bold text-slate-900 dark:text-white">{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Owner */}
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Store Owner</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-sm">
                    {detail.ownerName.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{detail.ownerName}</p>
                    <p className="text-xs text-slate-400">{detail.ownerEmail}</p>
                  </div>
                </div>
              </div>

              {/* Store Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Business Type', value: detail.businessType, },
                  { label: 'Currency', value: detail.settings.currency },
                  { label: 'Language', value: detail.settings.language.toUpperCase() },
                  { label: 'Created', value: detail.createdAt },
                  { label: 'Tax Rate', value: `${detail.settings.taxRate}%` },
                  { label: 'Tax Enabled', value: detail.settings.taxEnabled ? 'Yes' : 'No' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{value}</p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                <Btn variant="outline" className="justify-center" onClick={() => toast.success('Opening store admin: ' + detail.name)}>
                  <ExternalLink size={14} /> Open Store Admin
                </Btn>
                <Btn variant="outline" className="justify-center" onClick={() => toast.success('Email sent to ' + detail.ownerEmail)}>
                  <Mail size={14} /> Email Owner
                </Btn>
                {detail.status === 'active' ? (
                  <Btn variant="outline" className="justify-center col-span-2 !text-rose-600 !border-rose-300 hover:!bg-rose-50" onClick={() => suspendStore(detail.id)}>
                    <Ban size={14} /> Suspend Store
                  </Btn>
                ) : (
                  <Btn className="justify-center col-span-2" onClick={() => activateStore(detail.id)}>
                    <RefreshCw size={14} /> Reactivate Store
                  </Btn>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Store Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create New Store</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {[
                { label: 'Store Name', placeholder: 'e.g. My Fashion Store', type: 'text' },
                { label: 'Store URL Slug', placeholder: 'my-fashion-store', type: 'text' },
                { label: 'Owner Email', placeholder: 'owner@example.com', type: 'email' },
              ].map(({ label, placeholder, type }) => (
                <div key={label}>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1">{label}</label>
                  <input type={type} placeholder={placeholder}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1">Business Type</label>
                  <select className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
                    {['fashion', 'electronics', 'furniture', 'grocery', 'cosmetics', 'gifts', 'lifestyle'].map((t) => (
                      <option key={t} className="capitalize">{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1">Plan</label>
                  <select className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
                    {['starter', 'growth', 'pro', 'enterprise'].map((p) => (
                      <option key={p} className="capitalize">{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Btn variant="outline" className="flex-1 justify-center" onClick={() => setShowCreate(false)}>Cancel</Btn>
                <Btn className="flex-1 justify-center" onClick={() => { toast.success('Store created successfully!'); setShowCreate(false); }}>
                  Create Store
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreManagement;
