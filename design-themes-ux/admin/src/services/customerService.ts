import api from '@/lib/api';
import type { Customer, CustomerSegment, PaginationParams, ApiResponse } from '@/types';

const BASE = '/customers';

export const customerService = {
  list: (params?: PaginationParams & { segment?: CustomerSegment }): Promise<ApiResponse<Customer[]>> =>
    api.get(BASE, { params }),

  get: (id: string): Promise<ApiResponse<Customer>> =>
    api.get(`${BASE}/${id}`),

  create: (data: Partial<Customer>): Promise<ApiResponse<Customer>> =>
    api.post(BASE, data),

  update: (id: string, data: Partial<Customer>): Promise<ApiResponse<Customer>> =>
    api.patch(`${BASE}/${id}`, data),

  delete: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`${BASE}/${id}`),

  bulkMessage: (ids: string[], channel: 'email' | 'sms', message: string): Promise<ApiResponse<{ sent: number }>> =>
    api.post(`${BASE}/bulk-message`, { ids, channel, message }),

  getOrders: (id: string): Promise<ApiResponse<any[]>> =>
    api.get(`${BASE}/${id}/orders`),

  exportCSV: (): Promise<Blob> =>
    api.get(`${BASE}/export`, { responseType: 'blob' }),

  getSegmentStats: (): Promise<ApiResponse<Record<CustomerSegment, number>>> =>
    api.get(`${BASE}/segment-stats`),
};
