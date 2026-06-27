import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MarketingService } from './marketing.service';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';

@ApiTags('Marketing')
@ApiBearerAuth()
@Controller('marketing')
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  // Coupons
  @Get('coupons')
  @Permissions('marketing:read')
  listCoupons(@CurrentStore() storeId: string, @Query() query: any) {
    return this.marketing.listCoupons(storeId, query);
  }

  @Post('coupons')
  @Permissions('marketing:create')
  createCoupon(@CurrentStore() storeId: string, @Body() dto: any) {
    return this.marketing.createCoupon(storeId, dto);
  }

  @Put('coupons/:id')
  @Permissions('marketing:update')
  updateCoupon(@CurrentStore() storeId: string, @Param('id') id: string, @Body() dto: any) {
    return this.marketing.updateCoupon(storeId, id, dto);
  }

  @Delete('coupons/:id')
  @Permissions('marketing:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCoupon(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.marketing.removeCoupon(storeId, id);
  }

  @Post('coupons/validate')
  @Permissions('marketing:read')
  @ApiOperation({ summary: 'Validate coupon code at checkout' })
  validateCoupon(
    @CurrentStore() storeId: string,
    @Body() body: { code: string; amount: number },
  ) {
    return this.marketing.validateCoupon(storeId, body.code, body.amount);
  }

  // Campaigns
  @Get('campaigns')
  @Permissions('marketing:read')
  listCampaigns(@CurrentStore() storeId: string, @Query() query: any) {
    return this.marketing.listCampaigns(storeId, query);
  }

  @Post('campaigns')
  @Permissions('marketing:create')
  createCampaign(@CurrentStore() storeId: string, @Body() dto: any) {
    return this.marketing.createCampaign(storeId, dto);
  }

  @Put('campaigns/:id')
  @Permissions('marketing:update')
  updateCampaign(@CurrentStore() storeId: string, @Param('id') id: string, @Body() dto: any) {
    return this.marketing.updateCampaign(storeId, id, dto);
  }

  @Post('campaigns/:id/launch')
  @Permissions('marketing:update')
  @ApiOperation({ summary: 'Launch a campaign immediately' })
  launchCampaign(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.marketing.launchCampaign(storeId, id);
  }

  @Post('campaigns/:id/pause')
  @Permissions('marketing:update')
  pauseCampaign(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.marketing.pauseCampaign(storeId, id);
  }

  // Email Templates
  @Get('email-templates')
  @Permissions('marketing:read')
  listEmailTemplates(@CurrentStore() storeId: string) {
    return this.marketing.listEmailTemplates(storeId);
  }

  @Post('email-templates')
  @Permissions('marketing:create')
  createEmailTemplate(@CurrentStore() storeId: string, @Body() dto: any) {
    return this.marketing.createEmailTemplate(storeId, dto);
  }

  @Put('email-templates/:id')
  @Permissions('marketing:update')
  updateEmailTemplate(
    @CurrentStore() storeId: string,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.marketing.updateEmailTemplate(storeId, id, dto);
  }

  @Delete('email-templates/:id')
  @Permissions('marketing:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeEmailTemplate(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.marketing.removeEmailTemplate(storeId, id);
  }
}
