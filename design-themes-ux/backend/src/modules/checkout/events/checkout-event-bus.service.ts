import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CheckoutDomainEvent } from './checkout-domain-event.base';

@Injectable()
export class CheckoutEventBus {
  constructor(private readonly emitter: EventEmitter2) {}

  emit(event: CheckoutDomainEvent): void {
    this.emitter.emit(event.eventType, event);
  }
}
