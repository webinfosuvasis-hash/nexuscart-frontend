import React, { useState } from 'react';
import {
  Plus, Tag, Zap, Gift, Mail, MessageCircle, Trash2, Edit,
  Send, Users, BarChart3, TrendingUp, Eye, X, Clock,
  Bell, CheckCircle2, Pause, Play, Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, PageHeader, Btn, Badge } from './ui';
import { coupons as seed } from './data';
import type { Campaign, EmailTemplate } from '@/types';

// ─── Mock Campaigns ───────────────────────────────────────────────────────────

const MOCK_CAMPAIGNS: Campaign[] = [
  { id: 'c1', name: 'Summer Sale Blast', type: 'email', status: 'completed', audience: 'All Customers', reach: 4218, opens: 1892, clicks: 642, conversions: 148, revenue: 18420, completedAt: '2025-06-10' },
  { id: 'c2', name: 'VIP Flash Deal 48H', type: 'push', status: 'running', audience: 'VIP Segment', reach: 842, opens: 612, clicks: 284, conversions: 62, revenue: 9840, launchedAt: '2025-06-15' },
  { id: 'c3', name: 'Back to School', type: 'email', status: 'scheduled', audience: 'Regular + New', reach: 2840, scheduledAt: '2025-07-01' },
  { id: 'c4', name: 'WhatsApp Promo', type: 'sms', status: 'draft', audience: 'All Customers', reach: 0 },
];

const MOCK_TEMPLATES: EmailTemplate[] = [
  { id: 'et1', name: 'Welcome Email', type: 'welcome', subject: 'Welcome to NexusCart! 🎉', preview: 'Hi {first_name}, welcome aboard…', isActive: true, openRate: 68.4, clickRate: 24.2, updatedAt: '2025-05-15' },
  { id: 'et2', name: 'Order Confirmation', type: 'order_confirmation', subject: 'Your order #{order_id} is confirmed', preview: 'We\'ve received your order and are processing it…', isActive: true, openRate: 92.1, clickRate: 41.8, updatedAt: '2025-05-10' },
  { id: 'et3', name: 'Shipping Notification', type: 'shipping', subject: 'Your order is on its way! 🚀', preview: 'Great news! Your order has been shipped…', isActive: true, openRate: 88.6, clickRate: 35.4, updatedAt: '2025-05-10' },
  { id: 'et4', name: 'Abandoned Cart', type: 'abandoned_cart', subject: 'You left something behind 🛒', preview: 'Hey {first_name}, you forgot something in your cart…', isActive: true, openRate: 45.2, clickRate: 18.6, updatedAt: '2025-06-01' },
  { id: 'et5', name: 'Review Request', type: 'review', subject: 'How was your order?', preview: 'We\'d love to hear your feedback…', isActive: false, openRate: 31.4, clickRate: 12.8, updatedAt: '2025-04-20' },
  { id: 'et6', name: 'Promotional Newsletter', type: 'promotional', subject: 'Exclusive deals just for you!', preview: 'Don\'t miss out on this week\'s hottest deals…', isActive: true, openRate: 38.2, clickRate: 15.6, updatedAt: '2025-06-12' },
];

const CAMPAIGN_STATUS_STYLE = {
  draft: { color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-700', icon: Edit },
  scheduled: { color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: Clock },
  running: { color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: Play },
  completed: { color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20', icon: CheckCircle2 },
  paused: { color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20', icon: Pause },
};

const CAMPAIGN_TYPE_ICONS = {
  email: Mail, sms: MessageCircle, push: Bell, flash_sale: Zap, whatsapp: MessageCircle,
};

// ─── Component ────────────────────────────────────────────────────────────────

const Marketing: React.FC = () => {
  const [coupons, setCoupons] = useState(seed);
  const [campaigns, setCampaigns] = useState(MOCK_CAMPAIGNS);
  const [templates] = useState(MOCK_TEMPLATES);
  const [activeTab, setActiveTab] = useState<'coupons' | 'campaigns' | 'email'>('coupons');
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState('% Off');
  const [discountValue, setDiscountValue] = useState('');
  const [expiry, setExpiry] = useState('');

  const addCoupon = () => {
    if (!code.trim()) { toast.error('Enter a coupon code'); return; }
    setCoupons((c) => [{
      id: Date.now(), code: code.toUpperCase(),
      type: `${discountValue}${discountType}`,
      uses: 0, limit: 1000, status: 'Active',
      expires: expiry || '2025-12-31',
    }, ...c]);
    toast.success('Coupon created!');
    setShowCouponForm(false); setCode(''); setDiscountValue(''); setExpiry('');
  };

  const delCoupon = (id: number) => { setCoupons((c) => c.filter((x) => x.id !== id)); toast.success('Coupon deleted'); };
  const dupCoupon = (c: any) => { setCoupons((list) => [{ ...c, id: Date.now(), code: c.code + '_COPY', uses: 0 }, ...list]); toast.success('Coupon duplicated'); };

  const channels = [
    { icon: Zap, name: 'Flash Sales', desc: 'Time-limited deals with countdown', color: 'from-amber-500 to-orange-500' },
    { icon: Gift, name: 'Buy X Get Y', desc: 'BOGO & bundle promotions', color: 'from-violet-500 to-purple-500' },
    { icon: Mail, name: 'Email Campaigns', desc: 'Newsletter & lifecycle emails', color: 'from-blue-500 to-indigo-500' },
    { icon: MessageCircle, name: 'WhatsApp', desc: 'Direct customer messaging', color: 'from-emerald-500 to-green-500' },
    { icon: Bell, name: 'Push Notifications', desc: 'Browser & mobile push', color: 'from-cyan-500 to-teal-500' },
    { icon: Tag, name: 'Affiliate', desc: 'Partner & referral links', color: 'from-rose-500 to-pink-500' },
  ];

  return (
    <div>
      <PageHeader title="Marketing & Growth" subtitle="Coupons, campaigns, and customer engagement"
        action={
          activeTab === 'coupons'
            ? <Btn onClick={() => setShowCouponForm(!showCouponForm)}><Plus size={16} /> New Coupon</Btn>
            : activeTab === 'campaigns'
            ? <Btn onClick={() => toast.info('Create campaign wizard')}><Plus size={16} /> New Campaign</Btn>
            : null
        }
      />

      {/* Channels Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        {channels.map((c) => (
          <Card key={c.name} className="p-4 hover:shadow-md transition-shadow cursor-pointer group" onClick={() => toast.info(`Opening ${c.name}`)}>
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-2 shadow-md`}>
              <c.icon size={17} className="text-white" />
            </div>
            <p className="font-bold text-slate-900 dark:text-white text-xs">{c.name}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{c.desc}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-5 w-fit">
        {[
          { id: 'coupons', label: 'Coupons & Discounts', icon: Tag },
          { id: 'campaigns', label: 'Campaigns', icon: Send },
          { id: 'email', label: 'Email Templates', icon: Mail },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === id ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Coupons Tab */}
      {activeTab === 'coupons' && (
        <>
          {showCouponForm && (
            <Card className="p-5 mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white mb-3">Create New Coupon</h3>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <input value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder="CODE (e.g. SAVE20)" className="px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm uppercase" />
                <input value={discountValue} onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="Value (e.g. 20)" type="number"
                  className="px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm" />
                <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}
                  className="px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm">
                  <option>% Off</option>
                  <option>₹ Off</option>
                  <option>Free Shipping</option>
                </select>
                <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)}
                  className="px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm" />
                <Btn onClick={addCoupon} className="justify-center">Create Coupon</Btn>
              </div>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
              <Tag size={16} className="text-indigo-600" />
              <h3 className="font-bold text-slate-900 dark:text-white">Coupons & Discount Codes</h3>
              <span className="ml-auto text-xs text-slate-500">{coupons.filter((c) => c.status === 'Active').length} active</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Code</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Discount</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Usage</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Progress</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Expires</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {coupons.map((c) => {
                  const pct = Math.min(100, Math.round((c.uses / c.limit) * 100));
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="p-3">
                        <span className="font-mono font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-lg">
                          {c.code}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{c.type}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 tabular-nums">
                        {c.uses.toLocaleString()} / {c.limit.toLocaleString()}
                      </td>
                      <td className="p-3 w-28">
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{pct}%</p>
                      </td>
                      <td className="p-3 text-slate-500 text-xs">{c.expires}</td>
                      <td className="p-3"><Badge status={c.status} /></td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => dupCoupon(c)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-400 hover:text-slate-600"><Copy size={14} /></button>
                          <button onClick={() => delCoupon(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* Campaigns Tab */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          {/* Campaign Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
            {[
              { label: 'Total Reach', value: campaigns.reduce((a, c) => a + (c.reach || 0), 0).toLocaleString(), icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
              { label: 'Total Opens', value: campaigns.reduce((a, c) => a + (c.opens || 0), 0).toLocaleString(), icon: Eye, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
              { label: 'Total Clicks', value: campaigns.reduce((a, c) => a + (c.clicks || 0), 0).toLocaleString(), icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
              { label: 'Revenue Driven', value: `₹${campaigns.reduce((a, c) => a + (c.revenue || 0), 0).toLocaleString()}`, icon: BarChart3, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
            ].map((s) => (
              <Card key={s.label} className="p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.bg}`}><s.icon size={16} className={s.color} /></div>
                <div><p className="font-bold text-slate-900 dark:text-white">{s.value}</p><p className="text-xs text-slate-500">{s.label}</p></div>
              </Card>
            ))}
          </div>

          {campaigns.map((camp) => {
            const statusS = CAMPAIGN_STATUS_STYLE[camp.status as keyof typeof CAMPAIGN_STATUS_STYLE];
            const StatusIcon = statusS?.icon || Edit;
            const TypeIcon = CAMPAIGN_TYPE_ICONS[camp.type as keyof typeof CAMPAIGN_TYPE_ICONS] || Mail;
            const openRate = camp.reach ? ((camp.opens || 0) / camp.reach * 100).toFixed(1) : '–';
            const clickRate = camp.opens ? ((camp.clicks || 0) / (camp.opens || 1) * 100).toFixed(1) : '–';

            return (
              <Card key={camp.id} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                      <TypeIcon size={18} className="text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">{camp.name}</h4>
                      <p className="text-xs text-slate-400">Audience: {camp.audience}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusS?.bg} ${statusS?.color}`}>
                      <StatusIcon size={11} />
                      <span className="capitalize">{camp.status}</span>
                    </div>
                    {camp.status === 'running' && (
                      <button onClick={() => toast.info('Campaign paused')} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"><Pause size={14} /></button>
                    )}
                    {camp.status === 'draft' && (
                      <Btn onClick={() => toast.success('Campaign launched!')} className="text-xs py-1.5 px-3">
                        <Send size={12} /> Launch
                      </Btn>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-center">
                  {[
                    { label: 'Reach', value: camp.reach?.toLocaleString() || '–' },
                    { label: 'Opens', value: camp.opens?.toLocaleString() || '–' },
                    { label: 'Open Rate', value: camp.opens ? `${openRate}%` : '–' },
                    { label: 'Click Rate', value: camp.clicks ? `${clickRate}%` : '–' },
                    { label: 'Revenue', value: camp.revenue ? `₹${camp.revenue.toLocaleString()}` : '–' },
                  ].map((m) => (
                    <div key={m.label}>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{m.value}</p>
                      <p className="text-xs text-slate-500">{m.label}</p>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Email Templates Tab */}
      {activeTab === 'email' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <Card key={t.id} className="p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 dark:text-white">{t.name}</h4>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{t.subject}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toast.info('Opening template editor')}
                    className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-400 hover:text-indigo-600">
                    <Edit size={14} />
                  </button>
                  <button onClick={() => toast.info('Preview email')}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                    <Eye size={14} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-3 line-clamp-2">{t.preview}</p>
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-400">Open rate</span>
                  <span className="ml-1 font-bold text-emerald-600">{t.openRate}%</span>
                </div>
                <div>
                  <span className="text-slate-400">Click rate</span>
                  <span className="ml-1 font-bold text-indigo-600">{t.clickRate}%</span>
                </div>
                <span className="ml-auto text-slate-400">Updated {t.updatedAt}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Marketing;
