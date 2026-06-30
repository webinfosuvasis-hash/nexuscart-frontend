/**
 * AurusHomeV2 — Single-render, data-driven Aurus homepage.
 *
 * ═══════════════════════════════════════════════════════════════════
 * SINGLE-RENDER GUARANTEE
 * ═══════════════════════════════════════════════════════════════════
 * AurusHome (V1) is NEVER imported or rendered here.
 * There is exactly ONE hero section at all times:
 *
 *   Loading:  AurusHeader + HeroSkeleton + AurusHomeSections
 *   Loaded:   AurusHeader + SectionRenderer(hero) + AurusHomeSections
 *
 * The HeroSkeleton matches the hero's exact dimensions (height, margin,
 * border-radius) so there is no layout shift when the real hero loads.
 *
 * ═══════════════════════════════════════════════════════════════════
 * PHASE S1A
 * ═══════════════════════════════════════════════════════════════════
 * Only hero_banner is registered in the Section Registry.
 * All other sections (2–17) render from AurusHomeSections (V1 JSX).
 *
 * ═══════════════════════════════════════════════════════════════════
 * PHASE S1B — Featured Products, Campaign Grid, Collections
 * ═══════════════════════════════════════════════════════════════════
 * Three more entries added to the registry. AurusHomeV2 uses
 * startFrom/stopBefore to interleave registry renders with
 * AurusHomeSections at the correct visual positions:
 *
 *   hero(1)           → SectionRenderer
 *   featured(2)       → SectionRenderer
 *   campaign(3)       → SectionRenderer
 *   discovery→trust(4-6) → AurusHomeSections(stopBefore='collections')
 *   collections(7)    → SectionRenderer
 *   bridal→footer(8+) → AurusHomeSections(startFrom='bridal_section')
 *
 * ═══════════════════════════════════════════════════════════════════
 * FALLBACK CHAIN (storefront never breaks)
 * ═══════════════════════════════════════════════════════════════════
 * If VITE_STORE_ID is missing → skeleton + AurusHomeSections (no hero config)
 * If API loading              → HeroSkeleton + AurusHomeSections
 * If API error / unseeded     → HeroSkeleton + AurusHomeSections
 * If data resolves            → full V2 render
 */

// Side-effect: registers Aurus theme in the global ThemeRegistry
import '@/themes/aurus/AurusTheme';

import React, { useEffect, useState } from 'react';
import { ThemeRegistry }            from '@/themes/registry/ThemeRegistry';
import { mergeWithDefaults }        from '@/themes/aurus/sections/shared/pipeline';
import SectionRenderer              from '@/components/storefront/SectionRenderer';
import HeroSkeleton                 from '@/themes/aurus/sections/HeroSection/HeroSkeleton';
import AurusHomeSections            from '@/themes/aurus/AurusHomeSections';
import { useStorefrontHomepage }    from '@/hooks/useStorefrontHomepage';
import AurusHeader                  from '@/themes/aurus/AurusHeader';
import type { ResolverContext }     from '@/themes/registry/types';
import type { ApiStorefrontSection } from '@/lib/storefrontApi';
import { fetchStorefrontPath }             from '@/lib/storefrontApi';
import { activeDemoAssetProvider }         from '@/themes/aurus/sections/shared/AurusDemoAssetProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResolvedSection {
  id:           string;
  sectionType:  string;
  sortOrder:    number;
  config:       Record<string, unknown>;
  data:         Record<string, unknown>;
  isRegistered: boolean;
}

const STORE_ID = import.meta.env.VITE_STORE_ID ?? '';

// ─── AurusHomeV2 ──────────────────────────────────────────────────────────────

const AurusHomeV2: React.FC = () => {
  const [searchQuery, setSearchQuery] = React.useState('');

  const { homepage, isLoading, isError } = useStorefrontHomepage();
  const [resolved,  setResolved]  = useState<ResolvedSection[] | null>(null);
  const [resolving, setResolving] = useState(false);

  // ── Pipeline: parse → merge → validate → resolve for all sections ─────────

  useEffect(() => {
    if (!homepage || homepage._unseeded) { setResolved([]); return; }
    setResolving(true);

    const themeEntry = ThemeRegistry.getTheme(homepage.themeId);
    const registry   = themeEntry.sectionRegistry;

    const context: ResolverContext = {
      storeId:     STORE_ID,
      isPreview:   false,
      sharedCache: new Map(),
      // Phase S2: real public API fetcher — storeId automatically included via
      // storefrontApi.ts which reads VITE_STORE_ID for the X-Store-Id header.
      fetchStorefront: fetchStorefrontPath,
      // Demo asset provider — selected by environment at build time.
      // Dev builds:  aurusDemoProvider  → real Aurus CDN images (pixel-identical to V1)
      // Prod builds: placeholderProvider → empty strings (graceful degraded state)
      // Resolvers use context.demoAssets instead of importing PRODUCTS.aurus directly.
      demoAssets: activeDemoAssetProvider,
    };

    Promise.allSettled(
      homepage.sections.map(async (section: ApiStorefrontSection): Promise<ResolvedSection> => {
        const entry = registry.get(section.sectionType);

        if (!entry) {
          return { id: section.id, sectionType: section.sectionType, sortOrder: section.sortOrder, config: section.config, data: {}, isRegistered: false };
        }

        // 1. Parse JSON → typed config
        const parsed = entry.parseConfig(section.config);
        // 2. Deep-merge with defaults (no undefined fields)
        const merged = mergeWithDefaults(parsed, entry.defaultConfig);
        // 3. Validate (errors logged; render continues)
        const validated = entry.validateConfig(merged);
        // 4. Resolve data (failures yield defaultData)
        let data: Record<string, unknown> = { ...(entry.defaultData as Record<string, unknown>) };
        try { data = await entry.resolveData(validated.config, context) as Record<string, unknown>; }
        catch (err) { console.warn(`[AurusHomeV2] Resolver failed for "${section.sectionType}":`, err); }

        return { id: section.id, sectionType: section.sectionType, sortOrder: section.sortOrder, config: validated.config as Record<string, unknown>, data, isRegistered: true };
      }),
    ).then(results => {
      setResolved(
        results
          .filter((r): r is PromiseFulfilledResult<ResolvedSection> => r.status === 'fulfilled')
          .map(r => r.value)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      );
      setResolving(false);
    });
  }, [homepage]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const isDataReady = resolved !== null && !resolving;
  const registry    = homepage ? ThemeRegistry.getTheme(homepage.themeId).sectionRegistry : null;
  const showLoading = !isDataReady || isLoading || resolving;

  // registeredSet for the loading-state fallback only
  const registeredSet = new Set(resolved?.filter(s => s.isRegistered).map(s => s.sectionType) ?? []);

  // ── Render ────────────────────────────────────────────────────────────────
  //
  // KEY INVARIANT: sections MUST render in the order returned by the API.
  // `resolved` is already sorted by sortOrder in the useEffect above.
  // Any hardcoded rendering sequence would break drag-and-drop reordering.

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header is always first — not a BuilderSection */}
      <AurusHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      {showLoading ? (
        /* ── Loading state: skeleton hero + V1 fallback sections in DB sortOrder ──
           Two sub-phases:
             Phase A  homepage = null  (API still fetching, ~50–200 ms):
               Render V1 sections in hardcoded SECTION_ORDER — acceptable because
               this phase is brief and the DB order is not yet known.
             Phase B  homepage ≠ null  (API responded, resolvers still running):
               Render sections in DB sortOrder using renderOnly — IDENTICAL to the
               position order that the loaded state will use.  This eliminates the
               visual "jump" where sections would rearrange when loading completes
               after the user has reordered sections via admin drag-and-drop.      */
        homepage ? (
          /* Phase B — DB order is known; match the final loaded layout exactly */
          <>
            <HeroSkeleton />
            {homepage.sections
              .filter(s => s.sectionType !== 'hero_banner')
              .map(s => (
                <AurusHomeSections key={s.id} renderOnly={s.sectionType} />
              ))
            }
            <AurusHomeSections renderFooterAndCart />
          </>
        ) : (
          /* Phase A — DB order unknown; use V1 hardcoded order as a warm placeholder */
          <>
            <HeroSkeleton />
            <AurusHomeSections skipTypes={registeredSet} />
          </>
        )
      ) : (
        /* ── Loaded state: render sections in EXACT API sortOrder ──────────
           This is the critical path that makes drag-and-drop work:
             1. `resolved` is sorted by section.sortOrder (from API)
             2. We iterate in that order — no hardcoding, no position assumptions
             3. Registered sections → SectionRenderer (data-driven, full pipeline)
             4. Unregistered sections → AurusHomeSections(renderOnly) (V1 fallback)
             5. Footer + CartDrawer rendered once at the end                    */
        <>
          {resolved!.map(section => {
            if (section.isRegistered && registry) {
              // Data-driven: parse → validate → resolve → render already done
              return (
                <SectionRenderer
                  key={section.id}
                  sectionType={section.sectionType}
                  config={section.config}
                  data={section.data}
                  registry={registry}
                  isPreview={false}
                />
              );
            }
            // Hardcoded V1 fallback for sections not yet in the registry.
            // renderOnly ensures ONLY this section renders — no footer, no duplication.
            return (
              <AurusHomeSections
                key={section.id}
                renderOnly={section.sectionType}
              />
            );
          })}

          {/* Footer + CartDrawer — always last, never a BuilderSection */}
          <AurusHomeSections renderFooterAndCart />
        </>
      )}
    </div>
  );
};

export default AurusHomeV2;
