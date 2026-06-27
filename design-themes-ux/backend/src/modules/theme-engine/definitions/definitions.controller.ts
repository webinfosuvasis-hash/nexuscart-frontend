import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DefinitionsService } from './definitions.service';
import { CurrentStore }       from '@/common/decorators/current-store.decorator';
import { Permissions }        from '@/common/decorators/permissions.decorator';
import { SectionCategory, SectionTier } from '@prisma/client';

@ApiTags('Theme Engine')
@ApiBearerAuth()
@Controller('theme/definitions')
export class DefinitionsController {
  constructor(private readonly definitions: DefinitionsService) {}

  // ── Section Definitions ──────────────────────────────────────────────────────

  @Get('sections')
  @Permissions('theme:read')
  @ApiOperation({ summary: 'List all section definitions (built-in + custom for this store)' })
  @ApiQuery({ name: 'category', required: false, enum: SectionCategory })
  @ApiQuery({ name: 'tier',     required: false, enum: SectionTier })
  @ApiQuery({ name: 'search',   required: false })
  listSections(
    @CurrentStore() storeId: string,
    @Query('category') category?: SectionCategory,
    @Query('tier')     tier?:     SectionTier,
    @Query('search')   search?:   string,
  ) {
    return this.definitions.listSectionDefinitions(storeId, { category, tier, search });
  }

  @Get('sections/:type')
  @Permissions('theme:read')
  @ApiOperation({ summary: 'Get a single section definition with full settingsSchema' })
  getSectionDefinition(@Param('type') type: string) {
    return this.definitions.getSectionDefinition(type);
  }

  // ── Block Definitions ────────────────────────────────────────────────────────

  @Get('blocks')
  @Permissions('theme:read')
  @ApiOperation({ summary: 'List all block definitions, optionally filtered by section type' })
  @ApiQuery({ name: 'sectionType', required: false, description: 'Filter by allowedInSections' })
  listBlocks(@Query('sectionType') sectionType?: string) {
    return this.definitions.listBlockDefinitions({ sectionType });
  }

  @Get('blocks/:type')
  @Permissions('theme:read')
  @ApiOperation({ summary: 'Get a single block definition with full settingsSchema' })
  getBlockDefinition(@Param('type') type: string) {
    return this.definitions.getBlockDefinition(type);
  }
}
