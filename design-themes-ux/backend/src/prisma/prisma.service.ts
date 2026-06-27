import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();

    // Global middleware: soft-delete scope — only for models that have a deletedAt column
    const SOFT_DELETE_MODELS = new Set(['User', 'Category', 'Product', 'Customer']);

    this.$use(async (params, next) => {
      if (
        (params.action === 'findMany' || params.action === 'findFirst') &&
        SOFT_DELETE_MODELS.has(params.model ?? '')
      ) {
        params.args ??= {};
        params.args.where ??= {};
        if (params.args.where.deletedAt === undefined) {
          params.args.where.deletedAt = null;
        }
      }
      return next(params);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') return;
    const tablenames = await this.$queryRaw<{ TABLE_NAME: string }[]>`
      SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME != '_prisma_migrations'
    `;
    for (const { TABLE_NAME } of tablenames) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE \`${TABLE_NAME}\``);
    }
  }
}
