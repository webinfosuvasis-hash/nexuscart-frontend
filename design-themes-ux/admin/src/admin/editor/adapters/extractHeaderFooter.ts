/**
 * Phase 10A — Header/Footer shadow extraction
 *
 * Extracts header and footer configuration from a ContentNode tree and
 * writes compatibility shadows to the legacy HeaderConfig / FooterConfig
 * tables so that rolling back CONTENT_NODE_ENABLED to false preserves
 * header and footer edits made in node mode.
 *
 * ── Output format ─────────────────────────────────────────────────────────────
 *
 * The extraction produces exactly the same payload shapes as the legacy save
 * path in EditorTopBar.performSave() (lines 424–514), enabling byte-compatible
 * round-trips through the backend:
 *
 *   extractHeaderConfig()  →  { zones, behavior }    → updateHeaderDraft()
 *   extractFooterConfig()  →  { settings, bottomBar } → updateFooterDraft()
 *
 * ── Node tree source ──────────────────────────────────────────────────────────
 *
 *   page_root
 *   ├── page_group (handle: 'header')
 *   │   ├── announcement_bar node  (children: [announcement block])
 *   │   └── header node            (children: [logo, menu, search, cart, account, spacer])
 *   └── page_group (handle: 'footer')
 *       └── footer node            (children: [copyright, ...])
 *
 * ── Menu type mapping ─────────────────────────────────────────────────────────
 *
 *   Block type 'menu' → zone component type 'navigation'
 *   (The HeaderConfig zone schema uses 'navigation', matching the legacy save.)
 *
 * ── Best-effort usage ─────────────────────────────────────────────────────────
 *
 *   writeHeaderFooterShadow(nodeTree, themeId?)
 *     .catch(err => console.warn(...))   // callers suppress errors
 */

import type { Node }           from '@/components/node-renderer/types';
import { themeEngineService }  from '@/services/themeEngineService';
import {
  getHeaderSections,
  getFooterSections,
}                              from './pageDocNodeTree';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Strip _nx_* metadata keys from node settings (same as sectionNodeAdapter). */
function stripNxKeys(settings: Record<string, unknown>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(settings)) {
    if (!k.startsWith('_nx_')) out[k] = v;
  }
  return out;
}

/** Find first child node of the given type. */
function findChild(parent: Node | undefined, type: string): Node | undefined {
  return parent?.children?.find((c) => c.type === type);
}

// ─── Return types ─────────────────────────────────────────────────────────────

export interface HeaderZone {
  id:            string;
  background?:   string;
  textColor?:    string;
  visibility?:   string;
  showOnMobile?: boolean;
  paddingTop?:   number;
  paddingBottom?:number;
  borderBottom?: string;
  borderColor?:  string;
  components:    Array<{ id: string; type: string; settings: Record<string, any> }>;
}

export interface HeaderBehavior {
  stickyMode:        string;
  transparentOnHero: boolean;
  mobileBreakpoint:  string;
  mobileDrawerStyle: string;
  zIndex:            number;
  headerFont:        string;
  headerFontSize:    number;
  showSearchIcon:    boolean;
  searchPosition:    string;
  logoPosition:      string;
  menuPosition:      string;
  menuRow:           string;
}

export interface HeaderConfig {
  zones:    HeaderZone[];
  behavior?: HeaderBehavior;
}

export interface FooterSettings {
  topBackground: string;
  topBorder:     boolean;
  divider:       boolean;
  dividerColor:  string;
  paddingTop:    number;
  paddingBottom: number;
  showBottomBar: boolean;
  bottomBarBg:   string;
}

export interface FooterBottomBar {
  backgroundColor: string;
  components:      Array<{ id: string; type: string; settings: Record<string, any> }>;
}

export interface FooterConfig {
  settings:   FooterSettings;
  bottomBar?: FooterBottomBar;
}

export interface HeaderFooterConfig {
  header: HeaderConfig | null;
  footer: FooterConfig | null;
}

// ─── extractHeaderConfig ──────────────────────────────────────────────────────

/**
 * Extract header zone configuration from an announcement_bar node and a
 * header node.  Produces the exact payload shape expected by updateHeaderDraft().
 *
 * @param annBarNode  The announcement_bar section node (may be undefined).
 * @param headerNode  The header section node (may be undefined).
 */
export function extractHeaderConfig(
  annBarNode?: Node,
  headerNode?: Node,
): HeaderConfig | null {
  if (!annBarNode && !headerNode) return null;

  const zones: HeaderZone[] = [];

  // ── Zone 1: Announcement bar ───────────────────────────────────────────────
  if (annBarNode) {
    const annBlockNode = findChild(annBarNode, 'announcement');
    const s = annBarNode.settings;

    zones.push({
      id:           'zone1',
      background:   String(s.background  ?? '#4f46e5'),
      textColor:    String(s.textColor   ?? '#ffffff'),
      visibility:   annBarNode.visibility?.desktop !== false ? 'all' : 'hidden',
      showOnMobile: s.showOnMobile !== false,
      paddingTop:   Number(s.paddingVertical ?? 6),
      paddingBottom:Number(s.paddingVertical ?? 6),
      borderBottom: 'none',
      components:   annBlockNode
        ? [{ id: annBlockNode.id, type: 'announcement', settings: stripNxKeys(annBlockNode.settings) }]
        : [],
    });
  }

  // ── Zone 2: Main navigation ────────────────────────────────────────────────
  if (headerNode) {
    const s       = headerNode.settings;
    const children = headerNode.children ?? [];

    // Build zone2 components in the same order as the legacy save path:
    // logo → navigation (menu) → spacer → search → cart → account
    const BLOCK_ORDER: Array<[string, string]> = [
      ['logo',    'logo'],
      ['menu',    'navigation'],   // menu block → navigation component type
      ['spacer',  'spacer'],
      ['search',  'search'],
      ['cart',    'cart'],
      ['account', 'account'],
    ];

    const zone2components: Array<{ id: string; type: string; settings: Record<string, any> }> = [];
    for (const [blockType, componentType] of BLOCK_ORDER) {
      const node = children.find((c) => c.type === blockType);
      if (node) {
        zone2components.push({
          id:       node.id,
          type:     componentType,
          settings: stripNxKeys(node.settings),
        });
      }
    }

    zones.push({
      id:           'zone2',
      background:   String(s.background  ?? '#ffffff'),
      visibility:   'all',
      paddingTop:   Number(s.paddingTop    ?? 12),
      paddingBottom:Number(s.paddingBottom ?? 12),
      borderBottom: '1px',
      borderColor:  '#e5e7eb',
      components:   zone2components,
    });

    // Zone 3: Desktop submenu row (static placeholder, no components)
    zones.push({
      id:           'zone3',
      background:   '#f9fafb',
      visibility:   'desktop_only',
      paddingTop:   8,
      paddingBottom:8,
      borderBottom: '1px',
      borderColor:  '#e5e7eb',
      components:   [],
    });

    const behavior: HeaderBehavior = {
      stickyMode:        String(s.stickyMode        ?? 'scroll_up'),
      transparentOnHero: s.transparentOnHero !== true ? false : true,
      mobileBreakpoint:  String(s.mobileBreakpoint  ?? 'md'),
      mobileDrawerStyle: String(s.mobileDrawerStyle ?? 'slide_left'),
      zIndex:            Number(s.zIndex            ?? 50),
      headerFont:        String(s.headerFont        ?? 'heading'),
      headerFontSize:    Number(s.headerFontSize    ?? 14),
      showSearchIcon:    s.showSearchIcon !== false,
      searchPosition:    String(s.searchPosition    ?? 'right'),
      logoPosition:      String(s.logoPosition      ?? 'left'),
      menuPosition:      String(s.menuPosition      ?? 'left'),
      menuRow:           String(s.menuRow            ?? 'bottom'),
    };

    return { zones, behavior };
  }

  // Only announcement bar, no header section
  return zones.length > 0 ? { zones } : null;
}

// ─── extractFooterConfig ──────────────────────────────────────────────────────

/**
 * Extract footer configuration from a footer section node.
 * Produces the exact payload shape expected by updateFooterDraft().
 *
 * @param footerNode  The footer section node (may be undefined).
 */
export function extractFooterConfig(footerNode?: Node): FooterConfig | null {
  if (!footerNode) return null;

  const s             = footerNode.settings;
  const copyrightNode = findChild(footerNode, 'copyright');
  const bottomBarBg   = String(s.bottomBarBg ?? '#0f172a');

  const settings: FooterSettings = {
    topBackground: String(s.background   ?? '#111827'),
    topBorder:     s.topBorder !== false,
    divider:       s.divider   !== false,
    dividerColor:  String(s.dividerColor  ?? '#374151'),
    paddingTop:    Number(s.paddingTop    ?? 48),
    paddingBottom: Number(s.paddingBottom ?? 48),
    showBottomBar: s.showBottomBar !== false,
    bottomBarBg,
  };

  if (!copyrightNode) {
    return { settings };
  }

  const bottomBar: FooterBottomBar = {
    backgroundColor: bottomBarBg,
    components: [
      { id: copyrightNode.id,  type: 'copyright',     settings: stripNxKeys(copyrightNode.settings) },
      { id: 'payments-1',      type: 'payment_badges', settings: { set: 'generic' } },
      { id: 'legal-links-1',   type: 'legal_links',    settings: {} },
    ],
  };

  return { settings, bottomBar };
}

// ─── extractHeaderFooter ──────────────────────────────────────────────────────

/**
 * Extract both header and footer configurations from a ContentNode tree.
 *
 * @param nodeTree  A 'page_root' Node produced by buildNodeTreeFromPageDoc().
 * @returns         { header, footer } — either may be null if the group is absent.
 */
export function extractHeaderFooter(nodeTree: Node): HeaderFooterConfig {
  const headerNodes = getHeaderSections(nodeTree);
  const footerNodes = getFooterSections(nodeTree);

  const annBarNode = headerNodes.find((n) => n.type === 'announcement_bar');
  const headerNode = headerNodes.find((n) => n.type === 'header');
  const footerNode = footerNodes.find((n) => n.type === 'footer');

  return {
    header: extractHeaderConfig(annBarNode, headerNode),
    footer: extractFooterConfig(footerNode),
  };
}

// ─── writeHeaderFooterShadow ──────────────────────────────────────────────────

/**
 * Write header and footer compatibility shadows to their respective draft
 * config tables.  Both calls are fired in parallel.
 *
 * Best-effort: callers should .catch() errors.
 *
 * @param nodeTree  The ContentNode tree currently in editor state.
 * @param themeId   Optional theme identifier.
 */
export async function writeHeaderFooterShadow(
  nodeTree: Node,
  themeId?: string,
): Promise<void> {
  const { header, footer } = extractHeaderFooter(nodeTree);

  const writes: Promise<unknown>[] = [];

  if (header) {
    writes.push(themeEngineService.updateHeaderDraft(header));
  }
  if (footer) {
    writes.push(themeEngineService.updateFooterDraft(footer));
  }

  if (writes.length > 0) {
    await Promise.all(writes);
  }
}
