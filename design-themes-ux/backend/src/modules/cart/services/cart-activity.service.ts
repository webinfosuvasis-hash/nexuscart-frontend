import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CartActivityType, CartActorType } from '@prisma/client';
import { randomBytes } from 'crypto';

export interface RecordActivityDto {
  cartId:       string;
  storeId:      string;
  sessionId:    string;
  customerId?:  string | null;
  activityType: CartActivityType;
  actorType:    CartActorType;
  actorId?:     string | null;
  payload:      Record<string, unknown>;
  ipAddress?:   string | null;
  userAgent?:   string | null;
  traceId?:     string | null;
  spanId?:      string | null;
  correlationId?: string | null;
  requestId?:   string | null;
}

@Injectable()
export class CartActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async record(dto: RecordActivityDto): Promise<void> {
    await this.prisma.cartActivity.create({
      data: {
        id:           randomBytes(12).toString('hex'),
        cartId:       dto.cartId,
        storeId:      dto.storeId,
        sessionId:    dto.sessionId,
        customerId:   dto.customerId ?? null,
        activityType: dto.activityType,
        actorType:    dto.actorType,
        actorId:      dto.actorId ?? null,
        payload:      dto.payload as object,
        ipAddress:    dto.ipAddress ?? null,
        userAgent:    dto.userAgent ?? null,
        traceId:      dto.traceId ?? null,
        spanId:       dto.spanId ?? null,
        correlationId: dto.correlationId ?? null,
        requestId:    dto.requestId ?? null,
      },
    });
  }

  async findByCart(cartId: string, limit = 50): Promise<Array<{
    id: string; activityType: CartActivityType; actorType: CartActorType;
    actorId: string | null; payload: unknown; createdAt: Date;
  }>> {
    return this.prisma.cartActivity.findMany({
      where:   { cartId },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      select:  { id: true, activityType: true, actorType: true, actorId: true, payload: true, createdAt: true },
    });
  }
}
