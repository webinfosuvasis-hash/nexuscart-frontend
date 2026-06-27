import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService }       from '@/prisma/prisma.service';
import { CacheService }        from '@/shared/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@/shared/cache/cache.constants';
import { ThemeConfigService }  from '@/modules/theme-engine/theme-config/theme-config.service';
import { HeaderConfigService } from '@/modules/theme-engine/header-config/header-config.service';
import { FooterConfigService } from '@/modules/theme-engine/footer-config/footer-config.service';
import { SectionsService }     from '@/modules/theme-engine/sections/sections.service';
import { DefinitionsService }  from '@/modules/theme-engine/definitions/definitions.service';
import { FeatureFlagService }  from '@/modules/content/feature-flag.service';
import { ConfigStatus }        from '@prisma/client';

// ─── Response shape ───────────────────────────────────────────────────────────

export interface BlockInstance {
  id:        string;
  type:      string;
  settings:  Record<string, any>;
  isVisible: boolean;
  sortOrder: number;
}

export interface SectionWithBlocks {
  id:        string;
  type:      string;
  label:     string;
  settings:  Record<string, any>;
  isVisible: boolean;
  blocks:    BlockInstance[];
}

export interface DraftPageData {
  storeId:    string;
  themeId:    string;
  pageId:     string;
  pageTitle:  string;
  store: {
    name:     string;
    currency: string;
    logo:     string | null;
  };
  themeConfig: {
    colors:     Record<string, string>;
    typography: Record<string, any>;
    layout:     Record<string, any>;
  };
  /** Zone-based header config (Option A — pre-section-group migration) */
  headerConfig: {
    zones:    any[];
    behavior: any;
  } | null;
  /** Column-based footer config (Option A — pre-section-group migration) */
  footerConfig: {
    columns:   any[];
    bottomBar: any;
    settings:  any;
  } | null;
  /** Ordered template sections (hero, featured_collection, etc.) with their blocks */
  sections: SectionWithBlocks[];
  /** Lean definition catalogue — name + icon only, no settingsSchema (not needed for rendering) */
  sectionDefinitions: Record<string, { name: string; icon: string; category: string }>;
  blockDefinitions:   Record<string, { name: string; icon: string }>;
  /** P0-8: Menu items keyed by handle — enables real navigation in the preview */
  menus: Record<string, Array<{ id: string; label: string; url: string }>>;
  generatedAt: string;
  /** ContentNode tree — present when CONTENT_NODE_ENABLED=true */
  nodeTree?:  Record<string, unknown> | null;
}

// ─── Default fallbacks ────────────────────────────────────────────────────────

const DEFAULT_COLORS = {
  primary: '#4f46e5', secondary: '#f5f5f5', accent: '#f59e0b',
  background: '#ffffff', text: '#1a1a1a', surface: '#f9fafb',
};
const DEFAULT_TYPOGRAPHY = { headingFont: 'Inter', bodyFont: 'Inter', baseSizeRem: 1.0, lineHeight: 1.6 };
const DEFAULT_LAYOUT     = { stickyHeader: true, sidebarCart: false, megaMenu: true, backToTop: true, cookieConsent: false };

// Redis TTL for the assembled DraftPageData object.
// Kept at 5 s so that after a Save the preview reflects changes quickly,
// while still absorbing burst requests on the same URL within a single second.
const PREVIEW_DATA_TTL = 5;

@Injectable()
export class StorefrontService {
  private readonly logger = new Logger(StorefrontService.name);

  constructor(
    private readonly prisma:      PrismaService,
    private readonly cache:       CacheService,
    private readonly themeConfig: ThemeConfigService,
    private readonly header:      HeaderConfigService,
    private readonly footer:      FooterConfigService,
    private readonly sections:    SectionsService,
    private readonly definitions: DefinitionsService,
    private readonly flags:       FeatureFlagService,
  ) {}

  /**
   * Builds the complete draft page data for storefront preview rendering.
   *
   * All data comes from DRAFT state — never from published or CDN cache.
   * The assembled DraftPageData is cached for 30s to handle burst requests
   * on the same preview URL while still reflecting recent draft saves.
   *
   * Query plan (all parallel):
   *   1. ThemeConfig draft        — colors, typography, layout
   *   2. HeaderConfig draft       — zones + behavior (Option A zone model)
   *   3. FooterConfig draft       — columns + bottomBar + settings (Option A column model)
   *   4. ThemePageSection draft   — ordered template sections with embedded blocks
   *   5. SectionDefinition lean   — name + icon + category (no settingsSchema)
   *   6. BlockDefinition lean     — name + icon
   *   7. Store + StoreSettings    — name, currency, logo
   */
  async buildDraftPageData(
    storeId: string,
    themeId: string,
    pageId:  string,
  ): Promise<DraftPageData> {
    // ── Feature flag: route to ContentNode path if enabled ────────────────────
    const contentNodeEnabled = await this.flags.get(storeId, 'CONTENT_NODE_ENABLED');
    if (contentNodeEnabled) {
      this.logger.log(`[ContentNode] Serving ${storeId}/${pageId} from PageDocument`);
      return this.buildFromPageDocument(storeId, themeId, pageId);
    }

    // ── Original path (ThemePageSection) ─────────────────────────────────────
    const cacheKey = `preview-draft:${storeId}:${themeId}:${encodeURIComponent(pageId)}`;
    const cached   = await this.cache.get<DraftPageData>(cacheKey);
    if (cached) {
      this.logger.debug(`Preview cache hit: ${cacheKey}`);
      return cached;
    }

    // ── Parallel data fetches ─────────────────────────────────────────────────
    const [
      themeConfigRow,
      headerConfigRow,
      footerConfigRow,
      rawSections,
      storeRow,
      menusRow,
    ] = await Promise.allSettled([
      this.themeConfig.getDraft(storeId, themeId).catch(() => null),
      this.header.getDraft(storeId).catch(() => null),
      this.footer.getDraft(storeId).catch(() => null),
      this.sections.getPageSections(storeId, themeId, pageId, true).catch(() => []),
      this.prisma.store.findUnique({
        where:  { id: storeId },
        select: { name: true, settings: { select: { currency: true, logo: true } } },
      }).catch(() => null),
      // P0-8: Load all menus so the header can render real navigation items
      this.prisma.menu.findMany({
        where:   { storeId },
        include: {
          items: {
            where:   { parentId: null },
            orderBy: { sortOrder: 'asc' },
            take:    20,
          },
        },
      }).catch(() => []),
    ]);

    const themeConfigData = themeConfigRow.status === 'fulfilled' ? themeConfigRow.value : null;
    const headerData      = headerConfigRow.status === 'fulfilled' ? headerConfigRow.value : null;
    const footerData      = footerConfigRow.status === 'fulfilled' ? footerConfigRow.value : null;
    const sectionsData    = rawSections.status === 'fulfilled' ? (rawSections.value as any[]) : [];
    const storeData       = storeRow.status === 'fulfilled' ? storeRow.value : null;
    const menusData       = menusRow.status === 'fulfilled' ? (menusRow.value as any[]) : [];

    // Build a handle→items map for O(1) lookup in the renderer
    const menuMap: Record<string, Array<{ id: string; label: string; url: string }>> = {};
    for (const menu of menusData) {
      menuMap[menu.handle] = (menu.items ?? []).map((item: any) => ({
        id:    item.id,
        label: item.label,
        url:   item.url ?? '#',
      }));
    }

    // Lean definition maps (no settingsSchema — not needed for rendering)
    const [sectionDefs, blockDefs] = await Promise.all([
      this.getLeanSectionDefs(storeId),
      this.getLeanBlockDefs(),
    ]);

    // Assemble theme config with fallbacks
    const config = (themeConfigData?.config as any) ?? {};
    const themeConfig = {
      colors:     { ...DEFAULT_COLORS,     ...(config.colors     ?? {}) },
      typography: { ...DEFAULT_TYPOGRAPHY, ...(config.typography ?? {}) },
      layout:     { ...DEFAULT_LAYOUT,     ...(config.layout     ?? {}) },
    };

    // Collect collection IDs needed for product resolution
    const collectionIds = new Set<string>();
    for (const s of sectionsData) {
      const settings = s.settings as Record<string, any> ?? {};
      const colId = settings.collection;
      if (colId && typeof colId === 'string' && colId.length >= 20) {
        collectionIds.add(colId);
      }
    }

    // Batch-resolve products for all bound collections
    const collectionProductsMap = new Map<string, any[]>();
    if (collectionIds.size > 0) {
      await Promise.all(
        Array.from(collectionIds).map(async (colId) => {
          try {
            const rows = await this.prisma.productCollection.findMany({
              where:   { collectionId: colId },
              include: { product: { select: { id:true, name:true, price:true, comparePrice:true, images:true, thumbnail:true, status:true } } },
              orderBy: { sortOrder: 'asc' },
              take:    24,
            });
            const products = rows
              .filter((r: any) => r.product?.status === 'ACTIVE')
              .map((r: any) => ({
                id:           r.product.id,
                name:         r.product.name,
                price:        Number(r.product.price),
                comparePrice: r.product.comparePrice ? Number(r.product.comparePrice) : undefined,
                image:        r.product.thumbnail ?? (r.product.images as string[])?.[0] ?? null,
                images:       r.product.images ?? [],
              }));
            collectionProductsMap.set(colId, products);
          } catch { /* skip on error */ }
        }),
      );
    }

    // Fall-back product list: first 5 active products in the store
    let fallbackProducts: any[] = [];
    if (collectionProductsMap.size === 0) {
      try {
        const rows = await this.prisma.product.findMany({
          where:   { storeId, status: 'ACTIVE' },
          select:  { id:true, name:true, price:true, comparePrice:true, images:true, thumbnail:true },
          orderBy: { createdAt: 'desc' },
          take:    5,
        });
        fallbackProducts = rows.map((p: any) => ({
          id:           p.id,
          name:         p.name,
          price:        Number(p.price),
          comparePrice: p.comparePrice ? Number(p.comparePrice) : undefined,
          image:        p.thumbnail ?? (p.images as string[])?.[0] ?? null,
          images:       p.images ?? [],
        }));
      } catch { /* skip */ }
    }

    // Transform raw sections (Prisma rows) → clean SectionWithBlocks[]
    // Products are injected into settings.resolvedProducts for the frontend renderer.
    const sections: SectionWithBlocks[] = sectionsData.map((s: any) => {
      const settings = (s.settings as Record<string, any>) ?? {};
      const colId    = settings.collection;
      const resolvedProducts = colId && collectionProductsMap.has(colId)
        ? collectionProductsMap.get(colId)!
        : (s.sectionDefId === 'featured_collection' || s.sectionDefId === 'product_grid')
          ? fallbackProducts
          : undefined;

      return {
        id:        s.id,
        type:      s.sectionDefId,
        label:     s.label ?? s.definition?.name ?? s.sectionDefId,
        settings:  resolvedProducts ? { ...settings, resolvedProducts } : settings,
        isVisible: s.isVisible ?? true,
        blocks:    (s.blocks ?? []).map((b: any) => ({
          id:        b.id,
          type:      b.type,
          settings:  (b.settings as Record<string, any>) ?? {},
          isVisible: b.isVisible ?? true,
          sortOrder: Number(b.sortOrder ?? 0),
        })).sort((a: BlockInstance, b: BlockInstance) => a.sortOrder - b.sortOrder),
      };
    });

    const data: DraftPageData = {
      storeId,
      themeId,
      pageId,
      pageTitle: this.pageTitle(pageId),
      store: {
        name:     (storeData as any)?.name          ?? 'My Store',
        currency: (storeData as any)?.settings?.currency ?? 'USD',
        logo:     (storeData as any)?.settings?.logo    ?? null,
      },
      themeConfig,
      headerConfig: headerData
        ? { zones: (headerData as any).zones ?? [], behavior: (headerData as any).behavior ?? {} }
        : null,
      footerConfig: footerData
        ? {
            columns:   (footerData as any).columns   ?? [],
            bottomBar: (footerData as any).bottomBar ?? {},
            settings:  (footerData as any).settings  ?? {},
          }
        : null,
      sections,
      sectionDefinitions: sectionDefs,
      blockDefinitions:   blockDefs,
      menus:              menuMap,
      generatedAt: new Date().toISOString(),
    };

    // Cache assembled result
    await this.cache.set(cacheKey, data, PREVIEW_DATA_TTL);
    this.logger.debug(`Built draft page data for ${storeId}/${themeId}/${pageId} — ${sections.length} sections`);

    return data;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async getLeanSectionDefs(storeId: string): Promise<Record<string, { name: string; icon: string; category: string }>> {
    const all = await this.definitions.listSectionDefinitions(storeId);
    const map: Record<string, { name: string; icon: string; category: string }> = {};
    for (const d of all) {
      map[d.id] = { name: d.name, icon: d.icon ?? '', category: d.category };
    }
    return map;
  }

  private async getLeanBlockDefs(): Promise<Record<string, { name: string; icon: string }>> {
    const all = await this.definitions.listBlockDefinitions();
    const map: Record<string, { name: string; icon: string }> = {};
    for (const d of all) {
      map[d.type] = { name: d.name, icon: d.icon ?? '' };
    }
    return map;
  }

  private pageTitle(pageId: string): string {
    const titles: Record<string, string> = {
      home:       'Home page',
      collection: 'Collections',
      product:    'Product',
      cart:       'Cart',
      search:     'Search',
    };
    if (pageId.startsWith('cms:')) return pageId.replace('cms:', '');
    return titles[pageId] ?? pageId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // ── ContentNode path (CONTENT_NODE_ENABLED = true) ──────────────────────────

  /**
   * Builds DraftPageData from a PageDocument tree.
   * Same response shape as the ThemePageSection path — the frontend
   * receives an identical structure. The difference is that `sections`
   * is replaced by `nodeTree` (the full ContentNode tree).
   *
   * NOTE: sections[] is populated from the tree's top-level children
   * for backward compatibility with storefront renderers that haven't
   * migrated to NodeRenderer yet. Sprint 15 removes this shim.
   */
  async buildFromPageDocument(
    storeId: string,
    themeId: string,
    pageId:  string,
  ): Promise<DraftPageData> {
    const cacheKey = `preview-node:${storeId}:${themeId}:${pageId}`;
    const cached   = await this.cache.get<DraftPageData>(cacheKey);
    if (cached) return cached;

    const [docRow, storeRow, menusRow] = await Promise.allSettled([
      this.prisma.pageDocument.findUnique({
        where: {
          storeId_themeId_ownerKey_status: {
            storeId, themeId, ownerKey: pageId, status: ConfigStatus.DRAFT,
          },
        },
      }),
      this.prisma.store.findUnique({
        where:  { id: storeId },
        select: { name: true, settings: { select: { currency: true, logo: true } } },
      }),
      this.prisma.menu.findMany({
        where:   { storeId },
        include: { items: { where: { parentId: null }, orderBy: { sortOrder: 'asc' }, take: 20 } },
      }),
    ]);

    const docData   = docRow.status   === 'fulfilled' ? docRow.value    : null;
    const storeData = storeRow.status === 'fulfilled' ? storeRow.value   : null;
    const menusData = menusRow.status === 'fulfilled' ? menusRow.value   : [];

    const menuMap: Record<string, { id: string; label: string; url: string }[]> = {};
    for (const menu of menusData) {
      menuMap[menu.handle] = (menu.items ?? []).map((item: any) => ({
        id: item.id, label: item.label, url: item.url ?? '#',
      }));
    }

    // Load theme config for tokens
    const themeConfigRow = await this.themeConfig.getDraft(storeId, themeId).catch(() => null);
    const config = (themeConfigRow?.config as any) ?? {};
    const themeConfig = {
      colors:     { ...DEFAULT_COLORS,     ...(config.colors     ?? {}) },
      typography: { ...DEFAULT_TYPOGRAPHY, ...(config.typography ?? {}) },
      layout:     { ...DEFAULT_LAYOUT,     ...(config.layout     ?? {}) },
    };

    // Lean definition maps
    const [sectionDefs, blockDefs] = await Promise.all([
      this.getLeanSectionDefs(storeId),
      this.getLeanBlockDefs(),
    ]);

    const tree = (docData?.tree ?? null) as any;

    // Back-compat shim: derive sections[] from tree top-level children
    const sections: SectionWithBlocks[] = tree?.children
      ? tree.children.map((node: any) => ({
          id:        node.id,
          type:      node.type,
          label:     node.label ?? node.type,
          settings:  node.settings ?? {},
          isVisible: node.visibility?.desktop !== false,
          blocks:    (node.children ?? []).map((child: any) => ({
            id:        child.id,
            type:      child.type,
            settings:  child.settings ?? {},
            isVisible: child.visibility?.desktop !== false,
            sortOrder: 0,
          })),
        }))
      : [];

    const data: DraftPageData = {
      storeId,
      themeId,
      pageId,
      pageTitle:   this.pageTitle(pageId),
      store: {
        name:     (storeData as any)?.name              ?? 'My Store',
        currency: (storeData as any)?.settings?.currency ?? 'INR',
        logo:     (storeData as any)?.settings?.logo     ?? null,
      },
      themeConfig,
      headerConfig: null,      // Header as SymbolDocument ships in Sprint 14
      footerConfig: null,
      sections,
      sectionDefinitions: sectionDefs,
      blockDefinitions:   blockDefs,
      menus:              menuMap,
      // ContentNode-specific: include the full tree for NodeRenderer
      nodeTree:    tree,
      generatedAt: new Date().toISOString(),
    };

    await this.cache.set(cacheKey, data, PREVIEW_DATA_TTL);
    this.logger.debug(`Built PageDocument data for ${storeId}/${themeId}/${pageId}`);
    return data;
  }
}
