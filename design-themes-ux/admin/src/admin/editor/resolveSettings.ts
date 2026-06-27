import type { PreviewMode } from './types';

/**
 * Merges base settings with the active breakpoint's responsive override.
 *
 * Desktop:  returns settings as-is (base = desktop)
 * Tablet:   returns { ...base, ...settings.responsive?.tablet }
 * Mobile:   returns { ...base, ...settings.responsive?.mobile }
 *
 * The `responsive` key itself is stripped from the result to keep
 * canvas components receiving only the resolved flat settings bag.
 */
export function resolveSettings(
  settings:   Record<string, any>,
  breakpoint: PreviewMode,
): Record<string, any> {
  const { responsive, ...base } = settings;
  if (!responsive || breakpoint === 'desktop') return base;
  const overlay = (responsive as Record<string, any>)[breakpoint] ?? {};
  return { ...base, ...overlay };
}

/**
 * Returns true if `key` has been overridden for `breakpoint`
 * vs the desktop base value. Used to show the ◉ indicator in the inspector.
 */
export function hasResponsiveOverride(
  settings:   Record<string, any>,
  key:        string,
  breakpoint: PreviewMode,
): boolean {
  if (breakpoint === 'desktop') return false;
  const responsive = settings.responsive as Record<string, any> | undefined;
  return responsive?.[breakpoint]?.[key] !== undefined;
}

/**
 * Gets the effective value for `key` at the given breakpoint.
 * Returns the override if present, else the base value.
 */
export function getEffectiveValue(
  settings:   Record<string, any>,
  key:        string,
  breakpoint: PreviewMode,
): unknown {
  if (breakpoint !== 'desktop') {
    const responsive = settings.responsive as Record<string, any> | undefined;
    const override = responsive?.[breakpoint]?.[key];
    if (override !== undefined) return override;
  }
  return settings[key];
}
