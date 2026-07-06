import React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Truck, Loader2, AlertTriangle, Clock, ExternalLink, PackageCheck, PackageX,
} from 'lucide-react';
import { useTracking } from '@/hooks/useCustomerShipment';
import { TimelineEntry, Shipment } from '@/lib/customerShipmentApi';
import { UI, SERIF } from '@/components/auth/AuthLayout';

const SHIPMENT_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#FEF3C7', text: '#92400E' },
  SHIPPED: { bg: '#E0E7FF', text: '#3730A3' },
  DELIVERED: { bg: '#D1FAE5', text: '#065F46' },
};

const ORDER_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#FEF3C7', text: '#92400E' },
  PROCESSING: { bg: '#DBEAFE', text: '#1E40AF' },
  SHIPPED: { bg: '#E0E7FF', text: '#3730A3' },
  DELIVERED: { bg: '#D1FAE5', text: '#065F46' },
  CANCELLED: { bg: '#FEE2E2', text: '#991B1B' },
  RETURNED: { bg: '#FEE2E2', text: '#991B1B' },
  REFUNDED: { bg: '#F3F4F6', text: '#374151' },
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

/** Renders the backend's own OrderStatusHistory verbatim — no client-side timeline computation. */
const Timeline: React.FC<{ history: TimelineEntry[] }> = ({ history }) => {
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

const ShipmentCard: React.FC<{ shipment: Shipment }> = ({ shipment }) => (
  <div className="bg-white rounded-xl shadow-sm p-6">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Truck className="w-4 h-4 text-purple-600" />
        <h2 className="text-[14px] font-bold text-gray-900">Shipment</h2>
      </div>
      <Badge label={shipment.status} styles={SHIPMENT_STATUS_STYLES[shipment.status]} />
    </div>

    <div className="text-[12.5px] text-gray-600 space-y-2">
      {shipment.carrier && (
        <div className="flex justify-between"><span>Carrier</span><span className="font-medium text-gray-800">{shipment.carrier}</span></div>
      )}

      {shipment.trackingNumber ? (
        <div className="flex justify-between items-center">
          <span>Tracking Number</span>
          {shipment.carrierUrl ? (
            <a
              href={shipment.carrierUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-purple-700 hover:underline flex items-center gap-1"
            >
              {shipment.trackingNumber} <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <span className="font-mono text-[11px] text-gray-700">{shipment.trackingNumber}</span>
          )}
        </div>
      ) : (
        <p className="text-gray-400">No tracking number available yet.</p>
      )}

      {/* Gracefully rendered when unavailable — no broken link, no placeholder URL. */}
      {shipment.trackingNumber && !shipment.carrierUrl && (
        <p className="text-[11px] text-gray-400">Tracking link not available from the carrier.</p>
      )}

      {shipment.deliveredAt ? (
        <div className="flex justify-between items-center pt-1">
          <span className="flex items-center gap-1.5"><PackageCheck className="w-3.5 h-3.5 text-green-600" /> Delivered</span>
          <span className="text-gray-700">{formatDateTime(shipment.deliveredAt)}</span>
        </div>
      ) : shipment.shippedAt ? (
        <div className="flex justify-between"><span>Shipped</span><span className="text-gray-700">{formatDateTime(shipment.shippedAt)}</span></div>
      ) : null}

      {shipment.expectedDelivery ? (
        <div className="flex justify-between"><span>Estimated Delivery</span><span className="text-gray-700">{formatDateTime(shipment.expectedDelivery)}</span></div>
      ) : (
        <p className="text-[11px] text-gray-400">Estimated delivery date not available.</p>
      )}
    </div>
  </div>
);

const AurusShipmentTracking: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { data: tracking, isLoading, isError, refetch } = useTracking(orderId, true);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F3FA]" style={UI}>
        <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
      </div>
    );
  }

  if (isError || !tracking) {
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
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 min-h-[54px] py-2 flex items-center gap-3">
          <button
            onClick={() => navigate(`/account/orders/${orderId}`)}
            className="text-gray-600 hover:text-purple-700 transition-colors flex items-center gap-1.5 text-[13px] flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back to Order</span>
          </button>
          <div className="flex-1 text-center min-w-0">
            <span className="text-[14px] sm:text-[18px] font-light text-gray-900 truncate block" style={SERIF}>
              Track {tracking.orderNumber}
            </span>
          </div>
          <div className="w-6 sm:w-[100px] flex-shrink-0" />
        </div>
      </header>

      <div className="max-w-[900px] mx-auto px-4 py-8 space-y-5">
        <div className="bg-white rounded-xl shadow-sm p-6 flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-[18px] font-bold text-gray-900" style={SERIF}>{tracking.orderNumber}</h1>
          <Badge label={tracking.orderStatus} styles={ORDER_STATUS_STYLES[tracking.orderStatus]} />
        </div>

        {tracking.shipments.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center">
            <PackageX className="w-10 h-10 text-purple-200 mx-auto mb-3" />
            <p className="text-[14px] font-semibold text-gray-700 mb-1">Not shipped yet.</p>
            <p className="text-[12.5px] text-gray-500 mb-3">We&apos;ll show tracking details here as soon as your order ships.</p>
            <Link to={`/account/orders/${orderId}`} className="text-[13px] text-purple-700 font-semibold hover:underline">
              Back to Order Details
            </Link>
          </div>
        ) : (
          tracking.shipments.map((shipment) => <ShipmentCard key={shipment.id} shipment={shipment} />)
        )}

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-purple-600" />
            <h2 className="text-[14px] font-bold text-gray-900">Tracking Timeline</h2>
          </div>
          <Timeline history={tracking.timeline} />
        </div>
      </div>
    </div>
  );
};

export default AurusShipmentTracking;
