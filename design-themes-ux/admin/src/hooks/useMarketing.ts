import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';

const unwrap = (r: any) => r?.data ?? r;

// Coupons
export function useCoupons(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['marketing', 'coupons', params],
    queryFn: () => api.get('/marketing/coupons', { params }).then(unwrap),
    staleTime: 30_000,
  });
}

export function useCreateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/marketing/coupons', data).then(unwrap),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing', 'coupons'] }); toast.success('Coupon created'); },
  });
}

export function useUpdateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/marketing/coupons/${id}`, data).then(unwrap),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing', 'coupons'] }); toast.success('Coupon updated'); },
  });
}

export function useDeleteCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/marketing/coupons/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing', 'coupons'] }); toast.success('Coupon deleted'); },
  });
}

// Campaigns
export function useCampaigns(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['marketing', 'campaigns', params],
    queryFn: () => api.get('/marketing/campaigns', { params }).then(unwrap),
    staleTime: 30_000,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/marketing/campaigns', data).then(unwrap),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] }); toast.success('Campaign created'); },
  });
}

export function useLaunchCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/marketing/campaigns/${id}/launch`).then(unwrap),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] }); toast.success('Campaign launched'); },
    onError: (e: any) => toast.error(e?.message ?? 'Launch failed'),
  });
}

export function usePauseCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/marketing/campaigns/${id}/pause`).then(unwrap),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] }); toast.success('Campaign paused'); },
  });
}

// Email Templates
export function useEmailTemplates() {
  return useQuery({
    queryKey: ['marketing', 'email-templates'],
    queryFn: () => api.get('/marketing/email-templates').then(unwrap),
    staleTime: 60_000,
  });
}

export function useCreateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/marketing/email-templates', data).then(unwrap),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing', 'email-templates'] }); toast.success('Template created'); },
  });
}

export function useDeleteEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/marketing/email-templates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing', 'email-templates'] }); toast.success('Template deleted'); },
  });
}
