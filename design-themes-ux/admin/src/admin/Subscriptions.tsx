import React, { useState } from 'react';
import {
  Check, Crown, Zap, Package, Building2, ArrowRight, RefreshCw,
  Download, CreditCard, Clock, AlertTriangle, BarChart3, Users,
  Globe, Mail, FileText, Infinity as InfinityIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, PageHeader, Btn, Badge } from './ui';
import type { Plan, Invoice } from '@/types';

// ─── Plans Data ───────────────────────────────────────────────────────────────

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 499,
    yearlyPrice: 399,
    billingCycle: 'monthly',
    description: 'Perfect for new stores just getting started',
    features: ['Up to 100 products', '2 staff accounts', 'Basic analytics', 'Standard themes', 'Email support', '1 custom domain'],
    limits: { products: 100, staff: 2, storage: 2, bandwidth: 10, customDomains: 1, apiCalls: 10000, emailsPerMonth: 1000 },
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 1499,
    yearlyPrice: 1199,
    billingCycle: 'monthly',
    description: 'For growing stores that need more power',
    features: ['Up to 1,000 products', '5 staff accounts', 'Advanced analytics', 'Premium themes', 'Priority support', '3 custom domains', 'Coupons & Campaigns', 'AI Content Generation'],
    limits: { products: 1000, staff: 5, storage: 10, bandwidth: 50, customDomains: 3, apiCalls: 100000, emailsPerMonth: 10000 },
    isPopular: true,
    badge: 'Most Popular',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 3499,
    yearlyPrice: 2799,
    billingCycle: 'monthly',
    description: 'For established businesses scaling fast',
    features: ['Up to 10,000 products', '15 staff accounts', 'Full analytics suite', 'All themes + Page Builder', 'Dedicated support', '10 custom domains', 'Multi-warehouse', 'API access', 'White-label options'],
    limits: { products: 10000, staff: 15, storage: 50, bandwidth: 200, customDomains: 10, apiCalls: 1000000, emailsPerMonth: 50000 },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 0,
    yearlyPrice: 0,
    billingCycle: 'monthly',
    description: 'Custom plans for large-scale operations',
    features: ['Unlimited products', 'Unlimited staff', 'Custom analytics', 'Custom theme development', '24/7 SLA support', 'Unlimited domains', 'Dedicated infrastructure', 'Custom integrations', 'SSO & SAML', 'SLA guarantee'],
    limits: { products: -1, staff: -1, storage: -1, bandwidth: -1, customDomains: -1, apiCalls: -1, emailsPerMonth: -1 },
  },
];

const MOCK_INVOICES: Invoice[] = [
  { id: 'inv-001', amount: 1499, status: 'paid', date: '2025-06-01', description: 'Growth Plan — June 2025', pdfUrl: '#' },
  { id: 'inv-002', amount: 1499, status: 'paid', date: '2025-05-01', description: 'Growth Plan — May 2025', pdfUrl: '#' },
  { id: 'inv-003', amount: 1499, status: 'paid', date: '2025-04-01', description: 'Growth Plan — April 2025', pdfUrl: '#' },
  { id: 'inv-004', amount: 499, status: 'paid', date: '2025-03-01', description: 'Starter Plan — March 2025', pdfUrl: '#' },
];

const CURRENT_PLAN_ID = 'growth';

// ─── Usage Meter ──────────────────────────────────────────────────────────────

const UsageMeter: React.FC<{ label: string; used: number; limit: number; icon: typeof Package; unit?: string }> = ({
  label, used, limit, icon: Icon, unit = '',
}) => {
  const pct = limit === -1 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const color = pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-indigo-500';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
          <Icon size={13} className="text-slate-400" /> {label}
        </span>
        <span className="text-xs font-semibold text-slate-900 dark:text-white">
          {used}{unit} / {limit === -1 ? '∞' : `${limit}${unit}`}
        </span>
      </div>
      {limit !== -1 && (
        <>
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
          </div>
          {pct >= 80 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
              <AlertTriangle size={10} /> {100 - pct}% remaining
            </p>
          )}
        </>
      )}
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

const Subscriptions: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [activeTab, setActiveTab] = useState<'overview' | 'plans' | 'invoices'>('overview');
  const [confirmUpgrade, setConfirmUpgrade] = useState<Plan | null>(null);

  const currentPlan = PLANS.find((p) => p.id === CURRENT_PLAN_ID)!;

  const getPrice = (p: Plan) =>
    billingCycle === 'yearly' ? (p.yearlyPrice || p.price) : p.price;

  const yearlyDiscount = (p: Plan) =>
    p.yearlyPrice ? Math.round(((p.price - p.yearlyPrice) / p.price) * 100) : 0;

  const usage = {
    products: { used: 284, limit: currentPlan.limits.products },
    staff: { used: 3, limit: currentPlan.limits.staff },
    storage: { used: 3.2, limit: currentPlan.limits.storage },
    apiCalls: { used: 42000, limit: currentPlan.limits.apiCalls },
    emails: { used: 3200, limit: currentPlan.limits.emailsPerMonth },
  };

  return (
    <div>
      <PageHeader title="Plans & Billing" subtitle="Manage your subscription, usage, and invoices"
        action={
          <Btn variant="outline" onClick={() => toast.info('Customer portal opened')}><CreditCard size={16} /> Manage Billing</Btn>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-6 w-fit">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'plans', label: 'Change Plan' },
          { id: 'invoices', label: 'Invoices' },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setActiveTab(id as any)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === id ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Current Plan Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-indigo-200 text-sm font-medium mb-1">Current Plan</p>
                <h2 className="text-3xl font-bold">{currentPlan.name}</h2>
                <p className="text-indigo-200 mt-1">{currentPlan.description}</p>
              </div>
              <div className="bg-white/20 rounded-xl p-3">
                <Crown size={28} className="text-amber-300" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-3xl font-bold">₹{currentPlan.price}</span>
                <span className="text-indigo-200">/month</span>
              </div>
              <div className="text-right">
                <p className="text-indigo-200 text-sm">Next billing</p>
                <p className="font-bold">July 1, 2025</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <div className="flex items-center gap-1 text-sm text-white/80">
                <Clock size={13} />
                <span>Active subscription</span>
              </div>
              <button onClick={() => setActiveTab('plans')}
                className="ml-auto flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors">
                Upgrade <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Usage */}
          <Card className="p-6">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <BarChart3 size={17} className="text-indigo-600" /> Usage This Period
            </h3>
            <div className="space-y-4">
              <UsageMeter label="Products" used={usage.products.used} limit={usage.products.limit} icon={Package} />
              <UsageMeter label="Staff Accounts" used={usage.staff.used} limit={usage.staff.limit} icon={Users} />
              <UsageMeter label="Storage" used={usage.storage.used} limit={usage.storage.limit} icon={Globe} unit="GB" />
              <UsageMeter label="API Calls" used={usage.apiCalls.used} limit={usage.apiCalls.limit} icon={RefreshCw} />
              <UsageMeter label="Emails Sent" used={usage.emails.used} limit={usage.emails.limit} icon={Mail} />
            </div>
          </Card>

          {/* Payment Method */}
          <Card className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                <CreditCard size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Visa ending in 4242</p>
                <p className="text-xs text-slate-400">Expires 12/2027</p>
              </div>
            </div>
            <Btn variant="outline" onClick={() => toast.info('Update payment method')}>Update</Btn>
          </Card>
        </div>
      )}

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div>
          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className={`text-sm font-semibold ${billingCycle === 'monthly' ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>Monthly</span>
            <button onClick={() => setBillingCycle((c) => c === 'monthly' ? 'yearly' : 'monthly')}
              className={`w-12 h-6 rounded-full transition-colors ${billingCycle === 'yearly' ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform mx-0.5 ${billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
            <span className={`text-sm font-semibold ${billingCycle === 'yearly' ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
              Yearly <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">Save 20%</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {PLANS.map((plan) => {
              const isCurrent = plan.id === CURRENT_PLAN_ID;
              const price = getPrice(plan);
              const discount = yearlyDiscount(plan);
              const isEnterprise = plan.id === 'enterprise';

              return (
                <div key={plan.id} className={`relative rounded-2xl border-2 p-5 flex flex-col transition-shadow ${plan.isPopular ? 'border-indigo-500 shadow-indigo-100 dark:shadow-indigo-900/20 shadow-lg' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-800`}>
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-indigo-600 text-white text-xs font-bold whitespace-nowrap">
                      {plan.badge}
                    </div>
                  )}

                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      {plan.id === 'starter' && <Package size={18} className="text-slate-500" />}
                      {plan.id === 'growth' && <Zap size={18} className="text-indigo-600" />}
                      {plan.id === 'pro' && <Crown size={18} className="text-violet-600" />}
                      {plan.id === 'enterprise' && <Building2 size={18} className="text-amber-600" />}
                      <h3 className="font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">{plan.description}</p>
                    <div className="flex items-baseline gap-1">
                      {isEnterprise ? (
                        <span className="text-2xl font-bold text-slate-900 dark:text-white">Custom</span>
                      ) : (
                        <>
                          <span className="text-2xl font-bold text-slate-900 dark:text-white">₹{price}</span>
                          <span className="text-slate-400 text-xs">/mo</span>
                        </>
                      )}
                    </div>
                    {billingCycle === 'yearly' && discount > 0 && (
                      <p className="text-xs text-emerald-600 font-semibold mt-0.5">Save {discount}% vs monthly</p>
                    )}
                  </div>

                  <ul className="space-y-2 flex-1 mb-5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <Check size={12} className="text-emerald-500 flex-shrink-0 mt-0.5" /> {f}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <div className="w-full py-2.5 text-center text-sm font-bold rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 border-2 border-indigo-200">
                      <Check size={14} className="inline mr-1" /> Current Plan
                    </div>
                  ) : isEnterprise ? (
                    <button onClick={() => toast.info('Contact sales team')}
                      className="w-full py-2.5 text-sm font-bold rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 border-2 border-amber-200 hover:bg-amber-100 transition-colors">
                      Contact Sales
                    </button>
                  ) : (
                    <button onClick={() => setConfirmUpgrade(plan)}
                      className={`w-full py-2.5 text-sm font-bold rounded-xl transition-colors ${plan.isPopular ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'border-2 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600'}`}>
                      {PLANS.indexOf(plan) > PLANS.findIndex((p) => p.id === CURRENT_PLAN_ID) ? 'Upgrade' : 'Downgrade'} to {plan.name}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-bold text-slate-900 dark:text-white">Invoice History</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr>
                <th className="p-3 text-left font-semibold text-slate-500">Invoice</th>
                <th className="p-3 text-left font-semibold text-slate-500">Description</th>
                <th className="p-3 text-left font-semibold text-slate-500">Date</th>
                <th className="p-3 text-left font-semibold text-slate-500">Amount</th>
                <th className="p-3 text-left font-semibold text-slate-500">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {MOCK_INVOICES.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="p-3 font-mono text-xs font-semibold text-indigo-600">{inv.id}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">{inv.description}</td>
                  <td className="p-3 text-slate-500">{inv.date}</td>
                  <td className="p-3 font-bold text-slate-900 dark:text-white">₹{inv.amount.toLocaleString()}</td>
                  <td className="p-3"><Badge status={inv.status === 'paid' ? 'Active' : 'Draft'} /></td>
                  <td className="p-3 text-right">
                    <button onClick={() => toast.success('Downloading invoice ' + inv.id)}
                      className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline ml-auto">
                      <Download size={12} /> PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Upgrade Confirmation Modal */}
      {confirmUpgrade && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setConfirmUpgrade(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mx-auto mb-3">
                <Zap size={24} className="text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Confirm Plan Change</h3>
              <p className="text-slate-500 text-sm mt-1">
                Switch from <strong>{currentPlan.name}</strong> to <strong>{confirmUpgrade.name}</strong>
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 mb-5 text-sm space-y-2">
              <div className="flex justify-between"><span className="text-slate-500">New monthly price</span><span className="font-bold text-slate-900 dark:text-white">₹{getPrice(confirmUpgrade)}/mo</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Prorated charge today</span><span className="font-bold text-slate-900 dark:text-white">₹{Math.round(getPrice(confirmUpgrade) * 0.5)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Next billing date</span><span className="font-bold">July 1, 2025</span></div>
            </div>
            <div className="flex gap-2">
              <Btn variant="outline" className="flex-1 justify-center" onClick={() => setConfirmUpgrade(null)}>Cancel</Btn>
              <Btn className="flex-1 justify-center" onClick={() => { toast.success(`Upgraded to ${confirmUpgrade.name}!`); setConfirmUpgrade(null); }}>
                Confirm Upgrade
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscriptions;
