import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CacheService } from '@/shared/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@/shared/cache/cache.constants';
import { ConfigStatus } from '@prisma/client';
import { UpdateHeaderDraftDto } from './dto/update-header-draft.dto';

const DEFAULT_ZONES = [
  {
    id:          'zone1',
    components:  [{ id: 'announcement-1', type: 'announcement', settings: { text: 'Welcome to our store!', textColor: '#ffffff' } }],
    // Use indigo as the default announcement bar background (matches editor preview).
    // 'transparent' was causing white-on-white invisible text in the storefront preview.
    background:  '#4f46e5',
    height:      'auto',
    visibility:  'all',
    paddingTop:   6,
    paddingBottom: 6,
    borderBottom: 'none',
  },
  {
    id: 'zone2',
    components: [
      { id: 'logo-1',  type: 'logo',       settings: { maxWidth: 120 } },
      { id: 'nav-1',   type: 'navigation', settings: { menuHandle: 'main-menu' } },
      { id: 'search-1',type: 'search',     settings: { style: 'icon_only' } },
      { id: 'cart-1',  type: 'cart',       settings: { openBehavior: 'sidebar' } },
      { id: 'acct-1',  type: 'account',    settings: {} },
    ],
    background:  '#ffffff',
    height:       'auto',
    visibility:  'all',
    paddingTop:   12,
    paddingBottom: 12,
    borderBottom: '1px',
    borderColor: '#e5e7eb',
  },
  {
    id:          'zone3',
    components:  [],
    background:  '#f9fafb',
    height:      'auto',
    visibility:  'desktop_only',
    paddingTop:   8,
    paddingBottom: 8,
    borderBottom: '1px',
    borderColor: '#e5e7eb',
  },
];

const DEFAULT_BEHAVIOR = {
  stickyMode:        'scroll_up',
  transparentOnHero: false,
  mobileBreakpoint:  'md',
  mobileDrawerStyle: 'slide_left',
  zIndex:            50,
};

@Injectable()
export class HeaderConfigService {
  private readonly logger = new Logger(HeaderConfigService.name);

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
    const cacheKey = CACHE_KEYS.headerConfig(storeId, 'draft');
    const cached   = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    let row = await this.prisma.headerConfig.findUnique({
      where: { storeId_status: { storeId, status: ConfigStatus.DRAFT } },
    });

    if (!row) {
      row = await this.prisma.headerConfig.create({
        data: {
          storeId,
          status:   ConfigStatus.DRAFT,
          zones:    DEFAULT_ZONES,
          behavior: DEFAULT_BEHAVIOR,
        },
      });
    }

    await this.cache.set(cacheKey, row, CACHE_TTL.HEADER_CONFIG);
    return row;
  }

  async getPublished(storeId: string) {
    const cacheKey = CACHE_KEYS.headerConfig(storeId, 'published');
    const cached   = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const row = await this.prisma.headerConfig.findUnique({
      where: { storeId_status: { storeId, status: ConfigStatus.PUBLISHED } },
    });

    if (row) await this.cache.set(cacheKey, row, CACHE_TTL.HEADER_CONFIG);
    return row;
  }

  async updateDraft(storeId: string, dto: UpdateHeaderDraftDto) {
    // Run domain validation before writing
    if (dto.zones) this.validateZones(dto.zones);

    const current  = await this.getDraft(storeId);
    const existing = current as any;

    const updated = await this.prisma.headerConfig.update({
      where: { storeId_status: { storeId, status: ConfigStatus.DRAFT } },
      data: {
        zones:    dto.zones    ?? existing.zones,
        behavior: dto.behavior ?? existing.behavior,
      },
    });

    await this.cache.del(CACHE_KEYS.headerConfig(storeId, 'draft'));
    return updated;
  }

  /** Returns the list of available header component types + their settings schema. */
  getComponentMetadata() {
    return HEADER_COMPONENT_METADATA;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  /**
   * Validation rule (spec): Zone 2 must contain at least one component.
   * Called on every draft update AND in PublishService before promoting.
   */
  validateZones(zones: any[]): void {
    const zone2 = zones.find((z: any) => z.id === 'zone2');
    if (zone2 && (!zone2.components || zone2.components.length === 0)) {
      throw new BadRequestException(
        'Header Zone 2 (main row) must have at least one component.',
      );
    }
  }
}

// ── Component metadata (static catalogue) ─────────────────────────────────────

const HEADER_COMPONENT_METADATA = [
  {
    type:  'logo',
    label: 'Logo',
    schema: [
      { key: 'imageUrl',  type: 'image',  label: 'Logo Image' },
      { key: 'altText',   type: 'text',   label: 'Alt Text' },
      { key: 'maxWidth',  type: 'number', label: 'Max Width (px)', default: 120, min: 60, max: 300 },
      { key: 'linkToHome',type: 'toggle', label: 'Link to Homepage', default: true },
    ],
  },
  {
    type:  'navigation',
    label: 'Navigation Menu',
    schema: [
      { key: 'menuHandle',   type: 'menu_picker', label: 'Menu', default: 'main-menu' },
      { key: 'submenuStyle', type: 'select',      label: 'Submenu Style',
        options: [{ label: 'Dropdown', value: 'dropdown' }, { label: 'Mega Menu', value: 'mega' }],
        default: 'dropdown',
      },
    ],
  },
  {
    type:  'search',
    label: 'Search Bar',
    schema: [
      { key: 'style', type: 'select', label: 'Style',
        options: [
          { label: 'Icon Only',  value: 'icon_only'  },
          { label: 'Expandable', value: 'expandable' },
          { label: 'Inline',     value: 'inline'     },
        ],
        default: 'icon_only',
      },
      { key: 'placeholder', type: 'text', label: 'Placeholder', default: 'Search…' },
    ],
  },
  {
    type:  'cart',
    label: 'Cart Icon',
    schema: [
      { key: 'openBehavior', type: 'select', label: 'Open Behavior',
        options: [
          { label: 'Sidebar', value: 'sidebar' },
          { label: 'Modal',   value: 'modal'   },
          { label: 'Page',    value: 'page'    },
        ],
        default: 'sidebar',
      },
      { key: 'badgeColor', type: 'color', label: 'Badge Color', default: '#ef4444' },
    ],
  },
  {
    type:  'account',
    label: 'Account Icon',
    schema: [
      { key: 'showNameWhenLoggedIn', type: 'toggle', label: 'Show Name When Logged In', default: false },
      { key: 'guestLabel',           type: 'text',   label: 'Guest Label', default: 'Sign In' },
    ],
  },
  {
    type:  'announcement',
    label: 'Announcement Text',
    schema: [
      { key: 'text',         type: 'text',   label: 'Announcement Text' },
      { key: 'link',         type: 'text',   label: 'Link URL' },
      { key: 'background',   type: 'color',  label: 'Background Color', default: '#4f46e5' },
      { key: 'dismissible',  type: 'toggle', label: 'Dismissible', default: false },
    ],
  },
  {
    type:  'cta_button',
    label: 'CTA Button',
    schema: [
      { key: 'label',        type: 'text',   label: 'Button Label', default: 'Shop Now' },
      { key: 'link',         type: 'text',   label: 'URL' },
      { key: 'variant',      type: 'select', label: 'Style',
        options: [{ label: 'Primary', value: 'primary' }, { label: 'Outline', value: 'outline' }],
        default: 'primary',
      },
      { key: 'hideOnMobile', type: 'toggle', label: 'Hide on Mobile', default: false },
    ],
  },
  {
    type:  'spacer',
    label: 'Spacer',
    schema: [
      { key: 'flexGrow', type: 'toggle', label: 'Fill Available Space', default: true },
      { key: 'width',    type: 'number', label: 'Fixed Width (px)',      default: 0   },
    ],
  },
];
