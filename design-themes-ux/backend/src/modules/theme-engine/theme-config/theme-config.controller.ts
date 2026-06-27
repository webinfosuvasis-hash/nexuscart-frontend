import {
  Controller, Get, Put, Post, Body, HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ThemeConfigService } from './theme-config.service';
import { PublishService }     from '../publish/publish.service';
import { UpdateThemeDraftDto } from './dto/update-theme-draft.dto';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { CurrentTheme } from '@/common/decorators/current-theme.decorator';
import { Permissions }  from '@/common/decorators/permissions.decorator';

@ApiTags('Theme Engine')
@ApiBearerAuth()
@Controller('theme/config')
export class ThemeConfigController {
  constructor(
    private readonly themeConfig:    ThemeConfigService,
    private readonly publishService: PublishService,
  ) {}

  @Get()
  @Permissions('theme:read')
  @ApiOperation({ summary: 'Get draft + published theme config for the active (or specified) theme' })
  async getConfigs(
    @CurrentStore() storeId:  string,
    @CurrentTheme() themeId?: string | null,
  ) {
    const tid = themeId ?? await this.themeConfig.resolveActiveThemeId(storeId);
    return this.themeConfig.getConfigs(storeId, tid);
  }

  @Put('draft')
  @Permissions('theme:update')
  @ApiOperation({ summary: 'Merge-patch draft theme config (colors, typography, layout)' })
  async updateDraft(
    @CurrentStore() storeId:  string,
    @CurrentTheme() themeId?: string | null,
    @Body() dto: UpdateThemeDraftDto = {},
  ) {
    const tid = themeId ?? await this.themeConfig.resolveActiveThemeId(storeId);
    return this.themeConfig.updateDraft(storeId, tid, dto);
  }

  @Post('publish')
  @Permissions('theme:publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish draft → live (auto-snapshot, cache invalidation, CDN purge)' })
  async publishDraft(
    @CurrentStore() storeId:  string,
    @CurrentTheme() themeId?: string | null,
  ) {
    const tid = themeId ?? await this.themeConfig.resolveActiveThemeId(storeId);
    return this.publishService.publish(storeId, tid);
  }

  @Post('discard-draft')
  @Permissions('theme:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset draft to last published state' })
  async discardDraft(
    @CurrentStore() storeId:  string,
    @CurrentTheme() themeId?: string | null,
  ) {
    const tid = themeId ?? await this.themeConfig.resolveActiveThemeId(storeId);
    await this.publishService.discardDraft(storeId, tid);
  }
}
