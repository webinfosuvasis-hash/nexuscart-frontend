/**
 * pipeline.ts — Config Parse → Merge → Validate utilities.
 *
 * Every section config goes through these steps before rendering:
 *
 *   1. parseConfig(raw)               JSON → typed TConfig
 *   2. mergeWithDefaults(parsed, def) fill missing fields with defaults
 *   3. validateConfig(merged)         field-level checks + warnings
 *
 * Rules:
 *   - Steps never throw. Failures are logged and gracefully handled.
 *   - Validation errors never block rendering.
 *   - The renderer always receives a complete, safe TConfig.
 */

import type { ValidationResult } from '@/themes/registry/types';

// ─── 1. Default config merge ──────────────────────────────────────────────────

/**
 * Deep-merge `parsed` with `defaults`.
 *
 * For every field in `defaults`:
 *   - If the field is missing/undefined/null in `parsed` → use the default value.
 *   - If the field is a plain object in both → recurse (deep merge).
 *   - If the field is a non-empty array in `parsed` → use `parsed` value.
 *   - If the field is an empty array in `parsed` and non-empty in defaults → use defaults.
 *   - Otherwise → use `parsed` value (primitive override).
 *
 * This ensures a config saved with only `{ ctaText: 'Buy Now' }` still
 * produces a fully-typed, renderable config with all other fields populated.
 */
export function mergeWithDefaults<T extends object>(parsed: Partial<T>, defaults: T): T {
  const result: Record<string, unknown> = { ...defaults as Record<string, unknown> };

  for (const key of Object.keys(parsed as Record<string, unknown>)) {
    const parsedVal  = (parsed as Record<string, unknown>)[key];
    const defaultVal = (defaults as Record<string, unknown>)[key];

    if (parsedVal === undefined || parsedVal === null) {
      // Keep the default
      continue;
    }

    if (
      typeof parsedVal === 'object' &&
      !Array.isArray(parsedVal) &&
      parsedVal !== null &&
      typeof defaultVal === 'object' &&
      !Array.isArray(defaultVal) &&
      defaultVal !== null
    ) {
      // Recurse for nested objects
      result[key] = mergeWithDefaults(
        parsedVal as Partial<object>,
        defaultVal as object,
      );
    } else if (Array.isArray(parsedVal)) {
      // Use parsed array if non-empty, otherwise keep default
      result[key] = parsedVal.length > 0 ? parsedVal : defaultVal;
    } else {
      // Primitive: use parsed value
      result[key] = parsedVal;
    }
  }

  return result as T;
}

// ─── 2. Validation result builder ────────────────────────────────────────────

/** Create a passing ValidationResult with no errors. */
export function validResult<T>(config: T): ValidationResult<T> {
  return { isValid: true, errors: {}, warnings: {}, config };
}

/** Create a failing ValidationResult. Rendering continues with the config. */
export function invalidResult<T>(
  config:   T,
  errors:   Record<string, string>,
  warnings: Record<string, string> = {},
): ValidationResult<T> {
  return { isValid: false, errors, warnings, config };
}

// ─── 3. Safe JSON parse ───────────────────────────────────────────────────────

/**
 * Safely parse raw JSON from the database.
 * Returns an empty object on failure so mergeWithDefaults can fill in all fields.
 */
export function safeParseJson(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) return parsed;
    } catch {
      // fall through
    }
  }
  return {};
}

// ─── 4. Color utilities (used by section components) ─────────────────────────

/** Convert hex + alpha (0-100) to CSS rgba string. */
export function hexAlphaToRgba(hex: string, alpha: number): string {
  // Normalise hex
  const h = hex.replace('#', '');
  if (h.length !== 6) return `rgba(0,0,0,${alpha / 100})`;

  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${(alpha / 100).toFixed(2)})`;
}

/**
 * Build a left-to-right CSS gradient from a two-stop overlay config.
 * Used by editorial hero slides and similar sections.
 */
export function buildOverlayGradient(overlay: {
  from: string; fromAlpha: number;
  to:   string; toAlpha:   number;
}): string {
  const from = hexAlphaToRgba(overlay.from, overlay.fromAlpha);
  const to   = hexAlphaToRgba(overlay.to,   overlay.toAlpha);
  return `linear-gradient(to right, ${from}, ${to})`;
}
