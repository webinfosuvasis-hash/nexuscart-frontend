import { Controller, Get, Put, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FooterConfigService } from './footer-config.service';
import { UpdateFooterDraftDto } from './dto/update-footer-draft.dto';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';

@ApiTags('Theme Engine')
@ApiBearerAuth()
@Controller('theme/footer')
export class FooterConfigController {
  constructor(private readonly footer: FooterConfigService) {}

  @Get()
  @Permissions('theme:read')
  @ApiOperation({ summary: 'Get draft + published footer config' })
  getConfigs(@CurrentStore() storeId: string) {
    return this.footer.getConfigs(storeId);
  }

  @Put('draft')
  @Permissions('theme:update')
  @ApiOperation({ summary: 'Update footer draft (columns, bottom bar, settings)' })
  updateDraft(
    @CurrentStore() storeId: string,
    @Body() dto: UpdateFooterDraftDto,
  ) {
    return this.footer.updateDraft(storeId, dto);
  }
}
