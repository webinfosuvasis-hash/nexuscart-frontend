import { Global, Module } from '@nestjs/common';
import { InventoryReservationService } from './inventory-reservation.service';

/**
 * @Global — checkout, payment, order completion, order cancellation and the
 * expiry cleanup job all hold or return stock through the same service, so
 * the hold lifecycle lives in exactly one place.
 */
@Global()
@Module({
  providers: [InventoryReservationService],
  exports:   [InventoryReservationService],
})
export class InventoryReservationModule {}
