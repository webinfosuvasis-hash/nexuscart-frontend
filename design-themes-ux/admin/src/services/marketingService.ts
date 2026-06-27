import api from '@/lib/api';
import type { Coupon, Campaign, EmailTemplate, ApiResponse } from '@/types';

export const marketingService = {
  // Coupons
  listCoupons: (): Promise<ApiResponse<Coupon[]>> =>
    api.get('/coupons'),

  createCoupon: (data: Partial<Coupon>): Promise<ApiResponse<Coupon>> =>
    api.post('/coupons', data),

  updateCoupon: (id: number, data: Partial<Coupon>): Promise<ApiResponse<Coupon>> =>
    api.patch(`/coupons/${id}`, data),

  deleteCoupon: (id: number): Promise<ApiResponse<void>> =>
    api.delete(`/coupons/${id}`),

  // Campaigns
  listCampaigns: (): Promise<ApiResponse<Campaign[]>> =>
    api.get('/campaigns'),

  createCampaign: (data: Partial<Campaign>): Promise<ApiResponse<Campaign>> =>
    api.post('/campaigns', data),

  updateCampaign: (id: string, data: Partial<Campaign>): Promise<ApiResponse<Campaign>> =>
    api.patch(`/campaigns/${id}`, data),

  launchCampaign: (id: string): Promise<ApiResponse<Campaign>> =>
    api.post(`/campaigns/${id}/launch`),

  pauseCampaign: (id: string): Promise<ApiResponse<Campaign>> =>
    api.post(`/campaigns/${id}/pause`),

  // Email templates
  listTemplates: (): Promise<ApiResponse<EmailTemplate[]>> =>
    api.get('/email-templates'),

  updateTemplate: (id: string, data: Partial<EmailTemplate>): Promise<ApiResponse<EmailTemplate>> =>
    api.patch(`/email-templates/${id}`, data),

  previewTemplate: (id: string): Promise<ApiResponse<{ html: string }>> =>
    api.get(`/email-templates/${id}/preview`),
};
