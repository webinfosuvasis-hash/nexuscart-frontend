import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CartDomainEvent } from './cart-domain-event.base';

@Injectable()
export class CartEventBus {
  constructor(private readonly emitter: EventEmitter2) {}

  emit(event: CartDomainEvent): void {
    this.emitter.emit(event.eventType, event);
  }
}
