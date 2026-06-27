import api from '@/lib/api';

const BASE = '/attributes';

export const attributeService = {
  list: (params?: any) => api.get(BASE, { params }),
  get: (id: string) => api.get(`${BASE}/${id}`),
  create: (data: any) => api.post(BASE, data),
  update: (id: string, data: any) => api.put(`${BASE}/${id}`, data),
  delete: (id: string) => api.delete(`${BASE}/${id}`),

  // Values
  addValue: (id: string, data: any) => api.post(`${BASE}/${id}/values`, data),
  updateValue: (id: string, valueId: string, data: any) =>
    api.put(`${BASE}/${id}/values/${valueId}`, data),
  deleteValue: (id: string, valueId: string) => api.delete(`${BASE}/${id}/values/${valueId}`),
  reorderValues: (id: string, orders: { id: string; sortOrder: number }[]) =>
    api.patch(`${BASE}/${id}/values/reorder`, { orders }),

  // Sets
  listSets: () => api.get(`${BASE}/sets`),
  createSet: (data: any) => api.post(`${BASE}/sets`, data),
  updateSet: (id: string, data: any) => api.put(`${BASE}/sets/${id}`, data),
  deleteSet: (id: string) => api.delete(`${BASE}/sets/${id}`),
};
