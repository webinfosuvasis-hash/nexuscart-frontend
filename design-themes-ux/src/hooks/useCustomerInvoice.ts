import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as api from '@/lib/customerInvoiceApi';
import { CustomerAuthApiError } from '@/lib/customerAuthApi';

// A 404 here is definitive (order doesn't exist / isn't this customer's) —
// matches useCustomerOrders.ts / useCustomerShipment.ts / useCustomerCancellation.ts's convention.
function noRetryOn404(count: number, err: unknown): boolean {
  if (err instanceof CustomerAuthApiError && err.status === 404) return false;
  return count < 2;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof api.CustomerAuthApiError ? err.message : fallback;
}

export function useInvoiceData(orderId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['customer-order-invoice', orderId],
    queryFn: () => api.getInvoiceData(orderId!),
    enabled: enabled && !!orderId,
    staleTime: 30_000,
    gcTime: 300_000,
    retry: noRetryOn404,
  });
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function useDownloadInvoice(orderId: string | undefined, invoiceNumber: string | undefined) {
  return useMutation({
    mutationFn: () => api.getInvoicePdfBlob(orderId!),
    onSuccess: (blob) => {
      triggerBlobDownload(blob, `invoice-${invoiceNumber ?? orderId}.pdf`);
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to download invoice')),
  });
}

export { errorMessage as invoiceErrorMessage };
