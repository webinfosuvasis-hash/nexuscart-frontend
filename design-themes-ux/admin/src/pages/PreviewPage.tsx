import React, { useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePreviewData } from '@/hooks/usePreviewData';
import ThemeStyleInjector  from '@/components/storefront/ThemeStyleInjector';
import PreviewShell        from '@/components/storefront/PreviewShell';
import PreviewEditorBridge from '@/components/storefront/PreviewEditorBridge';
import SectionRenderer     from '@/components/storefront/SectionRenderer';
import AnnouncementBarSection from '@/components/storefront/sections/AnnouncementBarSection';
import HeaderSection          from '@/components/storefront/sections/HeaderSection';
import FooterSection          from '@/components/storefront/sections/FooterSection';

// ContentNode renderer — imported lazily to keep old-path bundle unchanged.
// Only loaded when CONTENT_NODE_ENABLED flag is ON (nodeTree present).
import '@/components/node-renderer';  // side-effect: registers all primitives
import { TreeRenderer, RenderContextProvider } from '@/components/node-renderer';
import type { Node } from '@/components/node-renderer';

// ─── Loading skeleton ────────────────────────────────────────────────────────

const PreviewLoading: React.FC = () => (
  <div style={{ minHeight: '100vh', background: '#fff', fontFamily: 'Inter, sans-serif' }}>
    {/* Announcement bar skeleton */}
    <div style={{ height: 32, background: '#e2e8f0', animation: 'nx-pulse 1.5s infinite' }} />

    {/* Header skeleton */}
    <div style={{ height: 60, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 24 }}>
      <div style={{ width: 120, height: 24, borderRadius: 6, background: '#e2e8f0', animation: 'nx-pulse 1.5s infinite' }} />
      <div style={{ flex: 1, display: 'flex', gap: 16 }}>
        {[80, 60, 70].map((w, i) => (
          <div key={i} style={{ width: w, height: 14, borderRadius: 4, background: '#e2e8f0', animation: `nx-pulse 1.5s ${i * 0.15}s infinite` }} />
        ))}
      </div>
    </div>

    {/* Hero skeleton */}
    <div style={{ height: 520, background: '#e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, animation: 'nx-pulse 1.5s infinite' }}>
      <div style={{ width: 480, height: 48, borderRadius: 8, background: 'rgba(255,255,255,0.3)' }} />
      <div style={{ width: 320, height: 20, borderRadius: 6, background: 'rgba(255,255,255,0.25)' }} />
      <div style={{ width: 140, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.35)' }} />
    </div>

    {/* Product grid skeleton */}
    <div style={{ padding: '48px 24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ width: 180, height: 28, borderRadius: 6, background: '#e2e8f0', marginBottom: 24, animation: 'nx-pulse 1.5s infinite' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[1,2,3,4].map((i) => (
          <div key={i} style={{ borderRadius: 12, overflow: 'hidden', animation: `nx-pulse 1.5s ${i * 0.1}s infinite` }}>
            <div style={{ paddingTop: '100%', background: '#e2e8f0' }} />
            <div style={{ padding: 12, background: '#f8fafc' }}>
              <div style={{ height: 14, background: '#e2e8f0', borderRadius: 4, marginBottom: 8 }} />
              <div style={{ height: 14, width: '60%', background: '#e2e8f0', borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    </div>

    <style>{`
      @keyframes nx-pulse {
        0%, 100% { opacity: 1 }
        50% { opacity: 0.5 }
      }
    `}</style>
  </div>
);

// ─── Error state ─────────────────────────────────────────────────────────────

const ERROR_MESSAGES: Record<string, { title: string; body: string }> = {
  expired:       { title: 'Preview link has expired',      body: 'Preview links are valid for 24 hours. Request a new preview link from the admin panel.' },
  forbidden:     { title: 'Access denied',                  body: 'This preview link is not valid for the requested store.' },
  network:       { title: 'Unable to load preview',        body: 'Please check your connection and try refreshing.' },
  no_token:      { title: 'No preview token',              body: 'This URL is missing the preview token. Open the preview link from the admin panel.' },
  missing_params: { title: 'Invalid preview URL',          body: 'The preview URL is malformed. Please generate a new preview link.' },
};

const PreviewError: React.FC<{ error: string | null }> = ({ error }) => {
  const info = ERROR_MESSAGES[error ?? 'unknown'] ?? { title: 'Preview unavailable', body: error ?? 'An unexpected error occurred.' };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'Inter, sans-serif', padding: 24 }}>
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>
          🔗
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{info.title}</h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>{info.body}</p>
        <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
          If you believe this is an error, contact the store administrator.
        </p>
      </div>
    </div>
  );
};

// ─── Preview renderer ─────────────────────────────────────────────────────────

const PreviewRenderer: React.FC<{
  data:     NonNullable<ReturnType<typeof usePreviewData>['data']>;
  onRefresh: (token: string) => void;
}> = ({ data, onRefresh }) => {
  const { themeConfig, headerConfig, footerConfig, sections, store } = data;

  // ── CONTENT_NODE_ENABLED path ──────────────────────────────────────────────
  // When the feature flag is ON, the backend includes nodeTree in the response.
  // TreeRenderer handles the full page; old header/footer/sections are bypassed.
  // This path activates per-store — all other stores remain on the old path.
  if (data.nodeTree) {
    // Build pageContext: thread menus so MenuBlock renders real navigation items
    // (not the "Home / Catalog / Contact" fallback).
    // `data.menus` is Record<handle, { id, label, url }[]> from DraftPageData.
    const nodePageContext = {
      menus:  (data as any).menus  ?? {},
      store:  data.store            ?? {},
    };

    return (
      <div
        data-renderer="content-node"
        style={{ minHeight: '100vh', background: themeConfig.colors.background ?? '#fff' }}
      >
        <RenderContextProvider
          breakpoint="desktop"
          themeTokens={themeConfig.colors}
          storeId={data.storeId}
          pageContext={nodePageContext}
          isPreview={true}
        >
          <TreeRenderer tree={data.nodeTree as unknown as Node} />
        </RenderContextProvider>
        <PreviewEditorBridge onRefresh={onRefresh} />
      </div>
    );
  }

  // ── ORIGINAL PATH (unchanged) ─────────────────────────────────────────────
  // All stores without CONTENT_NODE_ENABLED reach here.
  // Nothing below this line is modified.
  const zone1     = headerConfig?.zones?.find((z: any) => z.id === 'zone1');
  const mainZones = headerConfig?.zones?.filter((z: any) => z.id !== 'zone1') ?? [];

  return (
    <div
      data-renderer="legacy"
      style={{ minHeight: '100vh', background: themeConfig.colors.background ?? '#fff' }}
    >
      {/* Announcement bar (zone 1) */}
      {zone1 && zone1.components?.length > 0 && (
        <AnnouncementBarSection zone={zone1} themeColors={themeConfig.colors} />
      )}

      {/* Header */}
      {headerConfig && (
        <HeaderSection
          zones={mainZones}
          behavior={headerConfig.behavior ?? {}}
          themeColors={themeConfig.colors}
          storeName={store.name}
          logoUrl={store.logo}
          menus={data.menus ?? {}}
        />
      )}

      {/* Template sections (hero, collections, newsletter, etc.) */}
      <main>
        {sections
          .filter((s) => s.isVisible)
          .map((section) => (
            <SectionRenderer
              key={section.id}
              section={section}
              themeConfig={themeConfig as any}
              storeName={store.name}
            />
          ))}
      </main>

      {/* Footer */}
      {footerConfig && (
        <FooterSection
          columns={footerConfig.columns ?? []}
          bottomBar={footerConfig.bottomBar ?? {}}
          settings={footerConfig.settings ?? {}}
          themeColors={themeConfig.colors}
          storeName={store.name}
          logoUrl={store.logo}
          menus={data.menus ?? {}}
        />
      )}

      {/* Editor bridge */}
      <PreviewEditorBridge onRefresh={onRefresh} />
    </div>
  );
};

// ─── PreviewPage ──────────────────────────────────────────────────────────────

/**
 * PreviewPage — Sprint 5
 *
 * Route: /preview/:storeId/:pageId?token={jwt}
 *
 * Responsibilities:
 *   1. Extract storeId, pageId from URL params
 *   2. Extract preview JWT from ?token= query param
 *   3. Validate token and fetch DraftPageData from backend
 *   4. Render the storefront with draft theme, header, footer, and sections
 *
 * Security:
 *   - Token is never stored in localStorage
 *   - JWT validation happens server-side (StorefrontGuard)
 *   - Page is marked noindex/nofollow
 *
 * Future (Sprint 7-8):
 *   - PreviewEditorBridge activates when loaded in Theme Editor iframe
 *   - CSS live update path (EDITOR_CSS_UPDATE) replaces re-fetching
 */
const PreviewPage: React.FC = () => {
  const { storeId, pageId }  = useParams<{ storeId: string; pageId: string }>();
  const [searchParams]       = useSearchParams();
  const token                = searchParams.get('token');

  const { status, data, error, refresh } = usePreviewData(storeId, pageId, token);

  // Refresh callback for PreviewEditorBridge (receives new draftToken on EDITOR_REFRESH)
  const handleRefresh = useCallback((_newToken: string) => {
    // In Sprint 5: re-fetch with the same token (EDITOR_REFRESH not yet wired from editor)
    // In Sprint 7-8: fetch with newToken for instant canvas updates
    refresh();
  }, [refresh]);

  if (!token) return <PreviewError error="no_token" />;

  if (status === 'loading' || status === 'idle') return <PreviewLoading />;

  if (status === 'error' || !data) return <PreviewError error={error} />;

  return (
    <PreviewShell data={data}>
      <ThemeStyleInjector themeConfig={data.themeConfig as any} />
      <PreviewRenderer data={data} onRefresh={handleRefresh} />
    </PreviewShell>
  );
};

export default PreviewPage;
