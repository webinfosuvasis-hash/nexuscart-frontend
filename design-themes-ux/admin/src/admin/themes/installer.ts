/**
 * Theme Installer — applyTheme() and upgradeTheme()
 *
 * ── applyTheme() — full install ───────────────────────────────────────────────
 *
 *   1. Lookup  → ThemeRegistry.get(themeId)
 *   2. Build   → buildPageDocFromTheme(definition, page)
 *   3. Convert → buildNodeTreeFromPageDoc(pageDoc)
 *   4. Version → loadPageDocument() to get current version (0 if absent)
 *   5. Save    → savePageDocument(…, tree, version, settings._themeInstall)
 *   6. Tokens  → applyThemeTokens() [best-effort]
 *   7. Shadows → writeSectionShadow() + writeHeaderFooterShadow() [best-effort]
 *   8. Return  → ApplyThemeResult
 *
 * ── upgradeTheme() — version migration ───────────────────────────────────────
 *
 *   1. Load    → loadPageDocument() to get the current tree + settings
 *   2. Check   → confirm installed version < registry version
 *   3. Rebuild → buildPageDocFromNodeTree(currentTree)  — read current content
 *   4. Migrate → migrationRegistry.findChain() → applyChain()
 *   5. Convert → buildNodeTreeFromPageDoc(migratedDoc)
 *   6. Save    → savePageDocument(…, migratedTree, currentVersion, new _themeInstall)
 *   7. Tokens  → applyThemeTokens() [best-effort, only token deltas]
 *   8. Shadows → best-effort shadows
 *   9. Return  → ThemeUpgradeResult
 */

import { themeRegistry }                    from './registry';
import { migrationRegistry }               from './migrations';
import { buildPageDocFromTheme }             from './themePageDocBuilder';
import { applyThemeTokens }                 from './themeTokens';
import {
  buildInstallRecord,
  buildInstallSettings,
  getInstalledThemeInfo,
  semverGt,
  THEME_INSTALL_KEY,
}                                            from './themeVersion';
import { buildNodeTreeFromPageDoc, buildPageDocFromNodeTree } from '@/admin/editor/adapters/pageDocNodeTree';
import { writeSectionShadow }               from '@/admin/editor/adapters/nodeShadowStrategy';
import { writeHeaderFooterShadow }          from '@/admin/editor/adapters/extractHeaderFooter';
import { themeEngineService, DocumentVersionConflictError } from '@/services/themeEngineService';
import type {
  ApplyThemeContext,
  ApplyThemeResult,
  ThemeUpgradeResult,
} from './types';
import type { Node } from '@/components/node-renderer/types';

// ─── applyTheme ───────────────────────────────────────────────────────────────

/**
 * Install a starter theme onto a store page, replacing existing content.
 *
 * @param themeId   Registered theme identifier, e.g. 'kaveri'.
 * @param context   { storeId, activeThemeId, pageId? }
 */
export async function applyTheme(
  themeId: string,
  context: ApplyThemeContext,
): Promise<ApplyThemeResult> {
  const { storeId, activeThemeId, pageId = 'home' } = context;

  // ── 1. Lookup ──────────────────────────────────────────────────────────────
  const { definition } = themeRegistry.get(themeId);

  const page = definition.pages[pageId];
  if (!page) {
    throw new Error(
      `Theme "${themeId}" does not define a page for pageId "${pageId}". ` +
      `Available: ${Object.keys(definition.pages).join(', ')}`,
    );
  }

  // ── 2+3. Build PageDoc → Node tree ────────────────────────────────────────
  const pageDoc  = buildPageDocFromTheme(definition, page);
  const nodeTree = buildNodeTreeFromPageDoc(pageDoc);

  // ── 4. Get current document version ───────────────────────────────────────
  let currentVersion = 0;
  let existingSettings: Record<string, unknown> = {};
  try {
    const existing = await themeEngineService.loadPageDocument(storeId, activeThemeId, pageId);
    if (existing) {
      currentVersion    = existing.version;
      existingSettings  = (existing.settings ?? {}) as Record<string, unknown>;
    }
  } catch {
    currentVersion   = 0;
    existingSettings = {};
  }

  // ── 5. Build install record + save ────────────────────────────────────────
  const installRecord = buildInstallRecord(themeId, definition.meta.version, pageId);
  const docSettings   = buildInstallSettings(installRecord, existingSettings);

  const saved = await trySave(
    storeId, activeThemeId, pageId,
    nodeTree as unknown as Record<string, unknown>,
    currentVersion, docSettings,
  );

  // ── 6. Apply theme tokens (best-effort) ───────────────────────────────────
  applyThemeTokens(definition, activeThemeId)
    .catch((err) => console.warn('[ThemeInstaller] Token apply failed:', err));

  // ── 7. Write compatibility shadows (best-effort) ──────────────────────────
  writeSectionShadow(pageId, nodeTree as Node, activeThemeId)
    .catch((err) => console.warn('[ThemeInstaller] Section shadow failed:', err));

  writeHeaderFooterShadow(nodeTree as Node, activeThemeId)
    .catch((err) => console.warn('[ThemeInstaller] Header/footer shadow failed:', err));

  // ── 8. Return result ───────────────────────────────────────────────────────
  return {
    themeId,
    pageId,
    sectionsInstalled:   page.sections.length,
    nodeDocumentVersion: saved.version,
    installedAt:         installRecord.installedAt,
  };
}

// ─── upgradeTheme ─────────────────────────────────────────────────────────────

/**
 * Upgrade an installed theme from its current version to the latest registered
 * version, applying all intermediate migrations.
 *
 * Upgrade is non-destructive: migrations only ADD or MODIFY sections; they
 * never remove content the merchant has customised.
 *
 * @param themeId   Registered theme identifier, e.g. 'kaveri'.
 * @param context   { storeId, activeThemeId, pageId? }
 * @throws  If no theme is installed, or if the installed version is already
 *          the latest.
 */
export async function upgradeTheme(
  themeId: string,
  context: ApplyThemeContext,
): Promise<ThemeUpgradeResult> {
  const { storeId, activeThemeId, pageId = 'home' } = context;

  // ── 1. Lookup target definition ────────────────────────────────────────────
  const { definition } = themeRegistry.get(themeId);

  // ── 2. Load current PageDocument ──────────────────────────────────────────
  const currentDoc = await themeEngineService.loadPageDocument(storeId, activeThemeId, pageId);
  if (!currentDoc) {
    throw new Error(
      `upgradeTheme: no PageDocument found for store "${storeId}" page "${pageId}". ` +
      `Install the theme first with applyTheme().`,
    );
  }

  // ── 3. Read installed version ──────────────────────────────────────────────
  const existingSettings = (currentDoc.settings ?? {}) as Record<string, unknown>;
  const installRecord    = existingSettings[THEME_INSTALL_KEY] as
    { themeId: string; version: string } | undefined;

  const fromVersion = installRecord?.version ?? '0.0.0';
  const toVersion   = definition.meta.version;

  if (!semverGt(toVersion, fromVersion)) {
    throw new Error(
      `upgradeTheme: "${themeId}" is already at version ${fromVersion} ` +
      `(registry has ${toVersion} — no upgrade available).`,
    );
  }

  // ── 4. Rebuild PageDoc from current tree ──────────────────────────────────
  // We convert the LIVE tree back to PageDoc so migrations can inspect
  // and modify the actual content (preserving merchant customisations).
  const currentPageDoc = buildPageDocFromNodeTree(
    currentDoc.tree as unknown as Node,
  );

  // ── 5. Find and apply migration chain ─────────────────────────────────────
  const chain = migrationRegistry.findChain(themeId, fromVersion, toVersion);

  const migratedPageDoc = chain.length > 0
    ? migrationRegistry.applyChain(currentPageDoc, chain, definition)
    : currentPageDoc;   // no migrations registered → re-apply section set

  // ── 6. Convert to Node tree ───────────────────────────────────────────────
  const migratedTree = buildNodeTreeFromPageDoc(migratedPageDoc);

  // ── 7. Save with new install record ───────────────────────────────────────
  const newRecord  = buildInstallRecord(themeId, toVersion, pageId);
  const docSettings = buildInstallSettings(newRecord, existingSettings);

  const saved = await trySave(
    storeId, activeThemeId, pageId,
    migratedTree as unknown as Record<string, unknown>,
    currentDoc.version, docSettings,
  );

  // ── 8. Apply updated tokens (best-effort) ─────────────────────────────────
  applyThemeTokens(definition, activeThemeId)
    .catch((err) => console.warn('[ThemeInstaller] Upgrade token apply failed:', err));

  // ── 9. Compatibility shadows (best-effort) ────────────────────────────────
  writeSectionShadow(pageId, migratedTree as Node, activeThemeId)
    .catch((err) => console.warn('[ThemeInstaller] Upgrade section shadow failed:', err));

  writeHeaderFooterShadow(migratedTree as Node, activeThemeId)
    .catch((err) => console.warn('[ThemeInstaller] Upgrade header/footer shadow failed:', err));

  // ── 10. Return result ─────────────────────────────────────────────────────
  return {
    themeId,
    pageId,
    fromVersion,
    toVersion,
    migrationsApplied:   chain.length,
    nodeDocumentVersion: saved.version,
    upgradedAt:          newRecord.installedAt,
  };
}

// ─── Internal save helper ─────────────────────────────────────────────────────

async function trySave(
  storeId:   string,
  themeId:   string,
  pageId:    string,
  nodeTree:  Record<string, unknown>,
  version:   number,
  settings?: Record<string, unknown>,
): ReturnType<typeof themeEngineService.savePageDocument> {
  try {
    return await themeEngineService.savePageDocument(
      storeId, themeId, pageId, nodeTree, version, settings,
    );
  } catch (err) {
    if (!(err instanceof DocumentVersionConflictError)) throw err;

    // 409 race: reload fresh version and retry once
    const fresh = await themeEngineService.loadPageDocument(storeId, themeId, pageId);
    const freshVersion = fresh?.version ?? 0;

    return await themeEngineService.savePageDocument(
      storeId, themeId, pageId, nodeTree, freshVersion, settings,
    );
  }
}
