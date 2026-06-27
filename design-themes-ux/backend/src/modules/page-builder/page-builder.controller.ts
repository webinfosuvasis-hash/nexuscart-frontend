import {
  Controller, Get, Post, Patch, Put,
  Param, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PageBuilderService } from './page-builder.service';
import { UpdateSectionDto } from './dto/update-section.dto';
import { ReorderSectionsDto } from './dto/reorder-sections.dto';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';

@ApiTags('Page Builder')
@ApiBearerAuth()
@Controller('page-builder')
export class PageBuilderController {
  constructor(private readonly service: PageBuilderService) {}

  // ── Homepage ────────────────────────────────────────────────────────────────

  @Get('homepage')
  @Permissions('homepage:read')
  @ApiOperation({ summary: 'Get homepage with all sections (auto-seeds on first call)' })
  getHomepage(@CurrentStore() storeId: string) {
    return this.service.getHomepage(storeId);
  }

  @Post('homepage/seed')
  @Permissions('homepage:edit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-seed homepage with Aurus defaults (idempotent)' })
  seedHomepage(@CurrentStore() storeId: string) {
    return this.service.seedHomepage(storeId);
  }

  // ── Generic pages ───────────────────────────────────────────────────────────

  @Get('pages')
  @Permissions('homepage:read')
  @ApiOperation({ summary: 'List all builder pages for this store (summary, no sections)' })
  listPages(@CurrentStore() storeId: string) {
    return this.service.listPages(storeId);
  }

  @Get('pages/:pageType/:slug')
  @Permissions('homepage:read')
  @ApiOperation({ summary: 'Get a specific page with all its sections' })
  getPage(
    @CurrentStore() storeId: string,
    @Param('pageType') pageType: string,
    @Param('slug')     slug:     string,
  ) {
    return this.service.getPage(storeId, pageType, slug);
  }

  // ── Sections ────────────────────────────────────────────────────────────────
  // IMPORTANT: /sections/reorder must be declared BEFORE /sections/:id
  // so NestJS matches the static 'reorder' path before the dynamic ':id'.

  @Put('sections/reorder')
  @Permissions('homepage:edit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk reorder sections — atomic sortOrder update' })
  reorderSections(
    @CurrentStore()   storeId: string,
    @Body()           dto:     ReorderSectionsDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.reorderSections(storeId, dto, userId);
  }

  @Get('sections/:id')
  @Permissions('homepage:read')
  @ApiOperation({ summary: 'Get a single section with its current config' })
  getSection(
    @CurrentStore() storeId: string,
    @Param('id')    id:      string,
  ) {
    return this.service.getSection(storeId, id);
  }

  @Patch('sections/:id/toggle')
  @Permissions('homepage:edit')
  @ApiOperation({ summary: 'Toggle section visibility (isEnabled on/off)' })
  toggleSection(
    @CurrentStore()    storeId: string,
    @Param('id')       id:      string,
    @CurrentUser('id') userId:  string,
  ) {
    return this.service.toggleSection(storeId, id, userId);
  }

  @Patch('sections/:id')
  @Permissions('homepage:edit')
  @ApiOperation({ summary: 'Update section config, label, status, or scheduling' })
  updateSection(
    @CurrentStore()    storeId: string,
    @Param('id')       id:      string,
    @Body()            dto:     UpdateSectionDto,
    @CurrentUser('id') userId:  string,
  ) {
    return this.service.updateSection(storeId, id, dto, userId);
  }
}
