import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom lacks these; several storefront components use them.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  }) as MediaQueryList;
}
window.scrollTo = (() => {}) as typeof window.scrollTo;
class IO { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
const g = globalThis as Record<string, unknown>;
g.IntersectionObserver ??= IO;
g.ResizeObserver ??= IO;
