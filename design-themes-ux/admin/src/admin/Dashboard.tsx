import React, { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  DollarSign, ShoppingCart, Users, TrendingUp, PackageX,
  Download, ArrowUpRight, RefreshCw, Activity,
  Clock, CheckCircle2, AlertTriangle, XCircle, Package, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, StatCard, PageHeader, Btn } from './ui';
import { lowStock } from './data';
import { useDashboardSummary, useRevenueTrend, useTopProducts, useTrafficSources } from '@/hooks/useAnalytics';
import { useOrderStats } from '@/hooks/useOrders';

const PERIODS = ['7d', '30d', '90d', '1y'] as const;
type Period = typeof PERIODS[number];

const periodLabels: Record<Period, string> = {
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
  '1y': 'This Year',
};

const TRAFFIC_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ef4444'];

const recentActivity = [
  { id: 1, icon: ShoppingCart, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20', text: 'New order #ORD-9031 from Aarav Sharma', time: '2 min ago', amount: '$142.00' },
  { id: 2, icon: AlertTriangle, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20', text: 'Low stock alert: Cotton Hoodie (8 left)', time: '14 min ago', amount: null },
  { id: 3, icon: CheckCircle2, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20', text: 'Order #ORD-9028 delivered to Emma Williams', time: '1 hr ago', amount: '$89.50' },
  { id: 4, icon: Users, color: 'text-violet-500 bg-violet-50 dark:bg-violet-900/20', text: 'New customer: Rohan Mehta signed up', time: '2 hr ago', amount: null },
  { id: 5, icon: XCircle, color: 'text-rose-500 bg-rose-50 dark:bg-rose-900/20', text: 'Refund processed for order #ORD-9015', time: '3 hr ago', amount: '-$54.00' },
  { id: 6, icon: Package, color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-900/20', text: 'Product "Fitness Tracker" published', time: '5 hr ago', amount: null },
];

const fmtCurrency = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n.toFixed(0)}`;

const fmtCount = (n: number) =>
  n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

const Dashboard: React.FC = () => {
  const [period, setPeriod] = useState<Period>('30d');
  const [refreshing, setRefreshing] = useState(false);

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useDashboardSummary(period);
  const { data: revenueTrend, refetch: refetchRevenue } = useRevenueTrend(period);
  const { data: topProductsRaw, refetch: refetchTop } = useTopProducts(5);
  const { data: trafficRaw, refetch: refetchTraffic } = useTrafficSources(period);
  const { data: orderStats, refetch: refetchOrders } = useOrderStats();

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchSummary(), refetchRevenue(), refetchTop(), refetchTraffic(), refetchOrders()]);
    setRefreshing(false);
    toast.success('Dashboard refreshed');
  };

  const stats = [
    { label: 'Total Revenue', value: summary ? fmtCurrency(summary.revenue.value) : '—', change: summary?.revenue.growth ?? 0, icon: DollarSign, accent: 'bg-indigo-600' },
    { label: 'Orders', value: summary ? fmtCount(summary.orders.value) : '—', change: summary?.orders.growth ?? 0, icon: ShoppingCart, accent: 'bg-emerald-600' },
    { label: 'Customers', value: summary ? fmtCount(summary.customers.value) : '—', change: summary?.customers.growth ?? 0, icon: Users, accent: 'bg-violet-600' },
    { label: 'Avg Order Value', value: summary ? `$${summary.avgOrderValue.value.toFixed(2)}` : '—', change: summary?.avgOrderValue.growth ?? 0, icon: TrendingUp, accent: 'bg-amber-500' },
    { label: 'Pending Orders', value: orderStats ? String(orderStats.pending) : '—', change: 0, icon: Clock, accent: 'bg-cyan-600' },
    { label: 'Shipped', value: orderStats ? String(orderStats.shipped) : '—', change: 0, icon: Package, accent: 'bg-blue-600' },
    { label: 'Delivered', value: orderStats ? String(orderStats.delivered) : '—', change: 0, icon: CheckCircle2, accent: 'bg-fuchsia-600' },
    { label: 'Cancelled', value: orderStats ? String(orderStats.cancelled) : '—', change: 0, icon: XCircle, accent: 'bg-rose-500' },
  ];

  // Revenue chart: [{ date: "2024-01-15", revenue: 1234 }] → [{ month: "01-15", revenue }]
  const chartData = (revenueTrend ?? []).map((d: any) => ({
    month: d.date?.slice(5) ?? d.date,
    revenue: d.revenue,
  }));

  // Top products: [{ productId, _sum: { quantity, total }, product: { name } }]
  const topChartData = (topProductsRaw ?? []).map((item: any) => ({
    name: (item.product?.name ?? 'Unknown').slice(0, 20),
    sales: item._sum?.quantity ?? 0,
    revenue: Math.round(Number(item._sum?.total ?? 0)),
  }));

  // Traffic pie: [{ source, sessions }] → [{ name, value, color }]
  const trafficSources = (trafficRaw ?? []).map((t: any, i: number) => ({
    name: t.source ?? 'direct',
    value: t.sessions,
    color: TRAFFIC_COLORS[i % TRAFFIC_COLORS.length],
  }));

  // Order status bars
  const orderSummaryData = [
    { label: 'Pending', value: orderStats?.pending ?? 0, color: '#f59e0b' },
    { label: 'Processing', value: orderStats?.processing ?? 0, color: '#4f46e5' },
    { label: 'Shipped', value: orderStats?.shipped ?? 0, color: '#06b6d4' },
    { label: 'Delivered', value: orderStats?.delivered ?? 0, color: '#10b981' },
  ];
  const orderTotal = orderSummaryData.reduce((s, o) => s + o.value, 0);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Welcome back. Here's what's happening with your store."
        action={
          <div className="flex gap-2">
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
              {PERIODS.map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${period === p ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
                  {p}
                </button>
              ))}
            </div>
            <Btn variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </Btn>
            <Btn onClick={() => toast.success('Report exported as CSV')}><Download size={16} /> Export</Btn>
          </div>
        }
      />

      {summaryLoading && (
        <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
          <Loader2 size={14} className="animate-spin" /> Loading analytics…
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Revenue Trend</h3>
              <p className="text-xs text-slate-500">{periodLabels[period]}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#4f46e5" strokeWidth={2.5} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-slate-900 dark:text-white mb-1">Traffic Sources</h3>
          <p className="text-xs text-slate-500 mb-4">Where visitors come from</p>
          {trafficSources.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={trafficSources} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={3}>
                    {trafficSources.map((_: any, i: number) => <Cell key={i} fill={TRAFFIC_COLORS[i % TRAFFIC_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, 'Sessions']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {trafficSources.map((s: any) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />{s.name}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 mt-8 text-center">No traffic data yet</p>
          )}
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2 p-6">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4">Top Products by Sales</h3>
          {topChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topChartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="sales" name="Units Sold" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={10} />
                <Bar dataKey="revenue" name="Revenue ($)" fill="#10b981" radius={[0, 4, 4, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-slate-400 mt-8 text-center">No sales data yet. Orders will appear here once placed.</p>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Activity size={16} className="text-indigo-500" /> Order Status
          </h3>
          <div className="space-y-3">
            {orderSummaryData.map((o) => (
              <div key={o.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">{o.label}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{o.value}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: orderTotal ? `${(o.value / orderTotal) * 100}%` : '0%', background: o.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button className="w-full text-center text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center justify-center gap-1">
              View All Orders <ArrowUpRight size={13} />
            </button>
          </div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock size={16} className="text-slate-400" /> Recent Activity
          </h3>
          <div className="space-y-3">
            {recentActivity.map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${a.color}`}>
                  <a.icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-tight">{a.text}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{a.time}</p>
                </div>
                {a.amount && (
                  <span className={`text-xs font-bold flex-shrink-0 ${a.amount.startsWith('-') ? 'text-rose-500' : 'text-emerald-600'}`}>
                    {a.amount}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <PackageX size={18} className="text-rose-500" /> Inventory Alerts
          </h3>
          <div className="space-y-2.5">
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-rose-50 dark:bg-rose-900/20">
                <div className="flex items-center gap-2.5">
                  <img src={p.image} alt="" className="w-8 h-8 rounded object-cover" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.sku}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-rose-600">{p.stock} left</span>
                  <p className="text-xs text-slate-400">{p.category}</p>
                </div>
              </div>
            ))}
            <Btn variant="outline" className="w-full justify-center mt-1" onClick={() => toast.info('Opening restock workflow')}>
              Restock Items <ArrowUpRight size={16} />
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
