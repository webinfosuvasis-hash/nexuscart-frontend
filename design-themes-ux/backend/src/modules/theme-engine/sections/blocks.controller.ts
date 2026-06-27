import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SectionsService }   from './sections.service';
import { AddBlockDto }       from './dto/add-block.dto';
import { UpdateBlockDto }    from './dto/update-block.dto';
import { ReorderBlocksDto }  from './dto/reorder-blocks.dto';
import { CurrentStore }      from '@/common/decorators/current-store.decorator';
import { CurrentTheme }      from '@/common/decorators/current-theme.decorator';
import { Permissions }       from '@/common/decorators/permissions.decorator';
import { ThemeConfigService } from '../theme-config/theme-config.service';

/**
 * BlocksController — Sprint 4.5.1
 *
 * Manages ThemePageBlock rows within a section.
 * All block operations are themeId-scoped (via ThemeContextMiddleware).
 *
 * Route prefix: /theme/pages/:pageId/sections/:sectionId/blocks
 */
@ApiTags('Theme Engine')
@ApiBearerAuth()
@Controller('theme/pages/:pageId/sections/:sectionId/blocks')
export class BlocksController {
  constructor(
    private readonly sections:    SectionsService,
    private readonly themeConfig: ThemeConfigService,
  ) {}

  /** Resolve active themeId — header override → active theme fallback */
  private async tid(storeId: string, themeId: string | null): Promise<string> {
    return themeId ?? await this.themeConfig.resolveActiveThemeId(storeId);
  }

  @Get()
  @Permissions('theme:read')
  @ApiOperation({ summary: 'List all blocks for a section (ordered by sortOrder)' })
  @ApiQuery({ name: 'draft', required: false, type: Boolean, description: 'true = draft (default), false = published' })
  async getBlocks(
    @CurrentStore() storeId:    string,
    @Param('sectionId') sectionId: string,
    @Query('draft') draft?: string,
  ) {
    const isDraft = draft !== 'false';
    return this.sections.getBlocksForSection(storeId, sectionId, isDraft);
  }

  @Post()
  @Permissions('theme:update')
  @ApiOperation({ summary: 'Add a block to a section (validated against allowedBlockTypes)' })
  async addBlock(
    @CurrentStore() storeId:       string,
    @Param('pageId')    _pageId:   string,   // carried for route clarity; not used directly
    @Param('sectionId') sectionId: string,
    @CurrentTheme()     themeId:   string | null,
    @Body() dto: AddBlockDto,
  ) {
    const tid = await this.tid(storeId, themeId);
    return this.sections.addBlock(storeId, tid, sectionId, dto);
  }

  @Put()
  @Permissions('theme:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder all blocks in a section (submit ordered ID array)' })
  async reorderBlocks(
    @CurrentStore() storeId:       string,
    @Param('sectionId') sectionId: string,
    @Body() dto: ReorderBlocksDto,
  ) {
    return this.sections.reorderBlocks(storeId, sectionId, dto);
  }

  @Put(':blockId')
  @Permissions('theme:update')
  @ApiOperation({ summary: 'Update a single block (settings, sortOrder, or visibility)' })
  async updateBlock(
    @CurrentStore() storeId:       string,
    @Param('sectionId') sectionId: string,
    @Param('blockId')   blockId:   string,
    @Body() dto: UpdateBlockDto,
  ) {
    return this.sections.updateBlock(storeId, sectionId, blockId, dto);
  }

  @Delete(':blockId')
  @Permissions('theme:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a block (blocked if BlockDefinition.isRequired = true)' })
  async deleteBlock(
    @CurrentStore() storeId:       string,
    @Param('sectionId') sectionId: string,
    @Param('blockId')   blockId:   string,
  ) {
    await this.sections.deleteBlock(storeId, sectionId, blockId);
  }
}
