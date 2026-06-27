import { Controller, Get, Put, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { HeaderConfigService } from './header-config.service';
import { UpdateHeaderDraftDto } from './dto/update-header-draft.dto';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';

@ApiTags('Theme Engine')
@ApiBearerAuth()
@Controller('theme/header')
export class HeaderConfigController {
  constructor(private readonly header: HeaderConfigService) {}

  @Get()
  @Permissions('theme:read')
  @ApiOperation({ summary: 'Get draft + published header config' })
  getConfigs(@CurrentStore() storeId: string) {
    return this.header.getConfigs(storeId);
  }

  @Put('draft')
  @Permissions('theme:update')
  @ApiOperation({ summary: 'Update header draft (zones + behavior)' })
  updateDraft(
    @CurrentStore() storeId: string,
    @Body() dto: UpdateHeaderDraftDto,
  ) {
    return this.header.updateDraft(storeId, dto);
  }

  @Get('components')
  @Permissions('theme:read')
  @ApiOperation({ summary: 'List available header component types with settings schema' })
  getComponentMetadata() {
    return this.header.getComponentMetadata();
  }
}
