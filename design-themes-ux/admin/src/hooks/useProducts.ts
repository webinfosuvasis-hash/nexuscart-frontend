import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';

const unwrap = (r: any) => r?.data ?? r;

export function useProducts(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => api.get('/products', { params }).then(unwrap),
    staleTime: 30_000,
  });
}

export function useProductStats() {
  return useQuery({
    queryKey: ['products', 'stats'],
    queryFn: () => api.get('/products/stats').then(unwrap),
    staleTime: 30_000,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => api.get(`/products/${id}`).then(unwrap),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/products', data).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product created');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to create product'),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.put(`/products/${id}`, data).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product updated');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to update product'),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to delete product'),
  });
}

export function useBulkDeleteProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.post('/products/bulk-delete', { ids }).then(unwrap),
    onSuccess: (_, ids) => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success(`${ids.length} products deleted`);
    },
  });
}

export function useBulkStatusProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      api.patch('/products/bulk-status', { ids, status }).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Products updated');
    },
  });
}

export function useDuplicateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/products/${id}/duplicate`).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product duplicated');
    },
  });
}
