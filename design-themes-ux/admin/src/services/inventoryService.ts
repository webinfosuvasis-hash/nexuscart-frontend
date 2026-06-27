import api from '@/lib/api';
import type { Warehouse, Supplier, StockMovement, PurchaseOrder, ApiResponse } from '@/types';

export const inventoryService = {
  // Warehouses
  listWarehouses: (): Promise<ApiResponse<Warehouse[]>> =>
    api.get('/warehouses'),

  createWarehouse: (data: Partial<Warehouse>): Promise<ApiResponse<Warehouse>> =>
    api.post('/warehouses', data),

  updateWarehouse: (id: number, data: Partial<Warehouse>): Promise<ApiResponse<Warehouse>> =>
    api.patch(`/warehouses/${id}`, data),

  // Suppliers
  listSuppliers: (): Promise<ApiResponse<Supplier[]>> =>
    api.get('/suppliers'),

  createSupplier: (data: Partial<Supplier>): Promise<ApiResponse<Supplier>> =>
    api.post('/suppliers', data),

  updateSupplier: (id: number, data: Partial<Supplier>): Promise<ApiResponse<Supplier>> =>
    api.patch(`/suppliers/${id}`, data),

  // Stock movements
  listMovements: (params?: { productId?: string; warehouseId?: number }): Promise<ApiResponse<StockMovement[]>> =>
    api.get('/stock-movements', { params }),

  createMovement: (data: Partial<StockMovement>): Promise<ApiResponse<StockMovement>> =>
    api.post('/stock-movements', data),

  // Purchase orders
  listPurchaseOrders: (): Promise<ApiResponse<PurchaseOrder[]>> =>
    api.get('/purchase-orders'),

  createPurchaseOrder: (data: Partial<PurchaseOrder>): Promise<ApiResponse<PurchaseOrder>> =>
    api.post('/purchase-orders', data),

  updatePOStatus: (id: string, status: PurchaseOrder['status']): Promise<ApiResponse<PurchaseOrder>> =>
    api.patch(`/purchase-orders/${id}/status`, { status }),

  getLowStock: (threshold?: number): Promise<ApiResponse<any[]>> =>
    api.get('/inventory/low-stock', { params: { threshold } }),
};
