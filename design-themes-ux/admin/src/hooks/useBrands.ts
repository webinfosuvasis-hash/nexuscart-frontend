import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { brandService } from '@/services/brandService';
import { toast } from 'sonner';

const KEY = 'brands';

export const useBrands = (params?: any) =>
  useQuery({ queryKey: [KEY, params], queryFn: () => brandService.list(params).then((r: any) => r.data) });

export const useBrand = (id: string) =>
  useQuery({ queryKey: [KEY, id], queryFn: () => brandService.get(id).then((r: any) => r.data), enabled: !!id });

export const useCreateBrand = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => brandService.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); toast.success('Brand created'); },
    onError: () => toast.error('Failed to create brand'),
  });
};

export const useUpdateBrand = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => brandService.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); toast.success('Brand updated'); },
    onError: () => toast.error('Failed to update brand'),
  });
};

export const useDeleteBrand = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => brandService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); toast.success('Brand deleted'); },
    onError: () => toast.error('Failed to delete brand'),
  });
};

export const useToggleBrandFeatured = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => brandService.toggleFeatured(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); },
  });
};

export const useReorderBrands = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orders: { id: string; sortOrder: number }[]) => brandService.reorder(orders),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); toast.success('Order saved'); },
  });
};
