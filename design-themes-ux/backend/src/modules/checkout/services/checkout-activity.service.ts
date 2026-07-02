import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CheckoutActivityType, CheckoutActorType } from '@prisma/client';
import { randomBytes } from 'crypto';

export interface RecordCheckoutActivityDto {
  checkoutId:    string;
  storeId:       string;
  sessionId:     string;
  customerId?:   string | null;
  activityType:  CheckoutActivityType;
  actorType:     CheckoutActorType;
  actorId?:      string | null;
  payload:       Record<string, unknown>;
  ipAddress?:    string | null;
  userAgent?:    string | null;
  traceId?:      string | null;
  spanId?:       string | null;
  correlationId?: string | null;
  requestId?:    string | null;
}

@Injectable()
export class CheckoutActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async record(dto: RecordCheckoutActivityDto): Promise<void> {
    await this.prisma.checkoutActivity.create({
      data: {
        id:            randomBytes(12).toString('hex'),
        checkoutId:    dto.checkoutId,
        storeId:       dto.storeId,
        sessionId:     dto.sessionId,
        customerId:    dto.customerId ?? null,
        activityType:  dto.activityType,
        actorType:     dto.actorType,
        actorId:       dto.actorId ?? null,
        payload:       dto.payload as object,
        ipAddress:     dto.ipAddress ?? null,
        userAgent:     dto.userAgent ?? null,
        traceId:       dto.traceId ?? null,
        spanId:        dto.spanId ?? null,
        correlationId: dto.correlationId ?? null,
        requestId:     dto.requestId ?? null,
      },
    });
  }

  async findByCheckout(checkoutId: string, limit = 50) {
    return this.prisma.checkoutActivity.findMany({
      where:   { checkoutId },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      select:  { id: true, activityType: true, actorType: true, actorId: true, payload: true, createdAt: true },
    });
  }
}
