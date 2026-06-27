/**
 * Phase 10A — Header/Footer extraction tests
 *
 * Five test groups:
 *   1. Header extraction     — zones, behavior, component ordering
 *   2. Footer extraction     — settings, bottomBar, copyright
 *   3. Empty header/footer   — null when group nodes are absent
 *   4. Save integration      — writeHeaderFooterShadow calls correct endpoints
 *   5. Rollback recovery     — extracted config survives MOCK_PAGE_DOC round-trip
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractHeaderConfig,
  extractFooterConfig,
  extractHeaderFooter,
  writeHeaderFooterShadow,
} from '../extractHeaderFooter';
import { buildNodeTreeFromPageDoc } from '../pageDocNodeTree';
import { sectionToNode }           from '../sectionNodeAdapter';
import { MOCK_PAGE_DOC }           from '@/admin/editor/editor-mock-data';
import type { Node }               from '@/components/node-renderer/types';
import type { PageDoc, SectionDoc } from '@/admin/editor/types';

// ─── Mock service ─────────────────────────────────────────────────────────────

vi.mock('@/services/themeEngineService', async () => {
  const actual = await vi.importActual<typeof import('@/services/themeEngineService')>(
    '@/services/themeEngineService',
  );
  return {
    ...actual,
    themeEngineService: {
      ...actual.themeEngineService,
      updateHeaderDraft: vi.fn(),
      updateFooterDraft: vi.fn(),
    },
  };
});

import { themeEngineService } from '@/services/themeEngineService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TREE = buildNodeTreeFromPageDoc(MOCK_PAGE_DOC);

const ANN_SECTION: SectionDoc = MOCK_PAGE_DOC.groups.header!.sections
  .find((s) => s.type === 'announcement_bar')!;
const HDR_SECTION: SectionDoc = MOCK_PAGE_DOC.groups.header!.sections
  .find((s) => s.type === 'header')!;
const FTR_SECTION: SectionDoc = MOCK_PAGE_DOC.groups.footer!.sections
  .find((s) => s.type === 'footer')!;

const ANN_NODE = sectionToNode(ANN_SECTION);
const HDR_NODE = sectionToNode(HDR_SECTION);
const FTR_NODE = sectionToNode(FTR_SECTION);

// ─── 1. Header extraction ─────────────────────────────────────────────────────

describe('extractHeaderConfig — header extraction', () => {
  const config = extractHeaderConfig(ANN_NODE, HDR_NODE)!;

  it('returns a non-null config when both nodes are present', () => {
    expect(config).not.toBeNull();
  });

  it('produces exactly 3 zones (zone1, zone2, zone3)', () => {
    expect(config.zones).toHaveLength(3);
    expect(config.zones[0].id).toBe('zone1');
    expect(config.zones[1].id).toBe('zone2');
    expect(config.zones[2].id).toBe('zone3');
  });

  // Zone 1: announcement bar
  it('zone1 background matches annBarNode settings', () => {
    expect(config.zones[0].background).toBe(String(ANN_SECTION.settings.background ?? '#4f46e5'));
  });

  it('zone1 textColor matches annBarNode settings', () => {
    expect(config.zones[0].textColor).toBe(String(ANN_SECTION.settings.textColor ?? '#ffffff'));
  });

  it('zone1 visibility is all when annSection is visible', () => {
    expect(config.zones[0].visibility).toBe('all');
  });

  it('zone1 includes the announcement block component', () => {
    const components = config.zones[0].components;
    expect(components).toHaveLength(1);
    expect(components[0].type).toBe('announcement');
  });

  it('zone1 announcement component has no _nx_* keys in settings', () => {
    const settings = config.zones[0].components[0].settings;
    for (const key of Object.keys(settings)) {
      expect(key.startsWith('_nx_')).toBe(false);
    }
  });

  // Zone 2: main nav
  it('zone2 contains logo component', () => {
    const types = config.zones[1].components.map((c) => c.type);
    expect(types).toContain('logo');
  });

  it('zone2 maps menu block to navigation component type', () => {
    const types = config.zones[1].components.map((c) => c.type);
    expect(types).toContain('navigation');
    expect(types).not.toContain('menu');
  });

  it('zone2 component settings have no _nx_* keys', () => {
    for (const comp of config.zones[1].components) {
      for (const key of Object.keys(comp.settings)) {
        expect(key.startsWith('_nx_')).toBe(false);
      }
    }
  });

  it('zone3 visibility is desktop_only', () => {
    expect(config.zones[2].visibility).toBe('desktop_only');
  });

  it('zone3 has no components (placeholder)', () => {
    expect(config.zones[2].components).toHaveLength(0);
  });

  // Behavior
  it('includes a behavior object', () => {
    expect(config.behavior).toBeDefined();
  });

  it('behavior stickyMode matches header settings', () => {
    const expected = String(HDR_SECTION.settings.stickyMode ?? 'scroll_up');
    expect(config.behavior!.stickyMode).toBe(expected);
  });

  it('behavior logoPosition matches header settings', () => {
    const expected = String(HDR_SECTION.settings.logoPosition ?? 'left');
    expect(config.behavior!.logoPosition).toBe(expected);
  });

  it('behavior contains all required fields', () => {
    const b = config.behavior!;
    expect(b.stickyMode).toBeDefined();
    expect(b.transparentOnHero).toBeDefined();
    expect(b.mobileBreakpoint).toBeDefined();
    expect(b.headerFont).toBeDefined();
    expect(b.headerFontSize).toBeDefined();
  });
});

// ─── 2. Footer extraction ─────────────────────────────────────────────────────

describe('extractFooterConfig — footer extraction', () => {
  const config = extractFooterConfig(FTR_NODE)!;

  it('returns a non-null config when footerNode is present', () => {
    expect(config).not.toBeNull();
  });

  it('settings.topBackground matches footer settings.background', () => {
    expect(config.settings.topBackground).toBe(
      String(FTR_SECTION.settings.background ?? '#111827'),
    );
  });

  it('settings.paddingTop matches footer settings', () => {
    expect(config.settings.paddingTop).toBe(Number(FTR_SECTION.settings.paddingTop ?? 48));
  });

  it('settings.paddingBottom matches footer settings', () => {
    expect(config.settings.paddingBottom).toBe(Number(FTR_SECTION.settings.paddingBottom ?? 48));
  });

  it('settings.bottomBarBg is a string', () => {
    expect(typeof config.settings.bottomBarBg).toBe('string');
  });

  it('includes bottomBar when copyright block exists', () => {
    expect(config.bottomBar).toBeDefined();
  });

  it('bottomBar.components includes copyright', () => {
    const types = config.bottomBar!.components.map((c) => c.type);
    expect(types).toContain('copyright');
  });

  it('bottomBar.components includes payment_badges placeholder', () => {
    const types = config.bottomBar!.components.map((c) => c.type);
    expect(types).toContain('payment_badges');
  });

  it('bottomBar.components includes legal_links placeholder', () => {
    const types = config.bottomBar!.components.map((c) => c.type);
    expect(types).toContain('legal_links');
  });

  it('copyright component settings have no _nx_* keys', () => {
    const copyright = config.bottomBar!.components.find((c) => c.type === 'copyright')!;
    for (const key of Object.keys(copyright.settings)) {
      expect(key.startsWith('_nx_')).toBe(false);
    }
  });
});

// ─── 3. Empty header/footer ───────────────────────────────────────────────────

describe('extractHeaderConfig / extractFooterConfig — empty inputs', () => {
  it('returns null when both annBar and header nodes are undefined', () => {
    expect(extractHeaderConfig(undefined, undefined)).toBeNull();
  });

  it('returns null when footerNode is undefined', () => {
    expect(extractFooterConfig(undefined)).toBeNull();
  });

  it('returns header config when only annBar node exists (no header section)', () => {
    const config = extractHeaderConfig(ANN_NODE, undefined);
    expect(config).not.toBeNull();
    expect(config!.zones).toHaveLength(1);
    expect(config!.zones[0].id).toBe('zone1');
    expect(config!.behavior).toBeUndefined();
  });

  it('extractHeaderFooter returns null header for nodeTree with no header group', () => {
    const emptyDoc: PageDoc = { ...MOCK_PAGE_DOC, groups: {}, sections: [] };
    const { header } = extractHeaderFooter(buildNodeTreeFromPageDoc(emptyDoc));
    expect(header).toBeNull();
  });

  it('extractHeaderFooter returns null footer for nodeTree with no footer group', () => {
    const emptyDoc: PageDoc = { ...MOCK_PAGE_DOC, groups: {}, sections: [] };
    const { footer } = extractHeaderFooter(buildNodeTreeFromPageDoc(emptyDoc));
    expect(footer).toBeNull();
  });

  it('footer returns config without bottomBar when no copyright block', () => {
    const footerNoBlocks: SectionDoc = { ...FTR_SECTION, blocks: [] };
    const config = extractFooterConfig(sectionToNode(footerNoBlocks));
    expect(config).not.toBeNull();
    expect(config!.bottomBar).toBeUndefined();
  });
});

// ─── 4. Save integration ──────────────────────────────────────────────────────

describe('writeHeaderFooterShadow — save integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls updateHeaderDraft when header config exists', async () => {
    vi.mocked(themeEngineService.updateHeaderDraft).mockResolvedValueOnce(undefined);
    vi.mocked(themeEngineService.updateFooterDraft).mockResolvedValueOnce(undefined);

    await writeHeaderFooterShadow(TREE);

    expect(themeEngineService.updateHeaderDraft).toHaveBeenCalledTimes(1);
  });

  it('calls updateFooterDraft when footer config exists', async () => {
    vi.mocked(themeEngineService.updateHeaderDraft).mockResolvedValueOnce(undefined);
    vi.mocked(themeEngineService.updateFooterDraft).mockResolvedValueOnce(undefined);

    await writeHeaderFooterShadow(TREE);

    expect(themeEngineService.updateFooterDraft).toHaveBeenCalledTimes(1);
  });

  it('passes header config with zones to updateHeaderDraft', async () => {
    vi.mocked(themeEngineService.updateHeaderDraft).mockResolvedValueOnce(undefined);
    vi.mocked(themeEngineService.updateFooterDraft).mockResolvedValueOnce(undefined);

    await writeHeaderFooterShadow(TREE);

    const call = vi.mocked(themeEngineService.updateHeaderDraft).mock.calls[0][0] as any;
    expect(call.zones).toBeDefined();
    expect(Array.isArray(call.zones)).toBe(true);
    expect(call.zones.length).toBeGreaterThan(0);
  });

  it('passes footer config with settings to updateFooterDraft', async () => {
    vi.mocked(themeEngineService.updateHeaderDraft).mockResolvedValueOnce(undefined);
    vi.mocked(themeEngineService.updateFooterDraft).mockResolvedValueOnce(undefined);

    await writeHeaderFooterShadow(TREE);

    const call = vi.mocked(themeEngineService.updateFooterDraft).mock.calls[0][0] as any;
    expect(call.settings).toBeDefined();
    expect(call.settings.topBackground).toBeDefined();
  });

  it('does NOT call updateHeaderDraft for nodeTree with no header group', async () => {
    const emptyDoc: PageDoc = { ...MOCK_PAGE_DOC, groups: {}, sections: [] };
    const emptyTree = buildNodeTreeFromPageDoc(emptyDoc);

    await writeHeaderFooterShadow(emptyTree);

    expect(themeEngineService.updateHeaderDraft).not.toHaveBeenCalled();
    expect(themeEngineService.updateFooterDraft).not.toHaveBeenCalled();
  });

  it('rethrows errors (callers must .catch)', async () => {
    vi.mocked(themeEngineService.updateHeaderDraft).mockRejectedValueOnce(new Error('Network'));

    await expect(writeHeaderFooterShadow(TREE)).rejects.toThrow('Network');
  });

  it('resolves void on success', async () => {
    vi.mocked(themeEngineService.updateHeaderDraft).mockResolvedValueOnce(undefined);
    vi.mocked(themeEngineService.updateFooterDraft).mockResolvedValueOnce(undefined);

    await expect(writeHeaderFooterShadow(TREE)).resolves.toBeUndefined();
  });
});

// ─── 5. Rollback recovery — MOCK_PAGE_DOC round-trip ─────────────────────────

describe('extractHeaderFooter — rollback recovery via MOCK_PAGE_DOC', () => {
  const { header, footer } = extractHeaderFooter(TREE);

  it('header is non-null for MOCK_PAGE_DOC (has header group)', () => {
    expect(header).not.toBeNull();
  });

  it('footer is non-null for MOCK_PAGE_DOC (has footer group)', () => {
    expect(footer).not.toBeNull();
  });

  it('header zone1 background matches original announcement_bar settings', () => {
    const origBg = String(ANN_SECTION.settings.background ?? '#4f46e5');
    expect(header!.zones[0].background).toBe(origBg);
  });

  it('footer topBackground matches original footer settings', () => {
    const origBg = String(FTR_SECTION.settings.background ?? '#111827');
    expect(footer!.settings.topBackground).toBe(origBg);
  });

  it('header config satisfies the updateHeaderDraft({ zones, behavior }) contract', () => {
    expect(header).toMatchObject({
      zones:    expect.any(Array),
      behavior: expect.any(Object),
    });
  });

  it('footer config satisfies the updateFooterDraft({ settings, bottomBar? }) contract', () => {
    expect(footer).toMatchObject({ settings: expect.any(Object) });
  });

  it('no _nx_* keys survive into any header zone component settings', () => {
    for (const zone of header!.zones) {
      for (const comp of zone.components) {
        for (const key of Object.keys(comp.settings)) {
          expect(key.startsWith('_nx_')).toBe(false);
        }
      }
    }
  });
});
