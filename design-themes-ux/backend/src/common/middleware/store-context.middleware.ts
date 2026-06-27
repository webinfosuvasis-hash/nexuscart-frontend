import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class StoreContextMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request & { storeId?: string }, res: Response, next: NextFunction) {
    const storeId = req.headers['x-store-id'] as string;

    if (storeId) {
      const store = await this.prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, status: true },
      });

      if (!store) throw new BadRequestException('Store not found');
      if (store.status === 'SUSPENDED')
        throw new BadRequestException('Store is suspended');

      req.storeId = storeId;
    }

    next();
  }
}
