import {
  Controller, Get, Post, Delete, Param, Body, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SectionsService } from './sections.service';
import { CurrentStore }    from '@/common/decorators/current-store.decorator';
import { Permissions }     from '@/common/decorators/permissions.decorator';
import { SectionCategory, SectionTier } from '@prisma/client';

@ApiTags('Theme Engine')
@ApiBearerAuth()
@Controller('theme/sections')
export class SectionsController {
  constructor(private readonly sections: SectionsService) {}

  @Get()
  @Permissions('theme:read')
  @ApiOperation({ summary: 'List all section definitions (built-in + custom)' })
  @ApiQuery({ name: 'category', required: false, enum: SectionCategory })
  @ApiQuery({ name: 'tier',     required: false, enum: SectionTier })
  @ApiQuery({ name: 'search',   required: false })
  list(
    @CurrentStore() storeId: string,
    @Query('category') category?: SectionCategory,
    @Query('tier')     tier?:     SectionTier,
    @Query('search')   search?:   string,
  ) {
    return this.sections.listSections(storeId, { category, tier, search });
  }

  @Get(':id')
  @Permissions('theme:read')
  @ApiOperation({ summary: 'Get a single section definition with full settingsSchema' })
  findOne(@Param('id') id: string) {
    return this.sections.getSectionDefinition(id);
  }

  @Delete(':id')
  @Permissions('theme:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a CUSTOM section (blocked if in use)' })
  async remove(@CurrentStore() storeId: string, @Param('id') id: string) {
    await this.sections.deleteCustomSection(storeId, id);
  }
}
