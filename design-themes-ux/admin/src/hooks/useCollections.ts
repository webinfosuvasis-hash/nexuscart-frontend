import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collectionService } from '@/services/collectionService';
import { toast } from 'sonner';

const KEY = 'collections';

export const useCollections = (params?: any) =>
  useQuery({ queryKey: [KEY, params], queryFn: () => collectionService.list(params).then((r: any) => r.data) });

export const useCollection = (id: string) =>
  useQuery({ queryKey: [KEY, id], queryFn: () => collectionService.get(id).then((r: any) => r.data), enabled: !!id });

export const useCreateCollection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => collectionService.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); toast.success('Collection created'); },
    onError: () => toast.error('Failed to create collection'),
  });
};

export const useUpdateCollection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => collectionService.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); toast.success('Collection updated'); },
    onError: () => toast.error('Failed to update collection'),
  });
};

export const useDeleteCollection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => collectionService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); toast.success('Collection deleted'); },
    onError: () => toast.error('Failed to delete collection'),
  });
};

export const useSyncCollection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => collectionService.sync(id),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: [KEY] }); toast.success(r?.data?.message ?? 'Synced'); },
    onError: () => toast.error('Sync failed'),
  });
};
