import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as api from '@/lib/customerAddressApi';

export const ADDRESSES_QUERY_KEY = ['customer-addresses'] as const;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof api.CustomerAuthApiError ? err.message : fallback;
}

export function useAddresses(enabled: boolean) {
  return useQuery({
    queryKey: ADDRESSES_QUERY_KEY,
    queryFn: api.listAddresses,
    enabled,
    staleTime: 30_000,
    gcTime: 300_000,
  });
}

export function useCreateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createAddress,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADDRESSES_QUERY_KEY });
      toast.success('Address added');
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to add address')),
  });
}

export function useUpdateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.UpdateCustomerAddressInput }) => api.updateAddress(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADDRESSES_QUERY_KEY });
      toast.success('Address updated');
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to update address')),
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteAddress,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADDRESSES_QUERY_KEY });
      toast.success('Address deleted');
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to delete address')),
  });
}

export function useSetDefaultShipping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.setDefaultShipping,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADDRESSES_QUERY_KEY });
      toast.success('Default shipping address updated');
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to set default shipping address')),
  });
}

export function useSetDefaultBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.setDefaultBilling,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADDRESSES_QUERY_KEY });
      toast.success('Default billing address updated');
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to set default billing address')),
  });
}
