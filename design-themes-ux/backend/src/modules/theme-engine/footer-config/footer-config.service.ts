import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CacheService } from '@/shared/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@/shared/cache/cache.constants';
import { ConfigStatus } from '@prisma/client';
import { UpdateFooterDraftDto } from './dto/update-footer-draft.dto';

const DEFAULT_COLUMNS = [
  {
    id: 'col-brand', title: 'Brand', widthPercent: 40,
    widgets: [
      { id: 'brand-block-1', type: 'brand_block', settings: { showSocial: true } },
      { id: 'newsletter-1',  type: 'newsletter',  settings: { heading: 'Stay in the Loop' } },
    ],
  },
  {
    id: 'col-shop', title: 'Shop', widthPercent: 20,
    widgets: [{ id: 'nav-shop-1', type: 'nav_column', settings: { title: 'Shop', menuHandle: 'footer-shop' } }],
  },
  {
    id: 'col-help', title: 'Help', widthPercent: 20,
    widgets: [{ id: 'nav-help-1', type: 'nav_column', settings: { title: 'Help', menuHandle: 'footer-help' } }],
  },
  {
    id: 'col-app', title: 'Get the App', widthPercent: 20,
    widgets: [{ id: 'app-badges-1', type: 'app_badges', settings: {} }],
  },
];

const DEFAULT_BOTTOM_BAR = {
  backgroundColor: '#1f2937',
  components: [
    { id: 'copyright-1',  type: 'copyright',     settings: { text: '© {{year}} {{store_name}}. All rights reserved.' } },
    { id: 'payments-1',   type: 'payment_badges', settings: { set: 'stripe' } },
    { id: 'legal-links-1',type: 'legal_links',    settings: {} },
  ],
};

const DEFAULT_SETTINGS = {
  topBackground: '#111827',
  topBorder:     true,
  divider:       true,
  dividerColor:  '#374151',
  paddingTop:    48,
  paddingBottom: 48,
  showBottomBar: true,
  bottomBarBg:   '#0f172a',
};

@Injectable()
export class FooterConfigService {
  private readonly logger = new Logger(FooterConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache:  CacheService,
  ) {}

  async getConfigs(storeId: string) {
    const [draft, published] = await Promise.all([
      this.getDraft(storeId),
      this.getPublished(storeId),
    ]);
    return { draft, published };
  }

  async getDraft(storeId: string) {
    const cacheKey = CACHE_KEYS.footerConfig(storeId, 'draft');
    const cached   = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    let row = await this.prisma.footerConfig.findUnique({
      where: { storeId_status: { storeId, status: ConfigStatus.DRAFT } },
    });

    if (!row) {
      row = await this.prisma.footerConfig.create({
        data: {
          storeId,
          status:    ConfigStatus.DRAFT,
          columns:   DEFAULT_COLUMNS,
          bottomBar: DEFAULT_BOTTOM_BAR,
          settings:  DEFAULT_SETTINGS,
        },
      });
    }

    await this.cache.set(cacheKey, row, CACHE_TTL.FOOTER_CONFIG);
    return row;
  }

  async getPublished(storeId: string) {
    const cacheKey = CACHE_KEYS.footerConfig(storeId, 'published');
    const cached   = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const row = await this.prisma.footerConfig.findUnique({
      where: { storeId_status: { storeId, status: ConfigStatus.PUBLISHED } },
    });

    if (row) await this.cache.set(cacheKey, row, CACHE_TTL.FOOTER_CONFIG);
    return row;
  }

  async updateDraft(storeId: string, dto: UpdateFooterDraftDto) {
    if (dto.columns) this.validateColumns(dto.columns);

    const current = await this.getDraft(storeId);
    const existing = current as any;

    const updated = await this.prisma.footerConfig.update({
      where: { storeId_status: { storeId, status: ConfigStatus.DRAFT } },
      data: {
        columns:   dto.columns   ?? existing.columns,
        bottomBar: dto.bottomBar ?? existing.bottomBar,
        settings:  dto.settings  ?? existing.settings,
      },
    });

    await this.cache.del(CACHE_KEYS.footerConfig(storeId, 'draft'));
    return updated;
  }

  /**
   * Validation rule (spec): column widthPercent values must sum to 100.
   * Called on every draft update AND in PublishService before promoting.
   */
  validateColumns(columns: any[]): void {
    const total = columns.reduce((sum, col) => sum + (col.widthPercent ?? 0), 0);
    if (total !== 100) {
      throw new BadRequestException(
        `Footer column widths must sum to 100%. Current total: ${total}%.`,
      );
    }
    if (columns.length < 2 || columns.length > 5) {
      throw new BadRequestException('Footer must have between 2 and 5 columns.');
    }
  }
}
