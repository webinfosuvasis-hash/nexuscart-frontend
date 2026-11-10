import { Controller, Get, Post, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { VendorNotificationStatus } from '@prisma/client';
import { VendorOrderNotificationService } from './vendor-order-notification.service';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';

export class QueryVendorNotificationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() orderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() vendorId?: string;
  @ApiPropertyOptional({ enum: VendorNotificationStatus }) @IsOptional() @IsEnum(VendorNotificationStatus)
  status?: VendorNotificationStatus;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number = 50;
}

@ApiTags('Vendors')
@ApiBearerAuth()
@Controller('vendor-notifications')
export class VendorNotificationsController {
  constructor(private readonly notifications: VendorOrderNotificationService) {}

  @Get()
  @Permissions('vendors:read')
  @ApiOperation({ summary: 'Delivery status of vendor order emails (filter by order, vendor or status)' })
  list(@CurrentStore() storeId: string, @Query() query: QueryVendorNotificationDto) {
    return this.notifications.list(storeId, query);
  }

  @Post(':id/resend')
  @Permissions('vendors:update') // store owners (and super admins) only
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Re-queue a vendor order email that failed, was skipped or was abandoned mid-send' })
  resend(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.notifications.resend(storeId, id);
  }
}
