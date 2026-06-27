import api from '@/lib/api';

const BASE = '/collections';

export const collectionService = {
  list: (params?: any) => api.get(BASE, { params }),
  get: (id: string) => api.get(`${BASE}/${id}`),
  create: (data: any) => api.post(BASE, data),
  update: (id: string, data: any) => api.put(`${BASE}/${id}`, data),
  delete: (id: string) => api.delete(`${BASE}/${id}`),
  addProduct: (id: string, productId: string, isPinned?: boolean) =>
    api.post(`${BASE}/${id}/products`, { productId, isPinned }),
  removeProduct: (id: string, productId: string) =>
    api.delete(`${BASE}/${id}/products/${productId}`),
  reorderProducts: (id: string, orders: { productId: string; sortOrder: number }[]) =>
    api.patch(`${BASE}/${id}/reorder-products`, { orders }),
  sync: (id: string) => api.post(`${BASE}/${id}/sync`),
};
