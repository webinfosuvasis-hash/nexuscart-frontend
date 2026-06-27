import React, { createContext, useContext, useMemo } from 'react';
import type { RenderContext, Breakpoint, PageContext } from './types';

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_CONTEXT: RenderContext = {
  breakpoint:  'desktop',
  themeTokens: {},
  storeId:     '',
  pageContext:  {},
  symbols:      new Map(),
  isPreview:   false,
};

// ─── React context ────────────────────────────────────────────────────────────

const Ctx = createContext<RenderContext>(DEFAULT_CONTEXT);

export function useRenderContext(): RenderContext {
  return useContext(Ctx);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface RenderContextProviderProps {
  breakpoint:  Breakpoint;
  themeTokens?: Record<string, string>;
  storeId?:    string;
  pageContext?: PageContext;
  symbols?:    Map<string, import('./types').Node>;
  isPreview?:  boolean;
  children:    React.ReactNode;
}

export const RenderContextProvider: React.FC<RenderContextProviderProps> = ({
  breakpoint,
  themeTokens = {},
  storeId     = '',
  pageContext  = {},
  symbols      = new Map(),
  isPreview   = false,
  children,
}) => {
  const value = useMemo<RenderContext>(
    () => ({ breakpoint, themeTokens, storeId, pageContext, symbols, isPreview }),
    [breakpoint, themeTokens, storeId, pageContext, symbols, isPreview],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

// ─── Context helpers ──────────────────────────────────────────────────────────

/** Inject extra page context fields (e.g., for data-bound nodes) */
export function bindContext(
  parent: RenderContext,
  extra:  Partial<PageContext>,
): RenderContext {
  return { ...parent, pageContext: { ...parent.pageContext, ...extra } };
}
