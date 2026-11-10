import React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Package, MapPin, CreditCard, Truck, Loader2, AlertTriangle, Clock, ExternalLink, Ban, FileText,
} from 'lucide-react';
import { inr } from '@/context/StoreContext';
import { useOrderDetails } from '@/hooks/useCustomerOrders';
import { OrderAddress, OrderStatusHistoryEntry } from '@/lib/customerOrdersApi';
import { UI, SERIF } from '@/components/auth/AuthLayout';

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

const formatDateTime = (iso: string | null): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
};

const SectionCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="bg-white rounded-xl shadow-sm p-6">
    <div className="flex items-center gap-2 mb-4">
      {icon}
      <h2 className="text-[14px] font-bold text-gray-900">{title}</h2>
    </div>
    {children}
  </div>
);

const AddressBlock: React.FC<{ address: OrderAddress | null }> = ({ address }) => {
  if (!address) return <p className="text-[12.5px] text-gray-400">Not available</p>;
  return (
    <div className="text-[12.5px] text-gray-600 space-y-0.5">
      <p className="font-semibold text-gray-800">{address.firstName} {address.lastName}</p>
      <p>{address.line1}{address.line2 ? `, ${address.line2}` : ''}</p>
      <p>{address.city}, {address.state} {address.postalCode}</p>
      <p>{address.country}</p>
      {address.phone && <p>{address.phone}</p>}
    </div>
  );
};

/** Renders the backend's own OrderStatusHistory rows verbatim — no client-side timeline computation. */
const Timeline: React.FC<{ history: OrderStatusHistoryEntry[] }> = ({ history }) => {
  if (history.length === 0) return <p className="text-[12.5px] text-gray-400">No status history yet.</p>;
  return (
    <div className="space-y-4">
      {history.map((entry, i) => (
        <div key={entry.id} className="flex gap-3">
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-600 mt-1" />
            {i < history.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
          </div>
          <div className="pb-4">
            <p className="text-[12.5px] font-semibold text-gray-800">{entry.status}</p>
            {entry.note && <p className="text-[12px] text-gray-500">{entry.note}</p>}
            <p className="text-[11px] text-gray-400 mt-0.5">{formatDateTime(entry.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const AurusOrderDetails: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading, isError, refetch } = useOrderDetails(orderId, true);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F3FA]" style={UI}>
        <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F3FA] px-4" style={UI}>
        <AlertTriangle className="w-14 h-14 text-red-300 mb-4" />
        <p className="text-[16px] font-semibold text-gray-700 mb-2 text-center">
          We couldn&apos;t find this order, or something went wrong.
        </p>
        <div className="flex gap-4 mt-2">
          <button onClick={() => refetch()} className="text-[13px] text-purple-700 font-semibold hover:underline">
            Try again
          </button>
          <Link to="/account/orders" className="text-[13px] text-purple-700 font-semibold hover:underline">
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F3FA]" style={UI}>
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 min-h-[54px] py-2 flex items-center gap-3 sm:gap-4">
          <button onClick={() => navigate('/account/orders')} className="text-gray-600 hover:text-purple-700 transition-colors flex items-center gap-1.5 text-[13px] flex-shrink-0">
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back to Orders</span>
          </button>
          <div className="flex-1 text-center min-w-0">
            <span className="text-[14px] sm:text-[18px] font-light text-gray-900 truncate block" style={SERIF}>{order.orderNumber}</span>
          </div>
          <div className="w-6 sm:w-[110px] flex-shrink-0" />
        </div>
      </header>

      <div className="max-w-[1280px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* ── LEFT ── */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
              <h1 className="text-[18px] font-bold text-gray-900" style={SERIF}>{order.orderNumber}</h1>
              <div className="flex gap-2">
                <Badge label={order.status} styles={ORDER_STATUS_STYLES[order.status]} />
                <Badge label={order.paymentStatus} styles={PAYMENT_STATUS_STYLES[order.paymentStatus]} />
              </div>
            </div>
            <p className="text-[12.5px] text-gray-500">Placed on {formatDateTime(order.createdAt)}</p>
            {order.cancelledAt && (
              <p className="text-[12.5px] text-red-600 mt-2">
                Cancelled on {formatDateTime(order.cancelledAt)}{order.cancellationReason ? ` — ${order.cancellationReason}` : ''}
              </p>
            )}
          </div>

          <SectionCard icon={<Clock className="w-4 h-4 text-purple-600" />} title="Order Timeline">
            <Timeline history={order.statusHistory} />
          </SectionCard>

          <SectionCard icon={<Package className="w-4 h-4 text-purple-600" />} title={`Products (${order.items.length})`}>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {item.thumbnail && <img src={item.thumbnail} alt={item.productName} loading="lazy" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 line-clamp-1">{item.productName}</p>
                    {item.variantName && <p className="text-[11.5px] text-gray-500">{item.variantName}</p>}
                    {item.variantOptions && (
                      <p className="text-[11px] text-gray-400">
                        {Object.entries(item.variantOptions).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Qty: {item.quantity} × {inr(item.unitPrice)}
                      {item.lineDiscount > 0 && <span className="text-green-600"> · − {inr(item.lineDiscount)} discount</span>}
                      {item.taxAmount > 0 && <span> · Tax {inr(item.taxAmount)}</span>}
                    </p>
                  </div>
                  <span className="text-[13px] font-bold text-gray-900 flex-shrink-0">{inr(item.total)}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <SectionCard icon={<MapPin className="w-4 h-4 text-purple-600" />} title="Shipping Address">
              <AddressBlock address={order.shippingAddress} />
            </SectionCard>
            <SectionCard icon={<MapPin className="w-4 h-4 text-purple-600" />} title="Billing Address">
              <AddressBlock address={order.billingAddress} />
            </SectionCard>
          </div>
        </div>

        {/* ── RIGHT ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm px-5 py-4 space-y-2.5">
            <h2 className="text-[13px] font-bold text-gray-900 mb-1">Order Totals</h2>
            <PriceRow label="Subtotal" value={inr(order.totals.subtotal)} />
            {order.totals.discount > 0 && <PriceRow label="Discount" value={`− ${inr(order.totals.discount)}`} valueColor="#00897B" />}
            {order.totals.couponCode && <PriceRow label={`Coupon (${order.totals.couponCode})`} value="" />}
            <PriceRow label="Shipping" value={order.totals.shippingCost === 0 ? 'FREE' : inr(order.totals.shippingCost)} />
            <PriceRow label="Tax" value={inr(order.totals.tax)} />
            <div className="h-px bg-gray-200 my-1" />
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-gray-900">Grand Total</span>
              <span className="text-[16px] font-black text-gray-900">{inr(order.totals.total)}</span>
            </div>
            {order.totals.refundedAmount > 0 && (
              <PriceRow label="Refunded" value={inr(order.totals.refundedAmount)} valueColor="#DC2626" />
            )}
          </div>

          <SectionCard icon={<CreditCard className="w-4 h-4 text-purple-600" />} title="Payment Information">
            <div className="text-[12.5px] text-gray-600 space-y-1.5">
              <div className="flex justify-between">
                <span>Status</span>
                <Badge label={order.paymentStatus} styles={PAYMENT_STATUS_STYLES[order.paymentStatus]} />
              </div>
              {order.paymentMethod && (
                <div className="flex justify-between"><span>Method</span><span className="font-medium text-gray-800">{order.paymentMethod}</span></div>
              )}
              {order.transaction ? (
                <>
                  <div className="flex justify-between"><span>Transaction ID</span><span className="font-mono text-[11px] text-gray-700">{order.transaction.id}</span></div>
                  <div className="flex justify-between"><span>Gateway</span><span className="font-medium text-gray-800">{order.transaction.gatewayCode}</span></div>
                  {order.transaction.capturedAt && (
                    <div className="flex justify-between"><span>Captured</span><span className="text-gray-700">{formatDateTime(order.transaction.capturedAt)}</span></div>
                  )}
                </>
              ) : (
                <p className="text-gray-400">No transaction details available.</p>
              )}
            </div>
          </SectionCard>

          <SectionCard icon={<FileText className="w-4 h-4 text-purple-600" />} title="Invoice">
            <p className="text-[12.5px] text-gray-500 mb-3">
              View, download, or print the tax invoice for this order.
            </p>
            <Link
              to={`/account/orders/${order.id}/invoice`}
              className="block text-[12.5px] font-semibold text-purple-700 hover:underline"
            >
              View Invoice →
            </Link>
          </SectionCard>

          <SectionCard icon={<Truck className="w-4 h-4 text-purple-600" />} title="Shipment Information">
            {order.shipments.length === 0 ? (
              <p className="text-[12.5px] text-gray-400">Not shipped yet.</p>
            ) : (
              <div className="space-y-4">
                {order.shipments.map((shipment) => (
                  <div key={shipment.id} className="text-[12.5px] text-gray-600 space-y-1.5">
                    <div className="flex justify-between"><span>Status</span><span className="font-medium text-gray-800">{shipment.status}</span></div>
                    {shipment.carrier && (
                      <div className="flex justify-between"><span>Carrier</span><span className="font-medium text-gray-800">{shipment.carrier}</span></div>
                    )}
                    {shipment.trackingNumber && (
                      <div className="flex justify-between items-center">
                        <span>Tracking Number</span>
                        {shipment.carrierUrl ? (
                          <a href={shipment.carrierUrl} target="_blank" rel="noreferrer" className="font-medium text-purple-700 hover:underline flex items-center gap-1">
                            {shipment.trackingNumber} <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="font-mono text-[11px] text-gray-700">{shipment.trackingNumber}</span>
                        )}
                      </div>
                    )}
                    {shipment.shippedAt && (
                      <div className="flex justify-between"><span>Shipped</span><span className="text-gray-700">{formatDateTime(shipment.shippedAt)}</span></div>
                    )}
                    {shipment.deliveredAt && (
                      <div className="flex justify-between"><span>Delivered</span><span className="text-gray-700">{formatDateTime(shipment.deliveredAt)}</span></div>
                    )}
                    {shipment.expectedDelivery && (
                      <div className="flex justify-between"><span>Expected Delivery</span><span className="text-gray-700">{formatDateTime(shipment.expectedDelivery)}</span></div>
                    )}
                  </div>
                ))}
                <Link
                  to={`/account/orders/${order.id}/tracking`}
                  className="block text-[12.5px] font-semibold text-purple-700 hover:underline pt-1"
                >
                  Track Shipment →
                </Link>
              </div>
            )}
          </SectionCard>

          {(order.status === 'PENDING' || order.status === 'PROCESSING' || order.status === 'CANCELLED') && (
            <SectionCard icon={<Ban className="w-4 h-4 text-purple-600" />} title="Cancellation & Refund">
              <p className="text-[12.5px] text-gray-500 mb-3">
                {order.status === 'CANCELLED'
                  ? 'View the cancellation details and refund status for this order.'
                  : 'Changed your mind? You can request cancellation while this order is still being processed.'}
              </p>
              <Link
                to={`/account/orders/${order.id}/cancel`}
                className="block text-[12.5px] font-semibold text-purple-700 hover:underline"
              >
                {order.status === 'CANCELLED' ? 'View Refund Status →' : 'Cancel Order →'}
              </Link>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
};

const PriceRow: React.FC<{ label: string; value: string; valueColor?: string }> = ({ label, value, valueColor }) => (
  <div className="flex items-center justify-between text-[12.5px]" style={UI}>
    <span className="text-gray-500">{label}</span>
    <span className="font-semibold" style={{ color: valueColor ?? '#1F2937' }}>{value}</span>
  </div>
);

export default AurusOrderDetails;
