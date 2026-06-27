import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { PreviewService }   from './preview.service';
import { CurrentStore }     from '@/common/decorators/current-store.decorator';
import { CurrentTheme }     from '@/common/decorators/current-theme.decorator';
import { Permissions }      from '@/common/decorators/permissions.decorator';
import { ThemeConfigService } from '../theme-config/theme-config.service';

class GeneratePreviewLinkDto {
  @IsString() @IsNotEmpty()
  pageId: string;

  /**
   * Optional explicit themeId. If omitted, defaults to the store's active theme.
   * Use this to generate a preview link for a specific installed (non-active) theme.
   */
  @IsString() @IsOptional()
  themeId?: string;
}

@ApiTags('Theme Engine')
@ApiBearerAuth()
@Controller('theme/preview-link')
export class PreviewController {
  constructor(
    private readonly preview:      PreviewService,
    private readonly themeConfig:  ThemeConfigService,
  ) {}

  @Post()
  @Permissions('theme:read')
  @ApiOperation({
    summary: 'Generate a signed 24-hour preview URL for a specific page and theme',
    description:
      'Returns a URL that renders the DRAFT config. ' +
      'Shareable with clients for approval. ' +
      'JWT now includes themeId for per-theme preview support.',
  })
  async generatePreviewLink(
    @CurrentStore() storeId:  string,
    @CurrentTheme() resolvedThemeId?: string | null,
    @Body() dto: GeneratePreviewLinkDto = { pageId: 'home' },
  ) {
    // Explicit themeId in body > X-Theme-Id header > active theme
    const themeId =
      dto.themeId ??
      resolvedThemeId ??
      await this.themeConfig.resolveActiveThemeId(storeId);

    return this.preview.generatePreviewLink(storeId, themeId, dto.pageId);
  }
}
