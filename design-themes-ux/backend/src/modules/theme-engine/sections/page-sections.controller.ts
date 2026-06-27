import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SectionsService }       from './sections.service';
import { AddPageSectionDto }     from './dto/add-page-section.dto';
import { UpdatePageSectionDto }  from './dto/update-page-section.dto';
import { UpsertPageSectionsDto } from './dto/upsert-page-sections.dto';
import { CurrentStore }  from '@/common/decorators/current-store.decorator';
import { CurrentTheme }  from '@/common/decorators/current-theme.decorator';
import { Permissions }   from '@/common/decorators/permissions.decorator';
import { ThemeConfigService } from '../theme-config/theme-config.service';

@ApiTags('Theme Engine')
@ApiBearerAuth()
@Controller('theme/pages/:pageId/sections')
export class PageSectionsController {
  constructor(
    private readonly sections:     SectionsService,
    private readonly themeConfig:  ThemeConfigService,
  ) {}

  /** Resolve themeId — from middleware or fall back to active theme */
  private async tid(storeId: string, themeId?: string | null): Promise<string> {
    return themeId ?? await this.themeConfig.resolveActiveThemeId(storeId);
  }

  @Get()
  @Permissions('theme:read')
  @ApiOperation({ summary: 'Get ordered sections for a page (draft or published)' })
  @ApiQuery({ name: 'draft', required: false, type: Boolean })
  async getPageSections(
    @CurrentStore() storeId: string,
    @Param('pageId') pageId: string,
    @CurrentTheme() themeId: string | null,
    @Query('draft')  draft?: string,
  ) {
    const tid     = await this.tid(storeId, themeId);
    const isDraft = draft !== 'false';
    return this.sections.getPageSections(storeId, tid, pageId, isDraft);
  }

  @Put()
  @Permissions('theme:update')
  @ApiOperation({ summary: 'Batch replace all draft sections for a page' })
  async upsertPageSections(
    @CurrentStore() storeId: string,
    @Param('pageId') pageId: string,
    @CurrentTheme() themeId: string | null,
    @Body() dto: UpsertPageSectionsDto,
  ) {
    const tid = await this.tid(storeId, themeId);
    return this.sections.upsertPageSections(storeId, tid, pageId, dto);
  }

  @Post()
  @Permissions('theme:update')
  @ApiOperation({ summary: 'Add a single section to a page' })
  async addPageSection(
    @CurrentStore() storeId: string,
    @Param('pageId') pageId: string,
    @CurrentTheme() themeId: string | null,
    @Body() dto: AddPageSectionDto,
  ) {
    const tid = await this.tid(storeId, themeId);
    return this.sections.addPageSection(storeId, tid, pageId, dto);
  }

  @Put(':sectionId')
  @Permissions('theme:update')
  @ApiOperation({ summary: 'Update a single section instance' })
  async updatePageSection(
    @CurrentStore() storeId:    string,
    @Param('pageId')    pageId:    string,
    @Param('sectionId') sectionId: string,
    @CurrentTheme()     themeId:   string | null,
    @Body() dto: UpdatePageSectionDto,
  ) {
    const tid = await this.tid(storeId, themeId);
    return this.sections.updatePageSection(storeId, tid, pageId, sectionId, dto);
  }

  @Delete(':sectionId')
  @Permissions('theme:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a section instance from a page' })
  async deletePageSection(
    @CurrentStore() storeId:    string,
    @Param('pageId')    pageId:    string,
    @Param('sectionId') sectionId: string,
    @CurrentTheme()     themeId:   string | null,
  ) {
    const tid = await this.tid(storeId, themeId);
    await this.sections.deletePageSection(storeId, tid, pageId, sectionId);
  }
}
