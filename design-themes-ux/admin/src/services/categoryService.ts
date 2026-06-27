import api from '@/lib/api';

const BASE = '/categories';

export const categoryService = {
  tree: () => api.get(BASE),
  flat: () => api.get(`${BASE}/flat`),
  get: (id: string) => api.get(`${BASE}/${id}`),
  create: (data: any) => api.post(BASE, data),
  update: (id: string, data: any) => api.put(`${BASE}/${id}`, data),
  delete: (id: string) => api.delete(`${BASE}/${id}`),
  reorder: (orders: { id: string; sortOrder: number }[]) =>
    api.patch(`${BASE}/reorder`, { orders }),
  bulkMove: (ids: string[], newParentId: string | null) =>
    api.patch(`${BASE}/bulk-move`, { ids, newParentId }),
  merge: (sourceIds: string[], targetId: string) =>
    api.post(`${BASE}/merge`, { sourceIds, targetId }),
  updateVisibility: (id: string, data: any) => api.patch(`${BASE}/${id}/visibility`, data),
  applyRules: (id: string) => api.post(`${BASE}/${id}/apply-rules`),
};
