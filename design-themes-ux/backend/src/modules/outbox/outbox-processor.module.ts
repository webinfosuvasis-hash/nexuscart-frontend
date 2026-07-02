import { Module } from '@nestjs/common';
import { OutboxProcessorService } from './outbox-processor.service';

// PrismaService, ConfigService, and EventEmitter2 are all @Global — no explicit import needed.
@Module({
  providers: [OutboxProcessorService],
  exports:   [OutboxProcessorService],
})
export class OutboxProcessorModule {}
