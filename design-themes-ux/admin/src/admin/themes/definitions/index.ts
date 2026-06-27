/**
 * Theme definitions + migrations — auto-registration
 *
 * Importing this module registers:
 *   1. All bundled theme definitions with themeRegistry
 *   2. All theme migrations with migrationRegistry
 *
 * Usage:
 *   import '@/admin/themes/definitions';   // side-effect: registers all
 */

import { themeRegistry }    from '../registry';
import { migrationRegistry } from '../migrations';
import { buildSectionFromSeed } from '../themePageDocBuilder';
import type { PageDoc }         from '@/admin/editor/types';
import type { ThemeDefinition } from '../types';

// ─── Theme definitions ────────────────────────────────────────────────────────

import { kaveri }        from './kaveri';
import { kaveriV1_1 }    from './kaveri-v1.1';

// Future themes — uncomment as they are built:
// import { suta }        from './suta';
// import { ecraftindia } from './ecraftindia';
// import { jewelry }     from './jewelry';

themeRegistry.register(kaveri);
themeRegistry.register(kaveriV1_1);

// themeRegistry.register(suta);
// themeRegistry.register(ecraftindia);
// themeRegistry.register(jewelry);

// ─── Kaveri 1.0.0 → 1.1.0 migration ─────────────────────────────────────────
//
// Changes:
//   + Adds editorial-2 section after mosaic (if not already present)
//   + Adds 5th trust badge (if trust has fewer than 5 badges)
//   ~ Updates brand-story body copy (only if unchanged from 1.0.0 default)

const KAVERI_1_0_BRAND_BODY =
  'We work with master weavers across India to bring you textiles that carry ' +
  'the weight of generations. Each saree is unique — a conversation between ' +
  "the weaver's hands and centuries of tradition. When you wear Kaveri, you " +
  'become part of that story.';

const KAVERI_1_1_BRAND_BODY =
  'We work with certified master weavers across India to bring you textiles ' +
  'that carry the weight of generations. Every artisan in our cooperative is ' +
  'verified, paid fairly, and celebrated by name. Each saree is unique — a ' +
  "conversation between skilled hands and centuries of tradition.";

const WEAVE_BADGE = {
  icon:        '🏅',
  title:       'Weave Certified',
  description: 'Verified cooperative weavers',
};

migrationRegistry.register({
  themeId:     'kaveri',
  fromVersion: '1.0.0',
  toVersion:   '1.1.0',
  description: 'Add "The Artisan Edit" editorial, 5th trust badge, updated brand story copy',

  migrate(doc: PageDoc, definition: ThemeDefinition): PageDoc {
    let sections = [...doc.sections];

    // ── Add editorial-2 after mosaic (idempotent) ──────────────────────────
    const alreadyHasEditorial2 = sections.some(
      (s) => s.id === 'kaveri_editorial-2',
    );

    if (!alreadyHasEditorial2) {
      const mosaicIdx = sections.findIndex((s) => s.id === 'kaveri_mosaic');
      const editorialSeed = definition.pages.home?.sections.find(
        (s) => s.key === 'editorial-2',
      );

      if (mosaicIdx !== -1 && editorialSeed) {
        const newSection = buildSectionFromSeed('kaveri', editorialSeed);
        sections = [...sections];
        sections.splice(mosaicIdx + 1, 0, newSection);
      }
    }

    // ── Add 5th trust badge (idempotent) ──────────────────────────────────
    sections = sections.map((s) => {
      if (s.id !== 'kaveri_trust') return s;
      const badges = (s.settings.badges as any[]) ?? [];
      const alreadyHasCert = badges.some((b: any) => b.title === WEAVE_BADGE.title);
      if (alreadyHasCert || badges.length >= 5) return s;
      return {
        ...s,
        settings: { ...s.settings, badges: [...badges, WEAVE_BADGE] },
      };
    });

    // ── Update brand story copy (only if unchanged from 1.0.0 default) ────
    sections = sections.map((s) => {
      if (s.id !== 'kaveri_brand-story') return s;
      const currentBody = s.settings.body as string | undefined;
      if (currentBody !== KAVERI_1_0_BRAND_BODY) return s;  // merchant customised — skip
      return {
        ...s,
        settings: { ...s.settings, body: KAVERI_1_1_BRAND_BODY },
      };
    });

    return { ...doc, sections };
  },
});

// ─── Re-export definitions ────────────────────────────────────────────────────

export { kaveri, kaveriV1_1 };
