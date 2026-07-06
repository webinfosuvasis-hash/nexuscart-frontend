import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Package, Search, Loader2, AlertTriangle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { inr } from '@/context/StoreContext';
import { useOrders } from '@/hooks/useCustomerOrders';
import { OrderListItem, OrderStatusFilter } from '@/lib/customerOrdersApi';
import { UI, SERIF } from '@/components/auth/AuthLayout';

const STATUS_FILTERS: { value: OrderStatusFilter | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAID', label: 'Paid' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const ORDER_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#FEF3C7', text: '#92400E' },
  PROCESSING: { bg: '#DBEAFE', text: '#1E40AF' },
  SHIPPED: { bg: '#E0E7FF', text: '#3730A3' },
  DELIVERED: { bg: '#D1FAE5', text: '#065F46' },
  CANCELLED: { bg: '#FEE2E2', text: '#991B1B' },
  RETURNED: { bg: '#FEE2E2', text: '#991B1B' },
  REFUNDED: { bg: '#F3F4F6', text: '#374151' },
};

const PAYMENT_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#FEF3C7', text: '#92400E' },
  AUTHORIZED: { bg: '#DBEAFE', text: '#1E40AF' },
  PAID: { bg: '#D1FAE5', text: '#065F46' },
  CAPTURED: { bg: '#D1FAE5', text: '#065F46' },
  FAILED: { bg: '#FEE2E2', text: '#991B1B' },
  CANCELLED: { bg: '#FEE2E2', text: '#991B1B' },
  REFUNDED: { bg: '#F3F4F6', text: '#374151' },
  PARTIAL: { bg: '#FEF3C7', text: '#92400E' },
  PARTIALLY_REFUNDED: { bg: '#F3F4F6', text: '#374151' },
};

const Badge: React.FC<{ label: string; styles?: { bg: string; text: string } }> = ({ label, styles }) => (
  <span
    className="inline-block text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
    style={{ background: styles?.bg ?? '#F3F4F6', color: styles?.text ?? '#374151' }}
  >
    {label}
  </span>
);

const OrderCard: React.FC<{ order: OrderListItem }> = ({ order }) => (
  <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
    <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
      {order.thumbnail ? (
        <img src={order.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Package className="w-6 h-6 text-gray-300" />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <p className="text-[13px] font-bold text-gray-900">{order.orderNumber}</p>
        <Badge label={order.status} styles={ORDER_STATUS_STYLES[order.status]} />
        <Badge label={order.paymentStatus} styles={PAYMENT_STATUS_STYLES[order.paymentStatus]} />
      </div>
      <p className="text-[11.5px] text-gray-500">
        {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        {' · '}{order.itemCount} item{order.itemCount > 1 ? 's' : ''}
      </p>
    </div>
    <div className="text-right flex-shrink-0">
      <p className="text-[14px] font-black text-gray-900 mb-2">{inr(order.total)}</p>
      <Link
        to={`/account/orders/${order.id}`}
        className="text-[12px] font-semibold text-purple-700 hover:underline"
      >
        View Details
      </Link>
    </div>
  </div>
);

const AurusOrderHistory: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<OrderStatusFilter | 'ALL'>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useOrders(
    { page, limit: 10, status: status === 'ALL' ? undefined : status, search: search || undefined },
    true,
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleStatusChange = (value: OrderStatusFilter | 'ALL') => {
    setStatus(value);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-[#F5F3FA]" style={UI}>
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-[1280px] mx-auto px-6 h-[54px] flex items-center gap-4">
          <Link to="/account" className="text-gray-600 hover:text-purple-700 transition-colors flex items-center gap-1.5 text-[13px]">
            <ArrowLeft className="w-4 h-4" /> Back to Account
          </Link>
          <div className="flex-1 text-center">
            <span className="text-[18px] font-light text-gray-900" style={SERIF}>My Orders</span>
          </div>
          <div className="w-[110px]" />
        </div>
      </header>

      <div className="max-w-[900px] mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-5">
          <Package className="w-5 h-5 text-purple-600" />
          <h1 className="text-[20px] font-bold text-gray-900" style={SERIF}>Order History</h1>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by order number"
              className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-[13px] outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-[13px] font-bold rounded-lg transition-colors"
          >
            Search
          </button>
        </form>

        {/* Status filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => handleStatusChange(f.value)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-[12px] font-semibold transition-colors border"
              style={{
                borderColor: status === f.value ? '#7C3AED' : '#E5E7EB',
                background: status === f.value ? '#7C3AED' : '#fff',
                color: status === f.value ? '#fff' : '#6B7280',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        )}

        {isError && !isLoading && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <AlertTriangle className="w-8 h-8 text-red-300 mx-auto mb-3" />
            <p className="text-[13px] text-gray-600 mb-4">Something went wrong loading your orders.</p>
            <button onClick={() => refetch()} className="text-[13px] text-purple-700 font-semibold hover:underline">
              Try again
            </button>
          </div>
        )}

        {!isLoading && !isError && data && data.items.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center">
            <Package className="w-10 h-10 text-purple-200 mx-auto mb-3" />
            <p className="text-[14px] font-semibold text-gray-700 mb-1">
              {search || status !== 'ALL' ? 'No orders match your search or filter.' : 'No orders yet.'}
            </p>
            {!search && status === 'ALL' && (
              <button onClick={() => navigate('/')} className="text-[13px] text-purple-700 font-semibold hover:underline mt-2">
                Start Shopping
              </button>
            )}
          </div>
        )}

        {!isLoading && !isError && data && data.items.length > 0 && (
          <>
            <div className="space-y-3 mb-6">
              {data.items.map((order) => <OrderCard key={order.id} order={order} />)}
            </div>

            {data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={data.pagination.page <= 1}
                  className="flex items-center gap-1 text-[12.5px] font-semibold text-gray-600 disabled:opacity-40 hover:text-purple-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <span className="text-[12.5px] text-gray-500">
                  Page {data.pagination.page} of {data.pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                  disabled={data.pagination.page >= data.pagination.totalPages}
                  className="flex items-center gap-1 text-[12.5px] font-semibold text-gray-600 disabled:opacity-40 hover:text-purple-700 transition-colors"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AurusOrderHistory;
