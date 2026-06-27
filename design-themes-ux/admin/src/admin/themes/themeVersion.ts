/**
 * Theme version tracking
 *
 * Reads and writes the ThemeInstallRecord stored in PageDocument.settings.
 * This lets the UI show "Kaveri 1.0.0 installed" and detect available upgrades.
 *
 * ── Storage location ──────────────────────────────────────────────────────────
 *
 *   PageDocument.settings[THEME_INSTALL_KEY] = ThemeInstallRecord
 *
 *   The PageDocument.settings field is a free-form JSON blob in the backend
 *   schema.  We namespace our key with '_themeInstall' to avoid collisions.
 *
 * ── Lifecycle ─────────────────────────────────────────────────────────────────
 *
 *   Install:   writeInstallRecord() called by installer.ts after every
 *              successful savePageDocument().
 *   Upgrade:   same call with the new version.
 *   Read:      getInstalledThemeInfo() called by ThemeEngine UI.
 *   Upgrade check: canUpgrade(installed, registry) is pure — no I/O.
 */

import { themeEngineService }          from '@/services/themeEngineService';
import type { ThemeInstallRecord }      from './types';
import type { ThemeRegistry }          from './registry';

// ─── Key used in PageDocument.settings ────────────────────────────────────────

export const THEME_INSTALL_KEY = '_themeInstall' as const;

// ─── Semver helpers ───────────────────────────────────────────────────────────

/**
 * Parse a semver string to [major, minor, patch].
 * Non-numeric segments default to 0.
 */
function parseSemver(version: string): [number, number, number] {
  const parts = version.split('.').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/**
 * Returns true when version `a` is strictly greater than version `b`.
 * Supports standard three-part semver (major.minor.patch).
 */
export function semverGt(a: string, b: string): boolean {
  const [a1, a2, a3] = parseSemver(a);
  const [b1, b2, b3] = parseSemver(b);
  if (a1 !== b1) return a1 > b1;
  if (a2 !== b2) return a2 > b2;
  return a3 > b3;
}

/**
 * Returns true when version `a` equals version `b`.
 */
export function semverEq(a: string, b: string): boolean {
  return parseSemver(a).join('.') === parseSemver(b).join('.');
}

// ─── Install record helpers ───────────────────────────────────────────────────

/**
 * Build a ThemeInstallRecord for a given theme + page.
 * Pure function — no I/O.
 */
export function buildInstallRecord(
  themeId: string,
  version: string,
  pageId:  string,
): ThemeInstallRecord {
  return {
    themeId,
    version,
    pageId,
    installedAt: new Date().toISOString(),
  };
}

/**
 * Wrap a ThemeInstallRecord in the PageDocument.settings envelope.
 * Pure function — used by installer.ts before calling savePageDocument().
 */
export function buildInstallSettings(
  record:           ThemeInstallRecord,
  existingSettings: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...existingSettings,
    [THEME_INSTALL_KEY]: record,
  };
}

// ─── Read installed version ───────────────────────────────────────────────────

/**
 * Load the ThemeInstallRecord for a page from the backend.
 *
 * Returns null when:
 *   - No PageDocument exists for this page (first install, no theme yet)
 *   - PageDocument exists but has no install record (legacy / migrated content)
 */
export async function getInstalledThemeInfo(
  storeId:  string,
  themeId:  string,
  pageId:   string,
): Promise<ThemeInstallRecord | null> {
  try {
    const doc = await themeEngineService.loadPageDocument(storeId, themeId, pageId);
    if (!doc) return null;
    const record = doc.settings?.[THEME_INSTALL_KEY];
    if (!record || typeof record !== 'object') return null;
    return record as ThemeInstallRecord;
  } catch {
    return null;
  }
}

// ─── Upgrade detection ────────────────────────────────────────────────────────

/**
 * Check whether a newer registered version of the installed theme is available.
 *
 * Pure function — takes the install record and the registry as parameters.
 * No network calls.
 *
 * @param installed  The installed ThemeInstallRecord (may be null).
 * @param registry   The ThemeRegistry singleton.
 * @returns          true when a newer version is registered.
 */
export function canUpgrade(
  installed: ThemeInstallRecord | null,
  registry:  ThemeRegistry,
): boolean {
  if (!installed) return false;
  if (!registry.has(installed.themeId)) return false;
  const { meta } = registry.get(installed.themeId);
  return semverGt(meta.version, installed.version);
}

/**
 * Return the available upgrade version, or null if no upgrade is available.
 */
export function availableUpgrade(
  installed: ThemeInstallRecord | null,
  registry:  ThemeRegistry,
): string | null {
  if (!canUpgrade(installed, registry)) return null;
  return registry.get(installed!.themeId).meta.version;
}
