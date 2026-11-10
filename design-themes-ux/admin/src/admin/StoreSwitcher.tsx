import React, { useEffect, useState } from 'react';
import { Store as StoreIcon } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface StoreOption { id: string; name: string; status: string }

/**
 * Store picker for SUPER_ADMIN, who belongs to no store. Store-scoped endpoints
 * (products, orders, …) require X-Store-Id, which lib/api.ts reads from
 * localStorage 'store_id' — store users get it at login, a super admin picks it here.
 * Switching reloads the panel so every page refetches for the new store.
 */
const StoreSwitcher: React.FC = () => {
  const { user } = useAuth();
  const [stores, setStores] = useState<StoreOption[]>([]);
  const current = localStorage.getItem('store_id') ?? '';

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN') return;
    api.get('/stores', { params: { limit: 100 } })
      .then((res: any) => setStores(res?.data?.items ?? []))
      .catch(() => setStores([]));
  }, [user?.role]);

  if (user?.role !== 'SUPER_ADMIN') return null;

  const onChange = (id: string) => {
    if (id) localStorage.setItem('store_id', id);
    else localStorage.removeItem('store_id');
    window.location.reload();
  };

  return (
    <label
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
        current
          ? 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700'
          : 'border-amber-400 bg-amber-50 dark:bg-amber-900/30'
      }`}
      title="Store you are managing"
    >
      <StoreIcon size={16} className={current ? 'text-indigo-500' : 'text-amber-600'} />
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent border-0 p-0 pr-6 text-sm font-medium text-slate-700 dark:text-slate-200 focus:ring-0 max-w-[180px]"
      >
        <option value="">Select a store…</option>
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}{s.status !== 'ACTIVE' ? ` (${s.status.toLowerCase()})` : ''}
          </option>
        ))}
      </select>
    </label>
  );
};

export default StoreSwitcher;
