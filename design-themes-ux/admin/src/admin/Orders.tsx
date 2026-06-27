import React, { useState } from 'react';
import {
  Search, Download, FileText, Truck, X, CheckCircle2, Circle,
  MapPin, CreditCard, Package, RefreshCw, ChevronLeft, ChevronRight,
  Clock, Ban, RotateCcw, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, PageHeader, Btn, Badge } from './ui';
import { useOrders, useOrderStats, useUpdateOrderStatus, useAddShipment, useCreateRefund, useAddOrderNote } from '@/hooks/useOrders';

const STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED'] as const;
type OrderStatus = typeof STATUSES[number];

const STATUS_META: Record<OrderStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  PENDING:    { icon: Clock, color: 'text-amber-500', label: 'Pending' },
  PROCESSING: { icon: Package, color: 'text-blue-500', label: 'Processing' },
  SHIPPED:    { icon: Truck, color: 'text-indigo-500', label: 'Shipped' },
  DELIVERED:  { icon: CheckCircle2, color: 'text-emerald-500', label: 'Delivered' },
  CANCELLED:  { icon: Ban, color: 'text-rose-500', label: 'Cancelled' },
  RETURNED:   { icon: RotateCcw, color: 'text-orange-500', label: 'Returned' },
  REFUNDED:   { icon: RotateCcw, color: 'text-violet-500', label: 'Refunded' },
};

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING:    ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED:    ['DELIVERED', 'RETURNED'],
  DELIVERED:  ['RETURNED', 'REFUNDED'],
  CANCELLED:  [],
  RETURNED:   ['REFUNDED'],
  REFUNDED:   [],
};

const TIMELINE_STEPS: OrderStatus[] = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

const PAGE_SIZE = 20;

const Orders: React.FC = () => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<any>(null);
  const [trackingInput, setTrackingInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const { data, isLoading } = useOrders({ page, limit: PAGE_SIZE, search: query || undefined, status: statusFilter || undefined });
  const { data: orderStats } = useOrderStats();
  const updateStatus = useUpdateOrderStatus();
  const addShipment = useAddShipment();
  const createRefund = useCreateRefund();
  const addNote = useAddOrderNote();

  const items: any[] = data?.items ?? [];
  const pagination = data?.pagination;

  const handleStatusUpdate = (id: string, status: string) => {
    updateStatus.mutate({ id, status }, {
      onSuccess: (updated) => {
        if (detail?.id === id) setDetail((d: any) => ({ ...d, status: updated?.status ?? status }));
      },
    });
  };

  const handleAddTracking = () => {
    if (!trackingInput.trim() || !detail) return;
    addShipment.mutate({
      id: detail.id,
      carrier: 'Manual',
      trackingNumber: trackingInput,
      estimatedDelivery: null,
    }, {
      onSuccess: () => {
        setDetail((d: any) => ({ ...d, shipments: [{ trackingNumber: trackingInput, carrier: 'Manual' }] }));
        setTrackingInput('');
        toast.success('Tracking saved');
      },
    });
  };

  const handleAddNote = () => {
    if (!noteInput.trim() || !detail) return;
    addNote.mutate({ id: detail.id, content: noteInput }, {
      onSuccess: () => { setNoteInput(''); toast.success('Note added'); },
    });
  };

  const handleRefund = () => {
    if (!refundAmount || !detail) return;
    createRefund.mutate({ id: detail.id, amount: Number(refundAmount), reason: refundReason || 'Manual refund' }, {
      onSuccess: () => { setRefundAmount(''); setRefundReason(''); },
    });
  };

  const statusCards = [
    { key: 'PENDING',    label: 'Pending',    color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',    icon: Clock },
    { key: 'PROCESSING', label: 'Processing', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',       icon: Package },
    { key: 'SHIPPED',    label: 'Shipped',    color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20', icon: Truck },
    { key: 'DELIVERED',  label: 'Delivered',  color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20', icon: CheckCircle2 },
  ];

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtTotal = (t: any) => `$${Number(t).toFixed(2)}`;
  const stepIdx = (status: string) => TIMELINE_STEPS.indexOf(status as OrderStatus);

  return (
    <div>
      <PageHeader title="Orders" subtitle={`${orderStats?.total ?? '…'} total orders`}
        action={<Btn variant="outline" onClick={() => toast.success('Orders exported to CSV')}><Download size={16} /> Export</Btn>}
      />

      {/* Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {statusCards.map(({ key, label, color, icon: Icon }) => (
          <Card key={key} className={`p-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow ${statusFilter === key ? 'ring-2 ring-indigo-500' : ''}`}
            onClick={() => { setStatusFilter(statusFilter === key ? '' : key); setPage(1); }}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {orderStats?.[key.toLowerCase() as keyof typeof orderStats] ?? '—'}
              </p>
              <p className="text-xs text-slate-500">{label}</p>
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
              placeholder="Search by order number or customer name…"
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm" />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm">
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        </div>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading orders…
        </div>
      )}

      {!isLoading && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Order</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Customer</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Date</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Items</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Total</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Payment</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Status</th>
                  <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {items.map((o) => {
                  const nextStatuses = STATUS_TRANSITIONS[o.status as OrderStatus] ?? [];
                  const customerName = o.customer?.name ?? 'Guest';
                  return (
                    <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors" onClick={() => setDetail(o)}>
                      <td className="p-3 font-semibold text-indigo-600 dark:text-indigo-400">{o.orderNumber}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 font-bold text-xs flex-shrink-0">
                            {customerName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-700 dark:text-slate-200">{customerName}</p>
                            <p className="text-xs text-slate-400">{o.customer?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-slate-500 text-xs">{fmtDate(o.createdAt)}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{o.items?.length ?? 0} items</td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{fmtTotal(o.total)}</td>
                      <td className="p-3">
                        <span className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                          <CreditCard size={12} /> {o.paymentMethod ?? 'Online'}
                        </span>
                      </td>
                      <td className="p-3"><Badge status={o.status} /></td>
                      <td className="p-3">
                        {nextStatuses.length > 0 && (
                          <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(o.id, nextStatuses[0]); }}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 hover:underline whitespace-nowrap">
                            → {STATUS_META[nextStatuses[0]].label}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-400 text-sm">No orders found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {pagination && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
              <p className="text-sm text-slate-500">
                {pagination.total} orders · Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-40">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-40">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Order Detail Drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" onClick={() => setDetail(null)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{detail.orderNumber}</h2>
                <p className="text-xs text-slate-500 flex items-center gap-1"><Clock size={12} /> {fmtDate(detail.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge status={detail.status} />
                <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-6">
              {/* Timeline */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Order Progress</p>
                <div className="flex items-center">
                  {TIMELINE_STEPS.map((step, i) => {
                    const currentIdx = stepIdx(detail.status);
                    const isDone = currentIdx >= i;
                    const isCancelled = ['CANCELLED', 'RETURNED', 'REFUNDED'].includes(detail.status);
                    return (
                      <React.Fragment key={step}>
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors
                            ${isCancelled ? 'border-rose-300 bg-rose-50' :
                              isDone ? 'border-indigo-600 bg-indigo-600' :
                              'border-slate-300 bg-white dark:bg-slate-800'}`}>
                            {isCancelled ? <Ban size={14} className="text-rose-400" /> :
                             isDone ? <CheckCircle2 size={14} className="text-white" /> :
                             <Circle size={14} className="text-slate-300" />}
                          </div>
                          <p className={`text-[10px] mt-1 font-medium whitespace-nowrap ${isDone && !isCancelled ? 'text-indigo-600' : 'text-slate-400'}`}>
                            {STATUS_META[step].label}
                          </p>
                        </div>
                        {i < TIMELINE_STEPS.length - 1 && (
                          <div className={`flex-1 h-0.5 mb-4 mx-1 ${currentIdx > i && !isCancelled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Customer */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Customer</p>
                  <p className="font-bold text-slate-900 dark:text-white">{detail.customer?.name ?? 'Guest'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{detail.customer?.email}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Payment</p>
                  <p className="font-bold text-slate-900 dark:text-white">{detail.paymentMethod ?? 'Online'}</p>
                  <p className={`text-xs font-semibold mt-0.5 ${detail.paymentStatus === 'PAID' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {detail.paymentStatus ?? 'Pending'}
                  </p>
                </div>
              </div>

              {/* Order Items */}
              {detail.items?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Items</p>
                  <div className="space-y-2">
                    {detail.items.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                        <img src={item.product?.thumbnail || `https://picsum.photos/seed/${item.productId}/40`} alt="" className="w-10 h-10 rounded object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{item.product?.name ?? 'Product'}</p>
                          <p className="text-xs text-slate-400">Qty: {item.quantity}</p>
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{fmtTotal(item.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Financials */}
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Order Summary</p>
                {[
                  { label: 'Subtotal', value: fmtTotal(detail.subtotal ?? 0) },
                  { label: 'Discount', value: `-${fmtTotal(detail.discount ?? 0)}` },
                  { label: 'Tax', value: fmtTotal(detail.tax ?? 0) },
                  { label: 'Shipping', value: fmtTotal(detail.shippingCost ?? 0) },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
                    <span>{r.label}</span><span>{r.value}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700 text-sm">
                  <span>Total</span><span>{fmtTotal(detail.total)}</span>
                </div>
              </div>

              {/* Shipping Address */}
              {detail.shippingAddress && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <MapPin size={12} /> Shipping Address
                  </p>
                  <div className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
                    {Object.values(detail.shippingAddress).filter(Boolean).join(', ')}
                  </div>
                </div>
              )}

              {/* Tracking */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Truck size={12} /> Tracking
                </p>
                {detail.shipments?.length > 0 ? (
                  detail.shipments.map((s: any) => (
                    <div key={s.id} className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl p-3 text-sm font-mono font-semibold mb-1">
                      {s.carrier}: {s.trackingNumber}
                    </div>
                  ))
                ) : (
                  <div className="flex gap-2">
                    <input value={trackingInput} onChange={(e) => setTrackingInput(e.target.value)}
                      placeholder="Enter tracking number…"
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                    <Btn onClick={handleAddTracking} className="flex-shrink-0">Save</Btn>
                  </div>
                )}
              </div>

              {/* Add Note */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Internal Note</p>
                <div className="flex gap-2">
                  <input value={noteInput} onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Add a note…"
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                  <Btn variant="outline" onClick={handleAddNote} className="flex-shrink-0">Add</Btn>
                </div>
              </div>

              {/* Status Transitions */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Update Status</p>
                <div className="grid grid-cols-3 gap-2">
                  {(STATUS_TRANSITIONS[detail.status as OrderStatus] ?? []).map((s) => (
                    <button key={s} onClick={() => handleStatusUpdate(detail.id, s)}
                      className="px-2 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-700 transition-colors text-slate-600 dark:text-slate-300">
                      {STATUS_META[s].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Refund */}
              {['DELIVERED', 'RETURNED'].includes(detail.status) && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Refund</p>
                  <div className="space-y-2">
                    <input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)}
                      placeholder={`Amount (max ${fmtTotal(detail.total)})`}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                    <input value={refundReason} onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="Reason for refund"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                    <Btn variant="outline" onClick={handleRefund} className="w-full justify-center text-rose-600 border-rose-200 hover:bg-rose-50">
                      <RefreshCw size={14} /> Process Refund
                    </Btn>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex gap-2 pt-2">
                <Btn variant="outline" className="flex-1 justify-center" onClick={() => toast.success('Invoice generated as PDF')}>
                  <FileText size={15} /> Invoice
                </Btn>
                <Btn variant="outline" className="flex-1 justify-center" onClick={() => toast.success('Shipping label created')}>
                  <Truck size={15} /> Label
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
