import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheService } from './cache.service';
import { REDIS_CLIENT } from './cache.constants';

/**
 * Global so every module can inject CacheService without re-importing.
 * Redis connection errors are logged but do NOT crash the app —
 * all CacheService methods degrade gracefully to null / no-op.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const client = new Redis({
          host:     config.get<string>('REDIS_HOST', 'localhost'),
          port:     config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD', undefined),
          db:       config.get<number>('REDIS_DB', 0),
          // Reconnect on connection loss — cap at 10 s backoff
          retryStrategy: (times) => Math.min(times * 200, 10_000),
          lazyConnect: false,
        });

        client.on('error', (err) => {
          console.warn('[Redis] connection error:', err.message);
        });

        client.on('connect', () => {
          console.log('[Redis] connected');
        });

        return client;
      },
    },
    CacheService,
  ],
  exports: [CacheService],
})
export class CacheModule {}
