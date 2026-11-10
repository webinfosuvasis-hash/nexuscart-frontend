import React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, Printer, Loader2, AlertTriangle, FileText,
} from 'lucide-react';
import { useInvoiceData, useDownloadInvoice } from '@/hooks/useCustomerInvoice';
import { InvoiceAddress, InvoiceLineItem } from '@/lib/customerInvoiceApi';
import { UI, SERIF } from '@/components/auth/AuthLayout';

const inr = (amount: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const AddressLines: React.FC<{ address: InvoiceAddress | null; showName?: boolean }> = ({ address, showName = true }) => {
  if (!address) return <p className="text-gray-400">Not available</p>;
  return (
    <>
      {showName && <p className="font-semibold text-gray-800">{address.firstName} {address.lastName}</p>}
      <p>{address.line1}{address.line2 ? `, ${address.line2}` : ''}</p>
      <p>{address.city}, {address.state} {address.postalCode}</p>
      <p>{address.country}</p>
      {address.phone && <p>Phone: {address.phone}</p>}
    </>
  );
};

const ItemRow: React.FC<{ item: InvoiceLineItem }> = ({ item }) => (
  <tr className="border-b border-gray-100">
    <td className="py-2.5 pr-2">
      <p className="font-medium text-gray-800">{item.productName}</p>
      {item.variantName && <p className="text-[11px] text-gray-500">{item.variantName}</p>}
    </td>
    <td className="py-2.5 pr-2 text-gray-600">{item.sku}</td>
    <td className="py-2.5 pr-2 text-gray-600">{item.hsn ?? '—'}</td>
    <td className="py-2.5 pr-2 text-right text-gray-600">{item.quantity}</td>
    <td className="py-2.5 pr-2 text-right text-gray-600">{inr(item.unitPrice)}</td>
    <td className="py-2.5 pr-2 text-right text-gray-600">{item.discount > 0 ? `− ${inr(item.discount)}` : '—'}</td>
    <td className="py-2.5 pr-2 text-right text-gray-600">{inr(item.taxAmount)}</td>
    <td className="py-2.5 text-right font-semibold text-gray-900">{inr(item.total)}</td>
  </tr>
);

const AurusInvoice: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading, isError, refetch } = useInvoiceData(orderId, true);
  const downloadMutation = useDownloadInvoice(orderId, invoice?.invoiceNumber);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F3FA]" style={UI}>
        <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
      </div>
    );
  }

  if (isError || !invoice) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F3FA] px-4" style={UI}>
        <AlertTriangle className="w-14 h-14 text-red-300 mb-4" />
        <p className="text-[16px] font-semibold text-gray-700 mb-2 text-center">
          We couldn&apos;t find this invoice, or something went wrong.
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

  const { seller, buyer, taxBreakdown, totals } = invoice;

  return (
    <div className="min-h-screen bg-[#F5F3FA] print:bg-white" style={UI}>
      <header className="bg-white border-b border-gray-200 print:hidden">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 min-h-[54px] py-2 flex items-center gap-3">
          <button
            onClick={() => navigate(`/account/orders/${orderId}`)}
            className="text-gray-600 hover:text-purple-700 transition-colors flex items-center gap-1.5 text-[13px] flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back to Order</span>
          </button>
          <div className="flex-1 text-center min-w-0">
            <span className="text-[14px] sm:text-[18px] font-light text-gray-900 truncate block" style={SERIF}>
              Invoice {invoice.invoiceNumber}
            </span>
          </div>
          <div className="w-6 sm:w-[100px] flex-shrink-0" />
        </div>
      </header>

      <div className="max-w-[900px] mx-auto px-4 py-6 print:hidden flex flex-wrap gap-3">
        <button
          onClick={() => downloadMutation.mutate()}
          disabled={downloadMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-purple-700 hover:bg-purple-800 text-white font-bold text-[13px] tracking-wide transition-colors disabled:opacity-60"
        >
          {downloadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download Invoice
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold text-[13px] transition-colors"
        >
          <Printer className="w-4 h-4" /> Print Invoice
        </button>
      </div>

      {/* ── Invoice sheet — this is also the print layout (@media print via `print:` utilities) ── */}
      <div className="max-w-[900px] mx-auto px-4 pb-16 print:px-0 print:pb-0 print:max-w-full">
        <div className="bg-white rounded-xl shadow-sm p-8 print:shadow-none print:rounded-none print:p-6 text-[12.5px] text-gray-700">
          {/* Seller + invoice meta */}
          <div className="flex flex-wrap justify-between gap-6 pb-6 border-b border-gray-200">
            <div className="max-w-[320px]">
              {seller.logo && (
                <img src={seller.logo} alt={seller.storeName} className="h-10 mb-2 object-contain" loading="lazy" />
              )}
              <p className="text-[16px] font-bold text-gray-900" style={SERIF}>{seller.legalBusinessName ?? seller.storeName}</p>
              {seller.gstin && <p className="mt-1">GSTIN: {seller.gstin}</p>}
              {seller.address && (
                <p className="mt-1">
                  {[seller.address.line1, seller.address.line2, seller.address.city, seller.address.state, seller.address.postalCode, seller.address.country]
                    .filter(Boolean).join(', ')}
                </p>
              )}
              {seller.phone && <p className="mt-1">Phone: {seller.phone}</p>}
              {seller.email && <p>Email: {seller.email}</p>}
            </div>
            <div className="text-right">
              <p className="text-[18px] font-bold text-gray-900 flex items-center gap-2 justify-end" style={SERIF}>
                <FileText className="w-4 h-4 text-purple-600" /> TAX INVOICE
              </p>
              <p className="mt-2">Invoice #: <span className="font-semibold text-gray-900">{invoice.invoiceNumber}</span></p>
              <p>Invoice Date: {formatDate(invoice.invoiceDate)}</p>
              <p>Order #: {invoice.order.orderNumber}</p>
              <p>Order Date: {formatDate(invoice.order.createdAt)}</p>
            </div>
          </div>

          {/* Buyer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-gray-200">
            <div>
              <p className="font-bold text-gray-900 mb-1.5">Bill To</p>
              <p className="font-semibold text-gray-800">{buyer.name}</p>
              <AddressLines address={buyer.billingAddress} showName={false} />
              {buyer.email && <p>{buyer.email}</p>}
            </div>
            <div>
              <p className="font-bold text-gray-900 mb-1.5">Ship To</p>
              <AddressLines address={buyer.shippingAddress} />
            </div>
          </div>

          {/* Items */}
          <div className="py-6 border-b border-gray-200 overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b-2 border-gray-800 text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="text-left font-semibold pb-2 pr-2">Product</th>
                  <th className="text-left font-semibold pb-2 pr-2">SKU</th>
                  <th className="text-left font-semibold pb-2 pr-2">HSN</th>
                  <th className="text-right font-semibold pb-2 pr-2">Qty</th>
                  <th className="text-right font-semibold pb-2 pr-2">Unit Price</th>
                  <th className="text-right font-semibold pb-2 pr-2">Discount</th>
                  <th className="text-right font-semibold pb-2 pr-2">Tax</th>
                  <th className="text-right font-semibold pb-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, i) => <ItemRow key={i} item={item} />)}
              </tbody>
            </table>
          </div>

          {/* Totals + GST breakdown */}
          <div className="py-6 border-b border-gray-200 flex justify-end">
            <div className="w-full sm:w-[280px] space-y-1.5">
              <div className="flex justify-between"><span>Subtotal</span><span>{inr(totals.subtotal)}</span></div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>{totals.couponCode ? `Discount (${totals.couponCode})` : 'Discount'}</span>
                  <span>− {inr(totals.discount)}</span>
                </div>
              )}
              {taxBreakdown.taxType === 'INTRA_STATE' ? (
                <>
                  <div className="flex justify-between"><span>CGST</span><span>{inr(taxBreakdown.cgst ?? 0)}</span></div>
                  <div className="flex justify-between"><span>SGST</span><span>{inr(taxBreakdown.sgst ?? 0)}</span></div>
                </>
              ) : taxBreakdown.taxType === 'INTER_STATE' ? (
                <div className="flex justify-between"><span>IGST</span><span>{inr(taxBreakdown.igst ?? 0)}</span></div>
              ) : (
                <div className="flex justify-between"><span>Tax</span><span>{inr(taxBreakdown.totalTax)}</span></div>
              )}
              <div className="flex justify-between"><span>Shipping</span><span>{totals.shippingCost === 0 ? 'FREE' : inr(totals.shippingCost)}</span></div>
              <div className="h-px bg-gray-300 my-1" />
              <div className="flex justify-between text-[14px] font-bold text-gray-900"><span>Grand Total</span><span>{inr(totals.total)}</span></div>
              {totals.refundedAmount > 0 && (
                <div className="flex justify-between text-red-600"><span>Refunded</span><span>{inr(totals.refundedAmount)}</span></div>
              )}
            </div>
          </div>

          {/* Payment + Shipment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6">
            <div>
              <p className="font-bold text-gray-900 mb-1.5">Payment</p>
              {invoice.payment ? (
                <>
                  <p>Status: {invoice.payment.status}</p>
                  <p>Gateway: {invoice.payment.gatewayCode}</p>
                  {invoice.payment.transactionId && <p className="break-all">Transaction ID: {invoice.payment.transactionId}</p>}
                  {invoice.payment.paidAt && <p>Paid: {formatDate(invoice.payment.paidAt)}</p>}
                </>
              ) : <p className="text-gray-400">No payment recorded</p>}
            </div>
            <div>
              <p className="font-bold text-gray-900 mb-1.5">Shipment</p>
              {invoice.shipment ? (
                <>
                  <p>Tracking #: {invoice.shipment.trackingNumber ?? 'Not available'}</p>
                  <p>Carrier: {invoice.shipment.carrier ?? 'Not available'}</p>
                  <p>Delivered: {invoice.shipment.deliveredAt ? formatDate(invoice.shipment.deliveredAt) : 'Not yet delivered'}</p>
                </>
              ) : <p className="text-gray-400">Not shipped yet</p>}
            </div>
          </div>

          <p className="text-[10.5px] text-gray-400 text-center mt-8 pt-4 border-t border-gray-100">
            This is a computer-generated invoice and does not require a signature.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AurusInvoice;
