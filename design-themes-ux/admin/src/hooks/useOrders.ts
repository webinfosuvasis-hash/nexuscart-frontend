import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';

const unwrap = (r: any) => r?.data ?? r;

export function useOrders(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () => api.get('/orders', { params }).then(unwrap),
    staleTime: 20_000,
  });
}

export function useOrderStats() {
  return useQuery({
    queryKey: ['orders', 'stats'],
    queryFn: () => api.get('/orders/stats').then(unwrap),
    staleTime: 30_000,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: () => api.get(`/orders/${id}`).then(unwrap),
    enabled: !!id,
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      api.patch(`/orders/${id}/status`, { status, note }).then(unwrap),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['orders', id] });
      toast.success('Order status updated');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to update status'),
  });
}

export function useAddOrderNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.post(`/orders/${id}/notes`, { content }).then(unwrap),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['orders', id] });
      toast.success('Note added');
    },
  });
}

export function useAddShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [k: string]: any }) =>
      api.post(`/orders/${id}/shipment`, data).then(unwrap),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['orders', id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Shipment added');
    },
  });
}

export function useCreateRefund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount, reason }: { id: string; amount: number; reason: string }) =>
      api.post(`/orders/${id}/refund`, { amount, reason }).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Refund created');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Refund failed'),
  });
}
