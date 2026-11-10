import api from '@/lib/api';
import type { Vendor, VendorStatus } from '@/types';

const BASE = '/vendors';

export interface VendorListParams { page?: number; limit?: number; search?: string; status?: VendorStatus }
export type VendorInput = Pick<Vendor, 'name' | 'email'> & Partial<Pick<Vendor, 'status' | 'notifyOnOrder'>>;

export const vendorService = {
  list: (params?: VendorListParams) => api.get(BASE, { params }),
  get: (id: string) => api.get(`${BASE}/${id}`),
  create: (data: VendorInput) => api.post(BASE, data),
  update: (id: string, data: Partial<VendorInput>) => api.put(`${BASE}/${id}`, data),
  delete: (id: string) => api.delete(`${BASE}/${id}`),
};
