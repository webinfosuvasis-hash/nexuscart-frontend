import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { vi } from 'vitest';

/** Minimal JSON response in the backend's TransformInterceptor envelope. */
export const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, timestamp: '' }), { status: 200, headers: { 'Content-Type': 'application/json' } });

export const fail = (status: number, message = 'error') =>
  new Response(JSON.stringify({ success: false, statusCode: status, message }), { status, statusText: message });

type Handler = (url: URL, init?: RequestInit) => Response | undefined;

/**
 * Stubs global fetch with a list of handlers; the first one returning a
 * Response wins. Unhandled requests return 404 so a missing stub is visible
 * rather than hanging.
 */
export function mockFetch(...handlers: Handler[]) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    for (const h of handlers) {
      const r = h(url, init);
      if (r) return r;
    }
    return fail(404, `unmocked ${url.pathname}`);
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

/** Matches an API path (after /api/v1) exactly. */
export const route = (path: string, res: () => Response): Handler =>
  (url) => (url.pathname === `/api/v1${path}` ? res() : undefined);

export function renderWithProviders(
  ui: React.ReactElement,
  { path = '/', routePath = '*' }: { path?: string; routePath?: string } = {},
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={routePath} element={ui} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}
