/**
 * Visual parity diff engine — Phase 10B
 *
 * Wraps pixelmatch + pngjs to provide proper pixel-level image comparison.
 * Raw buffer comparison of PNG files is NOT correct because PNG is a
 * compressed format — visually identical images have different byte sequences.
 * This module decodes both images to raw RGBA pixel data before diffing.
 */

import { PNG }   from 'pngjs';
import pixelmatch from 'pixelmatch';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiffResult {
  /** Number of pixels that differ (above per-pixel threshold). */
  diffPixels:   number;
  /** Total pixels in the image (width × height). */
  totalPixels:  number;
  /** diffPixels / totalPixels × 100 — the key metric. */
  diffPercent:  number;
  /** PNG buffer of the diff image (red = changed pixels). */
  diffBuffer:   Buffer;
  width:        number;
  height:       number;
  /** true when the two images have different dimensions. */
  dimensionMismatch: boolean;
}

export interface RegionResult {
  label:       string;
  result:      DiffResult | null;   // null when region not found in page
  found:       boolean;
}

// ─── compareImages ────────────────────────────────────────────────────────────

/**
 * Pixel-level comparison of two PNG screenshots.
 *
 * @param a          PNG buffer from the legacy renderer.
 * @param b          PNG buffer from the node renderer.
 * @param sensitivity  Per-pixel colour sensitivity (0–1). Default 0.1 — allows
 *                     minor antialiasing and sub-pixel font rendering differences.
 */
export function compareImages(
  a:           Buffer,
  b:           Buffer,
  sensitivity = 0.1,
): DiffResult {
  const imgA = PNG.sync.read(a);
  const imgB = PNG.sync.read(b);

  // Dimension mismatch → treat as fully different
  if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
    const totalPixels = imgA.width * imgA.height;
    return {
      diffPixels:        totalPixels,
      totalPixels,
      diffPercent:       100,
      diffBuffer:        Buffer.alloc(0),
      width:             imgA.width,
      height:            imgA.height,
      dimensionMismatch: true,
    };
  }

  const { width, height } = imgA;
  const diff = new PNG({ width, height });

  const diffPixels = pixelmatch(
    imgA.data,
    imgB.data,
    diff.data,
    width,
    height,
    { threshold: sensitivity },
  );

  const totalPixels  = width * height;
  const diffPercent  = (diffPixels / totalPixels) * 100;

  return {
    diffPixels,
    totalPixels,
    diffPercent,
    diffBuffer:        Buffer.from(PNG.sync.write(diff)),
    width,
    height,
    dimensionMismatch: false,
  };
}

// ─── THRESHOLD ────────────────────────────────────────────────────────────────

/** Maximum allowed pixel difference percentage (0.1%). */
export const DIFF_THRESHOLD_PCT = 0.1;

/** Returns true when the diff is within the acceptable threshold. */
export function isPassing(result: DiffResult): boolean {
  return !result.dimensionMismatch && result.diffPercent <= DIFF_THRESHOLD_PCT;
}

// ─── Report helpers ───────────────────────────────────────────────────────────

export interface PageResult {
  storeId:   string;
  pageId:    string;
  fullPage:  DiffResult;
  regions:   RegionResult[];
  passed:    boolean;
}

export interface ParityReport {
  pages:          PageResult[];
  passCount:      number;
  failCount:      number;
  largestOffender?: { storeId: string; pageId: string; label: string; diffPercent: number };
}

export function buildReport(pages: PageResult[]): ParityReport {
  const passCount = pages.filter((p) => p.passed).length;
  const failCount = pages.length - passCount;

  // Find the single highest diff across all pages and regions
  let largest: ParityReport['largestOffender'];
  for (const page of pages) {
    const candidates: Array<{ label: string; diffPercent: number }> = [
      { label: 'full-page', diffPercent: page.fullPage.diffPercent },
      ...page.regions.filter((r) => r.result).map((r) => ({
        label:      r.label,
        diffPercent: r.result!.diffPercent,
      })),
    ];
    for (const c of candidates) {
      if (!largest || c.diffPercent > largest.diffPercent) {
        largest = { storeId: page.storeId, pageId: page.pageId, ...c };
      }
    }
  }

  return { pages, passCount, failCount, largestOffender: largest };
}

export function formatReport(report: ParityReport): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════',
    '  Visual Parity Report — Phase 10B',
    '═══════════════════════════════════════════════════',
    `  Passed: ${report.passCount}   Failed: ${report.failCount}   Total: ${report.pages.length}`,
    '',
  ];

  for (const page of report.pages) {
    const icon = page.passed ? '✓' : '✗';
    lines.push(`  ${icon} ${page.storeId}/${page.pageId}`);
    lines.push(`     full-page: ${page.fullPage.diffPercent.toFixed(3)}%` +
      (page.fullPage.dimensionMismatch ? ' [DIMENSION MISMATCH]' : ''));
    for (const r of page.regions) {
      if (r.found && r.result) {
        const regionIcon = isPassing(r.result) ? '  ' : '⚠ ';
        lines.push(`     ${regionIcon}${r.label}: ${r.result.diffPercent.toFixed(3)}%`);
      } else {
        lines.push(`       ${r.label}: [not found]`);
      }
    }
  }

  if (report.largestOffender) {
    const lo = report.largestOffender;
    lines.push('');
    lines.push(`  Largest offender: ${lo.storeId}/${lo.pageId} → ${lo.label} @ ${lo.diffPercent.toFixed(3)}%`);
  }

  lines.push('═══════════════════════════════════════════════════');
  return lines.join('\n');
}
