import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';

const unwrap = (r: any) => r?.data ?? r;

export function useInventoryStats() {
  return useQuery({
    queryKey: ['inventory', 'stats'],
    queryFn: () => api.get('/inventory/stats').then(unwrap),
    staleTime: 30_000,
  });
}

export function useWarehouses() {
  return useQuery({
    queryKey: ['inventory', 'warehouses'],
    queryFn: () => api.get('/inventory/warehouses').then(unwrap),
    staleTime: 60_000,
  });
}

export function useSuppliers(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['inventory', 'suppliers', params],
    queryFn: () => api.get('/inventory/suppliers', { params }).then(unwrap),
    staleTime: 60_000,
  });
}

export function useStockMovements(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['inventory', 'movements', params],
    queryFn: () => api.get('/inventory/movements', { params }).then(unwrap),
    staleTime: 30_000,
  });
}

export function usePurchaseOrders(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['inventory', 'purchase-orders', params],
    queryFn: () => api.get('/inventory/purchase-orders', { params }).then(unwrap),
    staleTime: 30_000,
  });
}

export function useCreateMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/inventory/movements', data).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Stock movement recorded');
    },
  });
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/inventory/purchase-orders', data).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'purchase-orders'] });
      toast.success('Purchase order created');
    },
  });
}

export function useReceivePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/inventory/purchase-orders/${id}/receive`).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Purchase order received — stock updated');
    },
  });
}
