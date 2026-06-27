import api from '@/lib/api';
import type { Product, PaginationParams, ApiResponse } from '@/types';

const BASE = '/products';

export const productService = {
  list: (params?: PaginationParams): Promise<ApiResponse<Product[]>> =>
    api.get(BASE, { params }),

  get: (id: string): Promise<ApiResponse<Product>> =>
    api.get(`${BASE}/${id}`),

  create: (data: Partial<Product>): Promise<ApiResponse<Product>> =>
    api.post(BASE, data),

  update: (id: string, data: Partial<Product>): Promise<ApiResponse<Product>> =>
    api.patch(`${BASE}/${id}`, data),

  delete: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`${BASE}/${id}`),

  bulkDelete: (ids: string[]): Promise<ApiResponse<void>> =>
    api.post(`${BASE}/bulk-delete`, { ids }),

  duplicate: (id: string): Promise<ApiResponse<Product>> =>
    api.post(`${BASE}/${id}/duplicate`),

  bulkFeature: (ids: string[], featured: boolean): Promise<ApiResponse<void>> =>
    api.post(`${BASE}/bulk-feature`, { ids, featured }),

  importCSV: (file: File): Promise<ApiResponse<{ imported: number }>> => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`${BASE}/import`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },

  exportCSV: (): Promise<Blob> =>
    api.get(`${BASE}/export`, { responseType: 'blob' }),

  generateAI: (prompt: string): Promise<{ description: string; tags: string[]; seo: { title: string; description: string } }> =>
    api.post(`${BASE}/ai-generate`, { prompt }),
};
