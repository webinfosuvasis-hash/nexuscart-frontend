import api from '@/lib/api';
import type { AnalyticsSummary, RevenuePoint, TrafficSource, TopProduct, ApiResponse } from '@/types';

export const analyticsService = {
  getSummary: (period?: '7d' | '30d' | '90d' | '1y'): Promise<ApiResponse<AnalyticsSummary>> =>
    api.get('/analytics/summary', { params: { period } }),

  getRevenueTrend: (period?: string): Promise<ApiResponse<RevenuePoint[]>> =>
    api.get('/analytics/revenue', { params: { period } }),

  getTrafficSources: (): Promise<ApiResponse<TrafficSource[]>> =>
    api.get('/analytics/traffic'),

  getTopProducts: (limit?: number): Promise<ApiResponse<TopProduct[]>> =>
    api.get('/analytics/top-products', { params: { limit } }),

  getConversionFunnel: (): Promise<ApiResponse<Array<{ stage: string; count: number; rate: number }>>> =>
    api.get('/analytics/funnel'),

  exportReport: (type: string, period: string): Promise<Blob> =>
    api.get('/analytics/export', { params: { type, period }, responseType: 'blob' }),
};
