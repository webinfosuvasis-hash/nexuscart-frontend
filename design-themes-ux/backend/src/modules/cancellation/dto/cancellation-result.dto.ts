import { ApiProperty } from '@nestjs/swagger';
import { PaymentActionType } from '../types/cancellation.types';

export class CancellationResultDto {
  @ApiProperty()
  order: Record<string, unknown>;

  @ApiProperty()
  paymentAction: PaymentActionType;

  @ApiProperty({ nullable: true })
  paymentRefund: Record<string, unknown> | null;

  @ApiProperty({ nullable: true })
  orderRefund: Record<string, unknown> | null;

  @ApiProperty()
  inventoryReleased: boolean;
}
