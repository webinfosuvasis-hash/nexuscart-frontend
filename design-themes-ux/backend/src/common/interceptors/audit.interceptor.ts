import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '@/prisma/prisma.service';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const SENSITIVE_FIELDS = new Set([
  'password', 'oldPassword', 'newPassword', 'currentPassword',
  'refreshToken', 'accessToken', 'token', 'secret', 'apiKey',
]);

function scrubBody(body: Record<string, unknown>): Record<string, unknown> {
  if (!body || typeof body !== 'object') return body;
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    safe[k] = SENSITIVE_FIELDS.has(k) ? '[REDACTED]' : v;
  }
  return safe;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, storeId, body, ip } = request;

    if (!WRITE_METHODS.has(method) || !user) return next.handle();

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: async () => {
          try {
            await this.prisma.auditLog.create({
              data: {
                userId: user.id,
                storeId: storeId ?? null,
                action: `${method} ${url}`,
                resource: url.split('/')[3] ?? 'unknown',
                details: JSON.stringify(scrubBody(body ?? {})),
                ipAddress: ip,
                duration: Date.now() - startTime,
              },
            });
          } catch (err) {
            this.logger.warn(`Audit log failed: ${(err as Error).message}`);
          }
        },
      }),
    );
  }
}
