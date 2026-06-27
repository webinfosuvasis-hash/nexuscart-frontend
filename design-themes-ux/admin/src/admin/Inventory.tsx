import React, { useState } from 'react';
import { Warehouse, Plus, ArrowRightLeft, Truck, AlertTriangle, Package } from 'lucide-react';
import { toast } from 'sonner';
import { Card, PageHeader, Btn, Badge } from './ui';
import { warehouses, suppliers, lowStock } from './data';

const Inventory: React.FC = () => {
  const [tab, setTab] = useState('warehouses');
  const tabs = [['warehouses', 'Warehouses'], ['suppliers', 'Suppliers'], ['alerts', 'Low Stock']];

  return (
    <div>
      <PageHeader title="Inventory & Warehouse" subtitle="Stock management across all locations"
        action={
          <div className="flex gap-2">
            <Btn variant="outline" onClick={() => toast.success('Stock transfer created')}><ArrowRightLeft size={16} /> Transfer</Btn>
            <Btn onClick={() => toast.success('Purchase order created')}><Plus size={16} /> Purchase Order</Btn>
          </div>
        } />

      <div className="flex gap-1 mb-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-4 py-1.5 rounded-md text-sm font-semibold ${tab === id ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{label}</button>
        ))}
      </div>

      {tab === 'warehouses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {warehouses.map((w) => (
            <Card key={w.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center"><Warehouse size={20} className="text-indigo-600" /></div>
                  <div><p className="font-bold text-slate-900 dark:text-white">{w.name}</p><p className="text-xs text-slate-500">{w.location}</p></div>
                </div>
                <Badge status={w.status} />
              </div>
              <div className="mb-2 flex justify-between text-sm"><span className="text-slate-500">Capacity</span><span className="font-semibold text-slate-900 dark:text-white">{w.stock.toLocaleString()} / {w.capacity.toLocaleString()}</span></div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(w.stock / w.capacity) * 100}%` }} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'suppliers' && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-left text-slate-500">
              <tr><th className="p-3 font-semibold">Supplier</th><th className="p-3 font-semibold">Items</th><th className="p-3 font-semibold">Lead Time</th><th className="p-3 font-semibold">Rating</th><th className="p-3 font-semibold">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                  <td className="p-3 font-semibold text-slate-900 dark:text-white">{s.name}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">{s.items}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">{s.leadTime}</td>
                  <td className="p-3 text-amber-500 font-semibold">{s.rating} ★</td>
                  <td className="p-3"><Badge status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'alerts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lowStock.map((p) => (
            <Card key={p.id} className="p-4 border-l-4 border-l-rose-500">
              <div className="flex items-center gap-2 mb-2"><AlertTriangle size={16} className="text-rose-500" /><span className="text-xs font-semibold text-rose-600">LOW STOCK</span></div>
              <p className="font-semibold text-slate-900 dark:text-white">{p.name}</p>
              <p className="text-xs text-slate-400 mb-3">{p.sku}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Only <b className="text-rose-600">{p.stock}</b> left</span>
                <Btn className="text-xs py-1.5" onClick={() => toast.success('Reorder placed')}><Truck size={13} /> Reorder</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Inventory;
