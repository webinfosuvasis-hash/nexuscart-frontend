import React, { useState } from 'react';
import { Store, Globe, Users, CreditCard, Key, Webhook, Shield, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card, PageHeader, Btn, Badge } from './ui';

const Settings: React.FC = () => {
  const [tab, setTab] = useState('store');
  const tabs = [
    ['store', 'Store Profile', Store], ['domain', 'Custom Domain', Globe],
    ['staff', 'Staff & Roles', Users], ['billing', 'Plan & Billing', CreditCard],
    ['api', 'API & Webhooks', Key],
  ] as const;

  return (
    <div>
      <PageHeader title="Settings & SaaS Controls" subtitle="Configure your store and tenant settings" />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="p-2 h-fit">
          {tabs.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${tab === id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
              <Icon size={17} /> {label}
            </button>
          ))}
        </Card>

        <Card className="lg:col-span-3 p-6">
          {tab === 'store' && (
            <div className="space-y-4 max-w-lg">
              <h3 className="font-bold text-slate-900 dark:text-white">Store Profile</h3>
              {[['Store Name', 'NexusCart'], ['Support Email', 'support@nexuscart.com'], ['Currency', 'USD ($)']].map(([l, v]) => (
                <div key={l}><label className="text-sm font-medium text-slate-700 dark:text-slate-300">{l}</label><input defaultValue={v} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" /></div>
              ))}
              <Btn onClick={() => toast.success('Settings saved')}><Save size={16} /> Save Changes</Btn>
            </div>
          )}
          {tab === 'domain' && (
            <div className="space-y-4 max-w-lg">
              <h3 className="font-bold text-slate-900 dark:text-white">Custom Domain</h3>
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20"><span className="text-sm font-medium">shop.nexuscart.com</span><Badge status="Active" /></div>
              <div><label className="text-sm font-medium text-slate-700 dark:text-slate-300">Add Domain</label><input placeholder="www.yourdomain.com" className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" /></div>
              <Btn onClick={() => toast.success('Domain verification started')}>Connect Domain</Btn>
            </div>
          )}
          {tab === 'staff' && (
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">Staff Accounts & Roles</h3>
              <div className="space-y-2">
                {[['Sarah Chen', 'Admin'], ['Mike Ross', 'Manager'], ['Lisa Park', 'Support']].map(([n, r]) => (
                  <div key={n} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-xs">{n.split(' ').map((x) => x[0]).join('')}</div><span className="font-medium text-slate-800 dark:text-slate-100">{n}</span></div>
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1"><Shield size={13} /> {r}</span>
                  </div>
                ))}
              </div>
              <Btn className="mt-4" onClick={() => toast.success('Invite sent')}>Invite Staff</Btn>
            </div>
          )}
          {tab === 'billing' && (
            <div className="max-w-lg">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">Plan & Billing</h3>
              <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white mb-4">
                <p className="text-sm opacity-80">Current Plan</p><p className="text-2xl font-bold">Growth — $99/mo</p>
                <p className="text-sm opacity-80 mt-2">Next billing: July 15, 2025</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[['Products', '247 / 1000'], ['Staff', '3 / 10'], ['Storage', '4.2 / 50 GB']].map(([l, v]) => (
                  <div key={l} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/40"><p className="text-xs text-slate-500">{l}</p><p className="font-bold text-slate-900 dark:text-white text-sm mt-1">{v}</p></div>
                ))}
              </div>
              <Btn className="mt-4" onClick={() => toast.info('Opening upgrade options')}>Upgrade Plan</Btn>
            </div>
          )}
          {tab === 'api' && (
            <div className="max-w-lg space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white">API Keys & Webhooks</h3>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/40 font-mono text-xs flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300">sk_live_••••••••••••4f9a</span>
                <button onClick={() => toast.success('Key copied')} className="text-indigo-600 font-semibold">Copy</button>
              </div>
              <Btn variant="outline" onClick={() => toast.success('New API key generated')}><Key size={16} /> Generate Key</Btn>
              <div className="pt-2"><label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2"><Webhook size={15} /> Webhook URL</label><input placeholder="https://yourapp.com/webhook" className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" /></div>
              <Btn onClick={() => toast.success('Webhook saved')}>Save Webhook</Btn>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Settings;
