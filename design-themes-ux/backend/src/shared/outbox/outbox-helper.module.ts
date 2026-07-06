import { Global, Module } from '@nestjs/common';
import { OutboxHelperService } from './outbox-helper.service';

/**
 * @Global — OutboxHelperService is available to every module that needs to
 * write outbox events inside a Prisma $transaction, without requiring an
 * explicit import.  PrismaService is provided by the global PrismaModule;
 * OutboxHelperService itself carries no Prisma dependency — it receives the
 * transaction client at call time.
 */
@Global()
@Module({
  providers: [OutboxHelperService],
  exports:   [OutboxHelperService],
})
export class OutboxHelperModule {}
