import React from 'react';
import { CreditCard, Truck, Award, Search, Store, BarChart3, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Card, PageHeader, Btn, Badge } from './ui';

export const Payments: React.FC = () => (
  <div>
    <PageHeader title="Payments & Finance" subtitle="Manage gateways, taxes and payouts" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {[['Stripe', true], ['Razorpay', true], ['PayPal', false], ['Cash on Delivery', true]].map(([name, on]) => (
        <Card key={name as string} className="p-5">
          <div className="flex items-center justify-between mb-3"><CreditCard size={22} className="text-indigo-600" />{on ? <Badge status="Active" /> : <Badge status="Pending" />}</div>
          <p className="font-bold text-slate-900 dark:text-white">{name as string}</p>
          <Btn variant="outline" className="w-full justify-center mt-3 text-xs" onClick={() => toast.success(`${name} ${on ? 'configured' : 'connected'}`)}>{on ? 'Configure' : 'Connect'}</Btn>
        </Card>
      ))}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[['Total Revenue', '$842,300', 'emerald'], ['Pending Payouts', '$24,180', 'amber'], ['GST Collected', '$58,940', 'blue']].map(([l, v, c]) => (
        <Card key={l} className="p-5"><p className="text-sm text-slate-500">{l}</p><p className={`text-2xl font-bold text-${c}-600 mt-1`}>{v}</p></Card>
      ))}
    </div>
  </div>
);

export const Shipping: React.FC = () => (
  <div>
    <PageHeader title="Shipping & Logistics" subtitle="Zones, rates and courier integrations"
      action={<Btn onClick={() => toast.success('Shipping zone added')}>Add Zone</Btn>} />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {[['Domestic', '$4.99', '2-4 days'], ['Express', '$12.99', '1 day'], ['International', '$24.99', '7-14 days'], ['Free (over $50)', '$0.00', '3-5 days']].map(([z, r, t]) => (
        <Card key={z} className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3"><Truck size={22} className="text-indigo-600" /><div><p className="font-bold text-slate-900 dark:text-white">{z}</p><p className="text-xs text-slate-500">{t}</p></div></div>
          <span className="font-bold text-slate-900 dark:text-white">{r}</span>
        </Card>
      ))}
    </div>
    <Card className="p-5">
      <h3 className="font-bold text-slate-900 dark:text-white mb-3">Courier Integrations</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {['FedEx', 'DHL', 'Delhivery', 'BlueDart'].map((c) => (
          <div key={c} className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700"><Check size={15} className="text-emerald-500" /><span className="text-sm font-medium text-slate-700 dark:text-slate-200">{c}</span></div>
        ))}
      </div>
    </Card>
  </div>
);

export const Loyalty: React.FC = () => (
  <div>
    <PageHeader title="Loyalty & Membership" subtitle="Reward points, tiers and referrals" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {[['Bronze', '0-999 pts', '5% rewards', 'amber'], ['Silver', '1000-4999 pts', '10% rewards', 'slate'], ['Gold', '5000+ pts', '15% rewards', 'yellow']].map(([t, r, p, c]) => (
        <Card key={t} className="p-6 text-center">
          <Award size={32} className={`mx-auto text-${c}-500 mb-2`} />
          <p className="font-bold text-slate-900 dark:text-white text-lg">{t}</p>
          <p className="text-xs text-slate-500">{r}</p>
          <p className="text-sm font-semibold text-indigo-600 mt-2">{p}</p>
        </Card>
      ))}
    </div>
    <Card className="p-5 flex items-center justify-between">
      <div><p className="font-bold text-slate-900 dark:text-white">Referral Program</p><p className="text-sm text-slate-500">Give $10, Get $10 for every successful referral</p></div>
      <Btn onClick={() => toast.success('Referral settings saved')}>Configure</Btn>
    </Card>
  </div>
);

export const SEO: React.FC = () => (
  <div>
    <PageHeader title="SEO & Search" subtitle="Meta tags, schema and search analytics" />
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {[['Indexed Pages', '1,284'], ['Avg Position', '4.2'], ['Search Clicks', '18.4K'], ['Top Keyword', 'wireless earbuds']].map(([l, v]) => (
        <Card key={l} className="p-5"><p className="text-xs text-slate-500">{l}</p><p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{v}</p></Card>
      ))}
    </div>
    <Card className="p-5">
      <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2"><Search size={18} /> Search Analytics</h3>
      <div className="space-y-2">
        {[['wireless earbuds', 2840, 4.2], ['smart watch', 1920, 3.8], ['running shoes', 1450, 5.1], ['coffee mug', 980, 6.4]].map(([k, c, p]) => (
          <div key={k as string} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">{k as string}</span>
            <div className="flex gap-6 text-slate-500"><span>{(c as number).toLocaleString()} clicks</span><span>pos {p}</span></div>
          </div>
        ))}
      </div>
    </Card>
  </div>
);

export const Marketplace: React.FC = () => (
  <div>
    <PageHeader title="Marketplace" subtitle="Multi-vendor management"
      action={<Btn onClick={() => toast.success('Vendor invited')}>Invite Vendor</Btn>} />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {[['Active Vendors', '42', 'indigo'], ['Pending Approval', '8', 'amber'], ['Total Commission', '$18,420', 'emerald']].map(([l, v, c]) => (
        <Card key={l} className="p-5"><p className="text-sm text-slate-500">{l}</p><p className={`text-2xl font-bold text-${c}-600 mt-1`}>{v}</p></Card>
      ))}
    </div>
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-900/50 text-left text-slate-500">
          <tr><th className="p-3 font-semibold">Vendor</th><th className="p-3 font-semibold">Products</th><th className="p-3 font-semibold">Sales</th><th className="p-3 font-semibold">Commission</th><th className="p-3 font-semibold">Status</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {[['TechVibe Store', 84, '$42,300', '12%', 'Active'], ['Fashion Hub', 142, '$38,900', '15%', 'Active'], ['Home Essentials', 67, '$21,400', '10%', 'Pending']].map((v) => (
            <tr key={v[0] as string} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
              <td className="p-3 font-semibold text-slate-900 dark:text-white">{v[0] as string}</td>
              <td className="p-3 text-slate-600 dark:text-slate-300">{v[1] as number}</td>
              <td className="p-3 text-slate-600 dark:text-slate-300">{v[2] as string}</td>
              <td className="p-3 font-medium text-slate-900 dark:text-white">{v[3] as string}</td>
              <td className="p-3"><Badge status={v[4] as string} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  </div>
);
