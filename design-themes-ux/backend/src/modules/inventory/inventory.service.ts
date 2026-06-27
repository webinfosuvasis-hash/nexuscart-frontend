import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Warehouses ──────────────────────────────────────────────────────────────

  async listWarehouses(storeId: string) {
    return this.prisma.warehouse.findMany({
      where: { storeId },
      include: { _count: { select: { stock: true } } },
    });
  }

  async createWarehouse(storeId: string, dto: any) {
    return this.prisma.warehouse.create({ data: { ...dto, storeId } });
  }

  async updateWarehouse(storeId: string, id: string, dto: any) {
    const wh = await this.prisma.warehouse.findFirst({ where: { id, storeId } });
    if (!wh) throw new NotFoundException('Warehouse not found');
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }

  async removeWarehouse(storeId: string, id: string) {
    const wh = await this.prisma.warehouse.findFirst({ where: { id, storeId } });
    if (!wh) throw new NotFoundException('Warehouse not found');
    await this.prisma.warehouse.delete({ where: { id } });
    return { message: 'Warehouse deleted' };
  }

  // ─── Suppliers ───────────────────────────────────────────────────────────────

  async listSuppliers(storeId: string, query: any) {
    const { page = 1, limit = 20, search } = query;
    const where: any = { storeId };
    if (search) where.name = { contains: search };

    const [items, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        include: { _count: { select: { purchaseOrders: true } } },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createSupplier(storeId: string, dto: any) {
    return this.prisma.supplier.create({ data: { ...dto, storeId } });
  }

  async updateSupplier(storeId: string, id: string, dto: any) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, storeId } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  // ─── Stock Movements ─────────────────────────────────────────────────────────

  async listMovements(storeId: string, query: any) {
    const { page = 1, limit = 20, productId, warehouseId } = query;
    const where: any = { storeId };
    if (productId) where.productId = productId;
    if (warehouseId) where.warehouseId = warehouseId;

    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          warehouse: { select: { name: true } },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createMovement(storeId: string, dto: any, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: { ...dto, storeId, createdById: userId },
      });

      const delta = dto.type === 'IN' ? dto.quantity : -dto.quantity;
      await tx.product.update({
        where: { id: dto.productId },
        data: { stock: { increment: delta } },
      });

      return movement;
    });
  }

  // ─── Purchase Orders ─────────────────────────────────────────────────────────

  async listPurchaseOrders(storeId: string, query: any) {
    const { page = 1, limit = 20, status } = query;
    const where: any = { storeId };
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { name: true } },
          items: true,
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createPurchaseOrder(storeId: string, dto: any, userId: string) {
    const poNumber = `PO-${Date.now()}`;
    return this.prisma.purchaseOrder.create({
      data: {
        ...dto,
        storeId,
        poNumber,
        createdById: userId,
        items: { create: dto.items },
      },
      include: { items: true, supplier: true },
    });
  }

  async receivePurchaseOrder(storeId: string, id: string, userId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, storeId },
      include: { items: true },
    });
    if (!po) throw new NotFoundException('Purchase order not found');

    return this.prisma.$transaction(async (tx) => {
      for (const item of po.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            storeId,
            type: 'IN',
            quantity: item.quantity,
            reason: `Purchase Order ${po.poNumber}`,
            createdById: userId,
          },
        });
      }

      return tx.purchaseOrder.update({
        where: { id },
        data: { status: 'RECEIVED', receivedAt: new Date() },
      });
    });
  }

  // ─── Stats ───────────────────────────────────────────────────────────────────

  async getStats(storeId: string) {
    const [totalSku, lowStock, outOfStock, warehouseCount] = await Promise.all([
      this.prisma.product.count({ where: { storeId, trackInventory: true } }),
      this.prisma.product.count({
        where: { storeId, trackInventory: true, stock: { lte: 10, gt: 0 } },
      }),
      this.prisma.product.count({
        where: { storeId, trackInventory: true, stock: { lte: 0 } },
      }),
      this.prisma.warehouse.count({ where: { storeId } }),
    ]);

    return { totalSku, lowStock, outOfStock, warehouseCount };
  }
}
