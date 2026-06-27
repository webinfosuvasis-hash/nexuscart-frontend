import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { PrismaModule } from '@/prisma/prisma.module';

import { ThemeConfigService }    from './theme-config/theme-config.service';
import { ThemeConfigController } from './theme-config/theme-config.controller';

import { HeaderConfigService }    from './header-config/header-config.service';
import { HeaderConfigController } from './header-config/header-config.controller';

import { FooterConfigService }    from './footer-config/footer-config.service';
import { FooterConfigController } from './footer-config/footer-config.controller';

import { PresetsService }    from './presets/presets.service';
import { PresetsController } from './presets/presets.controller';

import { SectionsService }          from './sections/sections.service';
import { SectionsController }       from './sections/sections.controller';
import { PageSectionsController }   from './sections/page-sections.controller';
import { BlocksController }         from './sections/blocks.controller';
import { BlockSettingsSanitizer }   from './sections/block-settings-sanitizer';

import { DefinitionsService }    from './definitions/definitions.service';
import { DefinitionsController } from './definitions/definitions.controller';

import { PublishService }    from './publish/publish.service';
import { PreviewService }    from './preview/preview.service';
import { PreviewController } from './preview/preview.controller';

/**
 * ThemeEngineModule — Sprint 1-2 + Sprint 4.5 Remediation
 *
 * New in Sprint 4.5:
 *   - DefinitionsService + DefinitionsController  → /theme/definitions/*
 *   - ThemeConfig now themeId-scoped (@@unique changed)
 *   - SectionsService + PageSectionsController now themeId-aware
 *   - PublishService.publish(storeId, themeId)
 *   - PreviewService.generatePreviewLink(storeId, themeId, pageId)
 */
@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:      config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: (config.get<string>('JWT_EXPIRES_IN', '7d')) as any },
      }),
    }),
  ],
  controllers: [
    ThemeConfigController,
    HeaderConfigController,
    FooterConfigController,
    PresetsController,
    SectionsController,
    PageSectionsController,
    BlocksController,
    DefinitionsController,
    PreviewController,
  ],
  providers: [
    ThemeConfigService,
    HeaderConfigService,
    FooterConfigService,
    PresetsService,
    BlockSettingsSanitizer,
    SectionsService,
    DefinitionsService,
    PublishService,
    PreviewService,
  ],
  exports: [
    ThemeConfigService,
    HeaderConfigService,
    FooterConfigService,
    SectionsService,
    DefinitionsService,
    PublishService,
    PreviewService,
  ],
})
export class ThemeEngineModule {}
