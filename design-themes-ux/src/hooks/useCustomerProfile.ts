import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as api from '@/lib/customerProfileApi';

export const PROFILE_QUERY_KEY = ['customer-profile'] as const;

export function useProfile(enabled: boolean) {
  return useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: api.getProfile,
    enabled,
    staleTime: 30_000,
    gcTime: 300_000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateProfile,
    onSuccess: (profile) => {
      qc.setQueryData(PROFILE_QUERY_KEY, profile);
      toast.success('Profile updated');
    },
    onError: (err) => {
      const msg = err instanceof api.CustomerAuthApiError ? err.message : 'Failed to update profile';
      toast.error(msg);
    },
  });
}
