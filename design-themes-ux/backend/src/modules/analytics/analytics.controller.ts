import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AnalyticsService } from './analytics.service';
import { TrackEventDto } from './dto/track-event.dto';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Dashboard summary with growth metrics' })
  getSummary(@CurrentStore() storeId: string, @Query('period') period: string) {
    return this.analytics.getSummary(storeId, period);
  }

  @Get('revenue-trend')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Revenue trend over time' })
  getRevenueTrend(@CurrentStore() storeId: string, @Query('period') period: string) {
    return this.analytics.getRevenueTrend(storeId, period);
  }

  @Get('top-products')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Top selling products by revenue' })
  getTopProducts(@CurrentStore() storeId: string, @Query('limit') limit: string) {
    return this.analytics.getTopProducts(storeId, Number(limit) || 10);
  }

  @Get('conversion-funnel')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Conversion funnel: sessions → purchases' })
  getConversionFunnel(@CurrentStore() storeId: string, @Query('period') period: string) {
    return this.analytics.getConversionFunnel(storeId, period);
  }

  @Get('traffic-sources')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Traffic source breakdown' })
  getTrafficSources(@CurrentStore() storeId: string, @Query('period') period: string) {
    return this.analytics.getTrafficSources(storeId, period);
  }

  @Public()
  @Post('events')
  @Throttle({ short: { ttl: 60000, limit: 30 }, medium: { ttl: 3600000, limit: 500 } })
  @ApiOperation({ summary: 'Track a storefront event (public)' })
  trackEvent(@CurrentStore(false) storeId: string, @Body() event: TrackEventDto) {
    return this.analytics.trackEvent(storeId, event);
  }
}
