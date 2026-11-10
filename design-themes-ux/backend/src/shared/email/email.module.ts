import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';

/**
 * @Global — one SMTP transport for every transactional email. Today only
 * order confirmations use it; the other notification services still log
 * what they would send.
 */
@Global()
@Module({
  providers: [EmailService],
  exports:   [EmailService],
})
export class EmailModule {}
