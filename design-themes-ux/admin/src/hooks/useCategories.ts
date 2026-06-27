import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';

const unwrap = (r: any) => r?.data ?? r;

export interface FlatCategory {
  id: string;
  name: string;
  parentId: string | null;
  slug: string;
  depth?: number;
}

function assignDepths(flat: FlatCategory[]): FlatCategory[] {
  const map = new Map(flat.map((c) => [c.id, c]));
  return flat.map((c) => {
    let depth = 0;
    let cur = c;
    while (cur.parentId && map.has(cur.parentId)) {
      depth++;
      cur = map.get(cur.parentId)!;
    }
    return { ...c, depth };
  });
}

// ─── Tree (for Categories admin page) ────────────────────────────────────────
export function useCategoryTree() {
  return useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: () => api.get('/categories').then(unwrap).then((d: any) => Array.isArray(d) ? d : d?.items ?? []),
    staleTime: 0,
  });
}

// ─── Flat list (for product form pickers) ────────────────────────────────────
export function useFlatCategories() {
  return useQuery({
    queryKey: ['categories', 'flat'],
    queryFn: () =>
      api.get('/categories/flat').then(unwrap).then((data: any) => {
        const list: FlatCategory[] = Array.isArray(data) ? data : data?.items ?? [];
        return assignDepths(list);
      }),
    staleTime: 0,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────
const invalidate = (qc: any) => {
  qc.invalidateQueries({ queryKey: ['categories'] });
};

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/categories', data).then(unwrap),
    onSuccess: () => { invalidate(qc); toast.success('Category created'); },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to create'),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.put(`/categories/${id}`, data).then(unwrap),
    onSuccess: () => { invalidate(qc); toast.success('Category updated'); },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to update'),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => { invalidate(qc); toast.success('Category deleted'); },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to delete'),
  });
}

export function useReorderCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orders: { id: string; sortOrder: number }[]) =>
      api.patch('/categories/reorder', { orders }).then(unwrap),
    onSuccess: () => { invalidate(qc); toast.success('Order saved'); },
    onError: () => toast.error('Failed to save order'),
  });
}

export function useBulkMoveCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, parentId }: { ids: string[]; parentId: string | null }) =>
      api.patch('/categories/bulk-move', { ids, newParentId: parentId }).then(unwrap),
    onSuccess: (_, { ids }) => { invalidate(qc); toast.success(`${ids.length} categories moved`); },
    onError: (e: any) => toast.error(e?.message ?? 'Move failed'),
  });
}

export function useMergeCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceIds, targetId }: { sourceIds: string[]; targetId: string }) =>
      api.post('/categories/merge', { sourceIds, targetId }).then(unwrap),
    onSuccess: (_, { sourceIds }) => { invalidate(qc); toast.success(`${sourceIds.length} categories merged`); },
    onError: (e: any) => toast.error(e?.message ?? 'Merge failed'),
  });
}

export function useUpdateCategoryVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`/categories/${id}/visibility`, data).then(unwrap),
    onSuccess: () => invalidate(qc),
    onError: () => {},
  });
}
