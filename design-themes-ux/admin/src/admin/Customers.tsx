import React, { useState } from 'react';
import {
  Search, Mail, MessageSquare, Users as UsersIcon, X, ShoppingCart,
  Star, MapPin, Phone, Calendar, Tag, TrendingUp, Download,
  Crown, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, PageHeader, Btn, Badge } from './ui';
import { useCustomers, useCustomerSegmentStats, useAwardPoints } from '@/hooks/useCustomers';

const PAGE_SIZE = 20;

const SEGMENT_META: Record<string, { color: string; bg: string; icon: typeof Crown; label: string }> = {
  VIP:     { color: 'text-violet-700', bg: 'bg-violet-50 dark:bg-violet-900/20', icon: Crown, label: 'VIP' },
  REGULAR: { color: 'text-blue-700',   bg: 'bg-blue-50 dark:bg-blue-900/20',     icon: UsersIcon, label: 'Regular' },
  NEW:     { color: 'text-cyan-700',   bg: 'bg-cyan-50 dark:bg-cyan-900/20',     icon: Star, label: 'New' },
  AT_RISK: { color: 'text-rose-700',   bg: 'bg-rose-50 dark:bg-rose-900/20',     icon: TrendingUp, label: 'At Risk' },
};

const Customers: React.FC = () => {
  const [query, setQuery] = useState('');
  const [seg, setSeg] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [pointsInput, setPointsInput] = useState('');

  const { data, isLoading } = useCustomers({ page, limit: PAGE_SIZE, search: query || undefined, segment: seg || undefined });
  const { data: segStats } = useCustomerSegmentStats();
  const awardPoints = useAwardPoints();

  const items: any[] = data?.items ?? [];
  const pagination = data?.pagination;

  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const toggleAll = () => setSelected(selected.length === items.length ? [] : items.map((c) => c.id));

  const initials = (name: string) => name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const getSegCount = (segment: string) => {
    if (!segStats) return '—';
    const found = segStats.find((s: any) => s.segment === segment);
    return found?.count ?? 0;
  };

  const handleAwardPoints = () => {
    if (!detail || !pointsInput) return;
    awardPoints.mutate({ id: detail.id, points: Number(pointsInput), reason: 'Manual award by admin' }, {
      onSuccess: () => { setPointsInput(''); toast.success('Points awarded'); },
    });
  };

  const fmtSpent = (v: any) => `$${Number(v).toLocaleString()}`;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div>
      <PageHeader title="Customers" subtitle={`${pagination?.total ?? '…'} registered customers`}
        action={
          <div className="flex gap-2">
            <Btn variant="outline" onClick={() => toast.success('Customer list exported')}><Download size={16} /> Export</Btn>
          </div>
        }
      />

      {/* Segment Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {Object.entries(SEGMENT_META).map(([key, meta]) => (
          <Card key={key} className={`p-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition-all ${seg === key ? 'ring-2 ring-indigo-500' : ''}`}
            onClick={() => { setSeg(seg === key ? '' : key); setPage(1); }}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${meta.bg}`}>
              <meta.icon size={18} className={meta.color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{getSegCount(key)}</p>
              <p className="text-xs text-slate-500">{meta.label} Customers</p>
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
              placeholder="Search by name, email, or phone…"
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm" />
          </div>
          <select value={seg} onChange={(e) => { setSeg(e.target.value); setPage(1); }}
            className="px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm">
            <option value="">All Segments</option>
            {Object.entries(SEGMENT_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
          </select>
        </div>

        {selected.length > 0 && (
          <div className="flex items-center gap-3 mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-700">
            <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{selected.length} selected</span>
            <div className="h-4 w-px bg-indigo-200" />
            <button onClick={() => { toast.success(`Email campaign sent to ${selected.length} customers`); setSelected([]); }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline">
              <Mail size={13} /> Email Campaign
            </button>
            <button onClick={() => { toast.success(`SMS sent to ${selected.length} customers`); setSelected([]); }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline">
              <MessageSquare size={13} /> SMS
            </button>
            <button onClick={() => { toast.success('Segment tag applied'); setSelected([]); }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline">
              <Tag size={13} /> Apply Tag
            </button>
          </div>
        )}
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading customers…
        </div>
      )}

      {!isLoading && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <th className="p-3 w-10"><input type="checkbox" checked={selected.length === items.length && items.length > 0} onChange={toggleAll} className="rounded" /></th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Customer</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Segment</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Orders</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Total Spent</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Joined</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {items.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors" onClick={() => setDetail(c)}>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} className="rounded" />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                          {initials(c.name)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{c.name}</p>
                          <p className="text-xs text-slate-400">{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3"><Badge status={c.segment} /></td>
                    <td className="p-3">
                      <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                        <ShoppingCart size={12} /> {c.totalOrders ?? c._count?.orders ?? 0}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white">{fmtSpent(c.totalSpent)}</td>
                    <td className="p-3 text-slate-500 text-xs">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} /> {fmtDate(c.createdAt)}
                      </span>
                    </td>
                    <td className="p-3"><Badge status={c.isActive ? 'Active' : 'Inactive'} /></td>
                    <td className="p-3 text-right text-xs font-semibold text-indigo-600 dark:text-indigo-400">View →</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-400 text-sm">No customers found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {pagination && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
              <p className="text-sm text-slate-500">{pagination.total} customers</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-40">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-slate-600 dark:text-slate-300 px-2">Page {pagination.page} / {pagination.totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-40">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Customer Detail Drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" onClick={() => setDetail(null)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-5 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Customer Profile</h2>
              <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Profile Header */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                  {initials(detail.name)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{detail.name}</h3>
                  <p className="text-sm text-slate-500">{detail.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge status={detail.segment} />
                    <Badge status={detail.isActive ? 'Active' : 'Inactive'} />
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Orders', value: detail.totalOrders ?? 0, icon: ShoppingCart, color: 'text-indigo-600' },
                  { label: 'Total Spent', value: fmtSpent(detail.totalSpent), icon: TrendingUp, color: 'text-emerald-600' },
                  { label: 'Avg Order', value: detail.totalOrders > 0 ? `$${(Number(detail.totalSpent) / detail.totalOrders).toFixed(0)}` : '—', icon: Star, color: 'text-amber-500' },
                ].map((s) => (
                  <div key={s.label} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 text-center">
                    <s.icon size={16} className={`${s.color} mx-auto mb-1`} />
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Contact Info */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact Info</p>
                {[
                  { icon: Mail, text: detail.email },
                  ...(detail.phone ? [{ icon: Phone, text: detail.phone }] : []),
                  { icon: Calendar, text: `Joined ${fmtDate(detail.createdAt)}` },
                  ...(detail.lastOrderAt ? [{ icon: ShoppingCart, text: `Last order ${fmtDate(detail.lastOrderAt)}` }] : []),
                ].map((r, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                    <r.icon size={15} className="text-slate-400 flex-shrink-0" />
                    {r.text}
                  </div>
                ))}
              </div>

              {/* Loyalty Points */}
              {detail.loyalty && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Crown size={16} className="text-amber-500" />
                      <span className="font-bold text-amber-800 dark:text-amber-300 text-sm">{detail.loyalty.tier ?? 'Member'}</span>
                    </div>
                    <span className="text-xs font-bold text-amber-600">{detail.loyalty.points ?? 0} pts</span>
                  </div>
                </div>
              )}

              {/* Recent Orders */}
              {detail.orders?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Recent Orders</p>
                  <div className="space-y-2">
                    {detail.orders.map((o: any) => (
                      <div key={o.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                        <div>
                          <p className="text-sm font-semibold text-indigo-600">{o.orderNumber}</p>
                          <p className="text-xs text-slate-400">{fmtDate(o.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">${Number(o.total).toFixed(2)}</p>
                          <Badge status={o.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Award Loyalty Points */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Award Points</p>
                <div className="flex gap-2">
                  <input type="number" value={pointsInput} onChange={(e) => setPointsInput(e.target.value)}
                    placeholder="Points to award"
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                  <Btn onClick={handleAwardPoints} className="flex-shrink-0">
                    <Crown size={14} /> Award
                  </Btn>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Btn variant="outline" className="flex-1 justify-center" onClick={() => toast.success('Email sent to ' + detail.email)}>
                  <Mail size={15} /> Email
                </Btn>
                <Btn variant="outline" className="flex-1 justify-center" onClick={() => toast.success('SMS sent')}>
                  <MessageSquare size={15} /> SMS
                </Btn>
                <Btn variant="outline" className="flex-1 justify-center" onClick={() => toast.info('Opening address editor')}>
                  <MapPin size={15} /> Address
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
