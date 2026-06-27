import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';

const unwrap = (r: any) => r?.data ?? r;

export function usePlans() {
  return useQuery({
    queryKey: ['subscriptions', 'plans'],
    queryFn: () => api.get('/subscriptions/plans').then(unwrap),
    staleTime: Infinity,
  });
}

export function useCurrentSubscription() {
  return useQuery({
    queryKey: ['subscriptions', 'current'],
    queryFn: () => api.get('/subscriptions/current').then(unwrap),
    staleTime: 60_000,
  });
}

export function useSubscriptionUsage() {
  return useQuery({
    queryKey: ['subscriptions', 'usage'],
    queryFn: () => api.get('/subscriptions/usage').then(unwrap),
    staleTime: 60_000,
  });
}

export function useInvoices(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['subscriptions', 'invoices', params],
    queryFn: () => api.get('/subscriptions/invoices', { params }).then(unwrap),
    staleTime: 60_000,
  });
}

export function useUpgradePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, billingCycle }: { planId: string; billingCycle: 'MONTHLY' | 'YEARLY' }) =>
      api.post('/subscriptions/upgrade', { planId, billingCycle }).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      toast.success('Plan upgraded successfully');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Upgrade failed'),
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (immediate?: boolean) =>
      api.post('/subscriptions/cancel', { immediate }).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      toast.success('Subscription cancelled');
    },
  });
}
