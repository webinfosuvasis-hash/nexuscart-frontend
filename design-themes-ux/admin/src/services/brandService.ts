import api from '@/lib/api';

const BASE = '/brands';

export const brandService = {
  list: (params?: any) => api.get(BASE, { params }),
  get: (id: string) => api.get(`${BASE}/${id}`),
  create: (data: any) => api.post(BASE, data),
  update: (id: string, data: any) => api.put(`${BASE}/${id}`, data),
  delete: (id: string) => api.delete(`${BASE}/${id}`),
  reorder: (orders: { id: string; sortOrder: number }[]) => api.patch(`${BASE}/reorder`, { orders }),
  toggleFeatured: (id: string) => api.patch(`${BASE}/${id}/toggle-featured`),
};
