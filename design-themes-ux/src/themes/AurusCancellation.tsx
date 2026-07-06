import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Ban, Loader2, AlertTriangle, Clock, RefreshCcw, ShieldCheck, XCircle,
} from 'lucide-react';
import { useCancellationStatus, useRefundStatus, useCancelOrder } from '@/hooks/useCustomerCancellation';
import { CancellationTimelineEntry } from '@/lib/customerCancellationApi';
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

const REFUND_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#FEF3C7', text: '#92400E' },
  COMPLETED: { bg: '#D1FAE5', text: '#065F46' },
  FAILED: { bg: '#FEE2E2', text: '#991B1B' },
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

const inr = (amount: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

const SectionCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="bg-white rounded-xl shadow-sm p-6">
    <div className="flex items-center gap-2 mb-4">
      {icon}
      <h2 className="text-[14px] font-bold text-gray-900">{title}</h2>
    </div>
    {children}
  </div>
);

/** Renders the backend's own OrderStatusHistory verbatim — no client-side timeline computation. */
const Timeline: React.FC<{ history: CancellationTimelineEntry[] }> = ({ history }) => {
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

/* ─── Confirmation dialog ─────────────────────────────────────────── */
const ConfirmCancelDialog: React.FC<{
  orderNumber: string;
  reason: string;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ orderNumber, reason, isPending, onConfirm, onClose }) => (
  <div
    className="fixed inset-0 z-[200] flex items-center justify-center px-4"
    style={{ background: 'rgba(0,0,0,0.55)' }}
    role="dialog"
    aria-modal="true"
    aria-label="Confirm order cancellation"
  >
    <div className="bg-white rounded-2xl shadow-2xl max-w-[420px] w-full p-8" style={UI}>
      <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
        <Ban className="w-8 h-8 text-red-500" strokeWidth={2} />
      </div>
      <h2 className="text-[18px] font-bold text-gray-900 mb-1 text-center">Cancel this order?</h2>
      <p className="text-[13px] text-gray-500 mb-4 text-center">
        Order <span className="font-semibold text-gray-700">{orderNumber}</span> will be cancelled and any eligible
        payment will be refunded. This action cannot be undone.
      </p>
      <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 mb-6">
        <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold mb-1">Reason</p>
        <p className="text-[13px] text-gray-700">{reason}</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onClose}
          disabled={isPending}
          className="flex-1 py-3 rounded-full border border-gray-200 text-gray-700 font-semibold text-[13px] hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Go Back
        </button>
        <button
          onClick={onConfirm}
          disabled={isPending}
          className="flex-1 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-[13px] tracking-wide transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {isPending ? 'Cancelling…' : 'Yes, Cancel Order'}
        </button>
      </div>
    </div>
  </div>
);

const AurusCancellation: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [reason, setReason] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: cancellation, isLoading, isError, refetch } = useCancellationStatus(orderId, true);
  const { data: refund, isLoading: refundLoading } = useRefundStatus(orderId, !!cancellation);
  const cancelMutation = useCancelOrder(orderId);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F3FA]" style={UI}>
        <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
      </div>
    );
  }

  if (isError || !cancellation) {
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

  const reasonValid = reason.trim().length > 0 && reason.trim().length <= 500;

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
              Cancel {cancellation.orderNumber}
            </span>
          </div>
          <div className="w-6 sm:w-[100px] flex-shrink-0" />
        </div>
      </header>

      <div className="max-w-[900px] mx-auto px-4 py-8 space-y-5">
        <div className="bg-white rounded-xl shadow-sm p-6 flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-[18px] font-bold text-gray-900" style={SERIF}>{cancellation.orderNumber}</h1>
          <Badge label={cancellation.orderStatus} styles={ORDER_STATUS_STYLES[cancellation.orderStatus]} />
        </div>

        {cancellation.isCancelled ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <XCircle className="w-10 h-10 text-red-300 mx-auto mb-3" />
            <p className="text-[14px] font-semibold text-gray-700 mb-1">This order has been cancelled.</p>
            <p className="text-[12.5px] text-gray-500 mb-1">Cancelled on {formatDateTime(cancellation.cancelledAt)}</p>
            {cancellation.cancellationReason && (
              <p className="text-[12.5px] text-gray-500">Reason: {cancellation.cancellationReason}</p>
            )}
          </div>
        ) : cancellation.canCancel ? (
          <SectionCard icon={<Ban className="w-4 h-4 text-purple-600" />} title="Request Cancellation">
            <label htmlFor="cancel-reason" className="block text-[12px] font-semibold text-gray-600 mb-2">
              Why are you cancelling this order?
            </label>
            <textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="e.g. Ordered by mistake, found a better price, no longer needed…"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[13px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-[11px] text-gray-400">{reason.trim().length}/500</p>
            </div>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={!reasonValid}
              className="mt-4 w-full py-3 rounded-full bg-purple-700 hover:bg-purple-800 text-white font-bold text-[13px] tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Request Cancellation
            </button>
          </SectionCard>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <ShieldCheck className="w-10 h-10 text-purple-200 mx-auto mb-3" />
            <p className="text-[14px] font-semibold text-gray-700 mb-1">This order can no longer be cancelled.</p>
            <p className="text-[12.5px] text-gray-500">
              Orders that have already shipped or been delivered follow our standard returns process instead.
            </p>
          </div>
        )}

        <SectionCard icon={<RefreshCcw className="w-4 h-4 text-purple-600" />} title="Refund Status">
          {refundLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-purple-400" /></div>
          ) : !refund?.hasRefund || !refund.refund ? (
            <p className="text-[12.5px] text-gray-400">No refund has been issued for this order.</p>
          ) : (
            <div className="text-[12.5px] text-gray-600 space-y-2">
              <div className="flex justify-between items-center">
                <span>Status</span>
                <Badge label={refund.refund.status} styles={REFUND_STATUS_STYLES[refund.refund.status]} />
              </div>
              <div className="flex justify-between"><span>Refund Amount</span><span className="font-bold text-gray-900">{inr(refund.refund.amount)}</span></div>
              {refund.refund.reason && (
                <div className="flex justify-between gap-4"><span>Reason</span><span className="text-right text-gray-700">{refund.refund.reason}</span></div>
              )}
              {refund.refund.gatewayRefundId ? (
                <div className="flex flex-col gap-0.5">
                  <span>Refund Transaction ID</span>
                  <span className="font-mono text-[11px] text-gray-700 break-all">{refund.refund.gatewayRefundId}</span>
                </div>
              ) : (
                <p className="text-[11px] text-gray-400">
                  {refund.refund.status === 'PENDING'
                    ? 'This refund is processed outside the gateway (e.g. bank transfer) and has no transaction id yet.'
                    : 'No gateway transaction id available.'}
                </p>
              )}
              <div className="flex justify-between"><span>Initiated</span><span className="text-gray-700">{formatDateTime(refund.refund.createdAt)}</span></div>
            </div>
          )}
        </SectionCard>

        <SectionCard icon={<Clock className="w-4 h-4 text-purple-600" />} title="Order Timeline">
          <Timeline history={cancellation.timeline} />
        </SectionCard>
      </div>

      {showConfirm && (
        <ConfirmCancelDialog
          orderNumber={cancellation.orderNumber}
          reason={reason.trim()}
          isPending={cancelMutation.isPending}
          onClose={() => setShowConfirm(false)}
          onConfirm={() => {
            cancelMutation.mutate(reason.trim(), { onSuccess: () => setShowConfirm(false) });
          }}
        />
      )}
    </div>
  );
};

export default AurusCancellation;
