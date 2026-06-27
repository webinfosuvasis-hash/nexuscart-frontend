import React from 'react';
import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react';

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm ${className}`}>
    {children}
  </div>
);

export const StatCard: React.FC<{
  label: string; value: string; change?: number; icon: LucideIcon; accent: string;
}> = ({ label, value, change, icon: Icon, accent }) => (
  <Card className="p-5 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
        {change !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {Math.abs(change)}% <span className="text-slate-400 font-normal">vs last month</span>
          </div>
        )}
      </div>
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${accent}`}>
        <Icon size={20} className="text-white" />
      </div>
    </div>
  </Card>
);

const badgeColors: Record<string, string> = {
  // Title-case (UI labels)
  Active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Operational: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Delivered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  VIP: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  Draft: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  Pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Shipped: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  Cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
  Refunded: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  Returned: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  Expired: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
  Archived: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
  Inactive: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
  'Low Capacity': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'At Risk': 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
  Regular: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  New: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  // Uppercase (from backend API — products/orders)
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  ARCHIVED: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  PROCESSING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  SHIPPED: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  DELIVERED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  CANCELLED: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
  REFUNDED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  RETURNED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  // Customer segments (from backend API)
  VIP: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  REGULAR: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  NEW: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  AT_RISK: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
};

export const Badge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeColors[status] || 'bg-slate-100 text-slate-600'}`}>
    {status}
  </span>
);

export const PageHeader: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({ title, subtitle, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
      {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const Btn: React.FC<{
  children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'outline' | 'ghost';
  className?: string; type?: 'button' | 'submit';
}> = ({ children, onClick, variant = 'primary', className = '', type = 'button' }) => {
  const styles = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    outline: 'border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200',
    ghost: 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300',
  };
  return (
    <button type={type} onClick={onClick} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
};
