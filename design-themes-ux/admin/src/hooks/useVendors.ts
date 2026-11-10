import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vendorService, type VendorInput, type VendorListParams } from '@/services/vendorService';
import type { Vendor } from '@/types';

const KEY = 'vendors';

type VendorListResponse = Vendor[] | { items?: Vendor[] } | undefined;

/** Vendors of the current store (the API scopes by the authenticated store). */
export const useVendors = (params?: VendorListParams) =>
  useQuery({
    queryKey: [KEY, params],
    // The api interceptor unwraps axios; `.data` is the TransformInterceptor payload.
    queryFn: () => vendorService.list({ limit: 200, ...params }).then((r) => (r as { data: VendorListResponse }).data),
    select: (d: VendorListResponse): Vendor[] => (Array.isArray(d) ? d : d?.items ?? []),
  });

export interface VendorPage {
  items: Vendor[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/** Paginated listing for the vendor management page. */
export const useVendorPage = (params: VendorListParams) =>
  useQuery({
    queryKey: [KEY, 'page', params],
    queryFn: () => vendorService.list(params).then((r) => (r as { data: VendorPage }).data),
    placeholderData: (prev) => prev, // keep rows visible while the next page loads
  });

// Vendor name/status also appear on product rows and the product form.
const useInvalidateVendors = () => {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: ['products'] });
  };
};

// Toasts are left to the caller, which knows whether to keep its dialog open.
export const useCreateVendor = () => {
  const invalidate = useInvalidateVendors();
  return useMutation({
    mutationFn: (data: VendorInput) => vendorService.create(data),
    onSuccess: invalidate,
  });
};

export const useUpdateVendor = () => {
  const invalidate = useInvalidateVendors();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VendorInput> }) => vendorService.update(id, data),
    onSuccess: invalidate,
  });
};
