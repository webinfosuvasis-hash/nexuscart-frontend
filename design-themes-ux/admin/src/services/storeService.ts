import api from '@/lib/api';
import type { Store, StoreSettings, Plan, Subscription, Invoice, ApiResponse } from '@/types';

export const storeService = {
  // Store CRUD (super admin / multi-tenant)
  listStores: (params?: { status?: string; plan?: string; page?: number }): Promise<ApiResponse<Store[]>> =>
    api.get('/admin/stores', { params }),

  getStore: (id: string): Promise<ApiResponse<Store>> =>
    api.get(`/admin/stores/${id}`),

  createStore: (data: Partial<Store>): Promise<ApiResponse<Store>> =>
    api.post('/admin/stores', data),

  updateStore: (id: string, data: Partial<Store>): Promise<ApiResponse<Store>> =>
    api.patch(`/admin/stores/${id}`, data),

  suspendStore: (id: string, reason: string): Promise<ApiResponse<Store>> =>
    api.post(`/admin/stores/${id}/suspend`, { reason }),

  reactivateStore: (id: string): Promise<ApiResponse<Store>> =>
    api.post(`/admin/stores/${id}/reactivate`),

  // Current store settings
  getSettings: (): Promise<ApiResponse<StoreSettings>> =>
    api.get('/store/settings'),

  updateSettings: (data: Partial<StoreSettings>): Promise<ApiResponse<StoreSettings>> =>
    api.patch('/store/settings', data),

  uploadLogo: (file: File): Promise<ApiResponse<{ url: string }>> => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/store/logo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const subscriptionService = {
  listPlans: (): Promise<ApiResponse<Plan[]>> =>
    api.get('/plans'),

  getCurrentSubscription: (): Promise<ApiResponse<Subscription>> =>
    api.get('/subscription'),

  upgrade: (planId: string, billingCycle: 'monthly' | 'yearly'): Promise<ApiResponse<Subscription>> =>
    api.post('/subscription/upgrade', { planId, billingCycle }),

  cancel: (reason?: string): Promise<ApiResponse<void>> =>
    api.post('/subscription/cancel', { reason }),

  listInvoices: (): Promise<ApiResponse<Invoice[]>> =>
    api.get('/subscription/invoices'),

  downloadInvoice: (id: string): Promise<Blob> =>
    api.get(`/subscription/invoices/${id}/download`, { responseType: 'blob' }),
};
