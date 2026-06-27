import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';

const unwrap = (r: any) => r?.data ?? r;

export function useCustomers(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: () => api.get('/customers', { params }).then(unwrap),
    staleTime: 30_000,
  });
}

export function useCustomerSegmentStats() {
  return useQuery({
    queryKey: ['customers', 'segment-stats'],
    queryFn: () => api.get('/customers/segment-stats').then(unwrap),
    staleTime: 60_000,
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: () => api.get(`/customers/${id}`).then(unwrap),
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/customers', data).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer created');
    },
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.put(`/customers/${id}`, data).then(unwrap),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customers', id] });
      toast.success('Customer updated');
    },
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer deleted');
    },
  });
}

export function useAwardPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, points, reason }: { id: string; points: number; reason: string }) =>
      api.post(`/customers/${id}/award-points`, { points, reason }).then(unwrap),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['customers', id] });
      toast.success('Points awarded');
    },
  });
}
