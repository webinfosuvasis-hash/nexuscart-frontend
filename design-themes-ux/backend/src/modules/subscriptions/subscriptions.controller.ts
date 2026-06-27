import {
  Controller, Get, Post, Body, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'List available subscription plans' })
  listPlans() {
    return this.subscriptions.listPlans();
  }

  @Get('current')
  @Permissions('settings:read')
  @ApiOperation({ summary: 'Get current subscription for the store' })
  getCurrent(@CurrentStore() storeId: string) {
    return this.subscriptions.getCurrentSubscription(storeId);
  }

  @Get('usage')
  @Permissions('settings:read')
  @ApiOperation({ summary: 'Get usage metrics vs plan limits' })
  getUsage(@CurrentStore() storeId: string) {
    return this.subscriptions.getUsage(storeId);
  }

  @Post('upgrade')
  @Permissions('settings:update')
  @ApiOperation({ summary: 'Upgrade or change plan' })
  upgrade(
    @CurrentStore() storeId: string,
    @Body() body: { planId: string; billingCycle: 'MONTHLY' | 'YEARLY' },
  ) {
    return this.subscriptions.upgrade(storeId, body.planId, body.billingCycle);
  }

  @Post('cancel')
  @Permissions('settings:update')
  @ApiOperation({ summary: 'Cancel subscription (end of period or immediate)' })
  cancel(
    @CurrentStore() storeId: string,
    @Body() body: { immediate?: boolean },
  ) {
    return this.subscriptions.cancel(storeId, body.immediate);
  }

  @Get('invoices')
  @Permissions('settings:read')
  @ApiOperation({ summary: 'List billing invoices' })
  listInvoices(@CurrentStore() storeId: string, @Query() query: any) {
    return this.subscriptions.listInvoices(storeId, query);
  }

  @Post('seed-plans')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Seed default plans (super admin only)' })
  seedPlans() {
    return this.subscriptions.seedDefaultPlans();
  }
}
