import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attributeService } from '@/services/attributeService';
import { toast } from 'sonner';

const KEY = 'attributes';

export const useAttributes = (params?: any) =>
  useQuery({ queryKey: [KEY, params], queryFn: () => attributeService.list(params).then((r: any) => r.data) });

export const useAttributeSets = () =>
  useQuery({ queryKey: [KEY, 'sets'], queryFn: () => attributeService.listSets().then((r: any) => r.data) });

export const useCreateAttribute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => attributeService.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); toast.success('Attribute created'); },
    onError: () => toast.error('Failed to create attribute'),
  });
};

export const useUpdateAttribute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => attributeService.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); toast.success('Attribute updated'); },
    onError: () => toast.error('Failed to update attribute'),
  });
};

export const useDeleteAttribute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => attributeService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); toast.success('Attribute deleted'); },
    onError: () => toast.error('Failed to delete attribute'),
  });
};

export const useAddAttributeValue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => attributeService.addValue(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); toast.success('Value added'); },
  });
};

export const useDeleteAttributeValue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, valueId }: { id: string; valueId: string }) =>
      attributeService.deleteValue(id, valueId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); toast.success('Value removed'); },
  });
};

export const useCreateAttributeSet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => attributeService.createSet(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); toast.success('Set created'); },
  });
};

export const useDeleteAttributeSet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => attributeService.deleteSet(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); toast.success('Set deleted'); },
  });
};
