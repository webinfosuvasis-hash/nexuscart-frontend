import api from '@/lib/api';
import type { Order, OrderStatus, PaginationParams, ApiResponse } from '@/types';

const BASE = '/orders';

export const orderService = {
  list: (params?: PaginationParams & { status?: OrderStatus }): Promise<ApiResponse<Order[]>> =>
    api.get(BASE, { params }),

  get: (id: string): Promise<ApiResponse<Order>> =>
    api.get(`${BASE}/${id}`),

  updateStatus: (id: string, status: OrderStatus, note?: string): Promise<ApiResponse<Order>> =>
    api.patch(`${BASE}/${id}/status`, { status, note }),

  cancel: (id: string, reason: string): Promise<ApiResponse<Order>> =>
    api.post(`${BASE}/${id}/cancel`, { reason }),

  refund: (id: string, amount: number, reason: string): Promise<ApiResponse<Order>> =>
    api.post(`${BASE}/${id}/refund`, { amount, reason }),

  addNote: (id: string, note: string): Promise<ApiResponse<Order>> =>
    api.post(`${BASE}/${id}/notes`, { note }),

  exportCSV: (params?: PaginationParams): Promise<Blob> =>
    api.get(`${BASE}/export`, { params, responseType: 'blob' }),

  getStats: (): Promise<ApiResponse<{ pending: number; processing: number; shipped: number; revenue: number }>> =>
    api.get(`${BASE}/stats`),
};
