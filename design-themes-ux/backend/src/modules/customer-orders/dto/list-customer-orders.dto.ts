import {
  IsIn, IsInt, IsOptional, IsString, Max, Min, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Deliberately a customer-facing filter vocabulary, not a 1:1 mirror of
// OrderStatus/PaymentStatus — "Paid" maps to Order.paymentStatus, everything
// else maps to Order.status (see CustomerOrdersService.buildWhere).
export enum CustomerOrderStatusFilter {
  PENDING = 'PENDING',
  PAID = 'PAID',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum CustomerOrderSortField {
  CREATED_AT = 'createdAt',
  TOTAL = 'total',
  ORDER_NUMBER = 'orderNumber',
}

export class ListCustomerOrdersDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: CustomerOrderStatusFilter })
  @IsOptional()
  @IsIn(Object.values(CustomerOrderStatusFilter))
  status?: CustomerOrderStatusFilter;

  @ApiPropertyOptional({ description: 'Search by order number (partial match)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: CustomerOrderSortField, default: CustomerOrderSortField.CREATED_AT })
  @IsOptional()
  @IsIn(Object.values(CustomerOrderSortField))
  sortBy?: CustomerOrderSortField = CustomerOrderSortField.CREATED_AT;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
