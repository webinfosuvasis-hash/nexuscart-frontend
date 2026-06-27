import {
  Controller, Get, Post, Delete, Put, Body, Param,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ThemesService } from './themes.service';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('Themes')
@ApiBearerAuth()
@Controller('themes')
export class ThemesController {
  constructor(private readonly themes: ThemesService) {}

  @Public()
  @Get('marketplace')
  @ApiOperation({ summary: 'Browse theme marketplace' })
  listMarketplace() {
    return this.themes.listMarketplaceThemes();
  }

  @Get('installed')
  @Permissions('themes:read')
  @ApiOperation({ summary: 'List themes installed for this store' })
  listInstalled(@CurrentStore() storeId: string) {
    return this.themes.listInstalledThemes(storeId);
  }

  @Get('active')
  @Permissions('themes:read')
  @ApiOperation({ summary: 'Get currently active theme' })
  getActive(@CurrentStore() storeId: string) {
    return this.themes.getActiveTheme(storeId);
  }

  @Post(':themeId/install')
  @Permissions('themes:update')
  @ApiOperation({ summary: 'Install a marketplace theme to this store' })
  install(@CurrentStore() storeId: string, @Param('themeId') themeId: string) {
    return this.themes.installTheme(storeId, themeId);
  }

  @Post(':storeThemeId/activate')
  @Permissions('themes:update')
  @ApiOperation({ summary: 'Activate an installed theme' })
  activate(@CurrentStore() storeId: string, @Param('storeThemeId') id: string) {
    return this.themes.activateTheme(storeId, id);
  }

  @Delete(':storeThemeId/uninstall')
  @Permissions('themes:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Uninstall a non-active theme' })
  uninstall(@CurrentStore() storeId: string, @Param('storeThemeId') id: string) {
    return this.themes.uninstallTheme(storeId, id);
  }

  @Get('settings')
  @Permissions('themes:read')
  @ApiOperation({ summary: 'Get active theme customization settings' })
  getSettings(@CurrentStore() storeId: string) {
    return this.themes.getThemeSettings(storeId);
  }

  @Put('settings')
  @Permissions('themes:update')
  @ApiOperation({ summary: 'Update active theme customization settings' })
  updateSettings(
    @CurrentStore() storeId: string,
    @Body() body: Record<string, any>,
  ) {
    return this.themes.updateThemeSettings(storeId, body);
  }
}
