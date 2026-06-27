import {
  Controller, Get, Post, Put, Delete, Param, Body,
  Query, HttpCode, HttpStatus, Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { PresetsService } from './presets.service';
import { CreatePresetDto }  from './dto/create-preset.dto';
import { UpdatePresetDto }  from './dto/update-preset.dto';
import { ImportPresetDto }  from './dto/import-preset.dto';
import { CurrentStore }     from '@/common/decorators/current-store.decorator';
import { Permissions }      from '@/common/decorators/permissions.decorator';

@ApiTags('Theme Engine')
@ApiBearerAuth()
@Controller('theme/presets')
export class PresetsController {
  constructor(private readonly presets: PresetsService) {}

  @Get()
  @Permissions('theme:read')
  @ApiOperation({ summary: 'List system, custom, and auto-snapshot presets' })
  list(@CurrentStore() storeId: string) {
    return this.presets.listPresets(storeId);
  }

  @Get('compare')
  @Permissions('theme:read')
  @ApiOperation({ summary: 'Deep diff two presets — returns changed fields' })
  @ApiQuery({ name: 'a', required: true, description: 'Preset ID A' })
  @ApiQuery({ name: 'b', required: true, description: 'Preset ID B' })
  compare(
    @CurrentStore() storeId: string,
    @Query('a') presetIdA: string,
    @Query('b') presetIdB: string,
  ) {
    return this.presets.comparePresets(storeId, presetIdA, presetIdB);
  }

  @Post()
  @Permissions('theme:update')
  @ApiOperation({ summary: 'Save current draft config as a named preset' })
  create(@CurrentStore() storeId: string, @Body() dto: CreatePresetDto) {
    return this.presets.createPreset(storeId, dto);
  }

  @Post('import')
  @Permissions('theme:update')
  @ApiOperation({ summary: 'Import a preset from an exported JSON file' })
  import(@CurrentStore() storeId: string, @Body() dto: ImportPresetDto) {
    return this.presets.importPreset(storeId, dto);
  }

  @Get(':id')
  @Permissions('theme:read')
  @ApiOperation({ summary: 'Get a single preset with full config' })
  findOne(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.presets.getPreset(storeId, id);
  }

  @Put(':id')
  @Permissions('theme:update')
  @ApiOperation({ summary: 'Update preset name / description / tag (CUSTOM only)' })
  update(
    @CurrentStore() storeId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePresetDto,
  ) {
    return this.presets.updatePreset(storeId, id, dto);
  }

  @Delete(':id')
  @Permissions('theme:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a CUSTOM preset' })
  async remove(@CurrentStore() storeId: string, @Param('id') id: string) {
    await this.presets.deletePreset(storeId, id);
  }

  @Post(':id/apply')
  @Permissions('theme:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply preset config to draft (creates auto-snapshot first)' })
  apply(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.presets.applyPreset(storeId, id);
  }

  @Post(':id/duplicate')
  @Permissions('theme:update')
  @ApiOperation({ summary: 'Clone a preset as a new CUSTOM preset' })
  duplicate(@CurrentStore() storeId: string, @Param('id') id: string) {
    return this.presets.duplicatePreset(storeId, id);
  }

  @Get(':id/export')
  @Permissions('theme:read')
  @ApiOperation({ summary: 'Download preset config as JSON' })
  async export(
    @CurrentStore() storeId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const data = await this.presets.exportPreset(storeId, id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="preset-${id}.json"`);
    res.json(data);
  }
}
