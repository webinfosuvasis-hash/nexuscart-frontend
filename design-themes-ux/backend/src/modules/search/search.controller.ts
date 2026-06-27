import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('Search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Full-text product search (public)' })
  doSearch(@CurrentStore() storeId: string, @Query() query: any) {
    return this.searchService.search(storeId, query);
  }

  @Public()
  @Get('autocomplete')
  @ApiOperation({ summary: 'Autocomplete suggestions (public)' })
  autocomplete(@CurrentStore() storeId: string, @Query('q') q: string) {
    return this.searchService.autocomplete(storeId, q);
  }

  @Get('analytics')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Search analytics: top queries, zero results' })
  getAnalytics(@CurrentStore() storeId: string, @Query('period') period: string) {
    return this.searchService.getSearchAnalytics(storeId, period);
  }

  @Get('config')
  @Permissions('settings:read')
  getConfig(@CurrentStore() storeId: string) {
    return this.searchService.getSearchConfig(storeId);
  }

  @Put('config')
  @Permissions('settings:update')
  updateConfig(@CurrentStore() storeId: string, @Body() dto: any) {
    return this.searchService.updateSearchConfig(storeId, dto);
  }

  @Get('synonyms')
  @Permissions('settings:read')
  listSynonyms(@CurrentStore() storeId: string) {
    return this.searchService.listSynonyms(storeId);
  }

  @Post('synonyms')
  @Permissions('settings:update')
  createSynonym(@CurrentStore() storeId: string, @Body() dto: { terms: string[] }) {
    return this.searchService.createSynonym(storeId, dto);
  }

  @Delete('synonyms/:id')
  @Permissions('settings:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSynonym(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.searchService.removeSynonym(storeId, id);
  }

  @Get('merchandising')
  @Permissions('settings:read')
  listMerchandising(@CurrentStore() storeId: string) {
    return this.searchService.listMerchandisingRules(storeId);
  }

  @Post('merchandising')
  @Permissions('settings:update')
  createMerchandising(@CurrentStore() storeId: string, @Body() dto: any) {
    return this.searchService.createMerchandisingRule(storeId, dto);
  }

  @Put('merchandising/:id')
  @Permissions('settings:update')
  updateMerchandising(
    @CurrentStore() storeId: string,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.searchService.updateMerchandisingRule(storeId, id, dto);
  }

  @Delete('merchandising/:id')
  @Permissions('settings:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMerchandising(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.searchService.removeMerchandisingRule(storeId, id);
  }
}
