/**
 * Kaveri 1.1.0 — "The Artisan Edit" upgrade
 *
 * Changes from 1.0.0:
 *
 *   + New section: editorial-2 ("The Artisan Edit") between product_mosaic
 *     and the sale featured_collection.  Adds a richer editorial cadence.
 *
 *   + Trust badge 5: "Weave Certified" — certification badge for weavers
 *     who are verified members of a recognised artisan cooperative.
 *
 *   ~ Brand story copy updated to include "certified weaver" language.
 *
 * Sections added (key identifiers):
 *   'editorial-2'
 *
 * Sections modified (copy change only):
 *   'brand-story'
 *   'trust'
 *
 * Migration path:
 *   1.0.0 → 1.1.0 via migration registered in definitions/index.ts
 */

import type { ThemeDefinition } from '../types';
import { kaveri }               from './kaveri';

export const kaveriV1_1: ThemeDefinition = {
  // Spread 1.0.0 and override changed fields
  ...kaveri,

  meta: {
    ...kaveri.meta,
    version:     '1.1.0',
    description: 'Elegant editorial theme with certified artisan trust signals and richer section cadence.',
    createdAt:   '2026-06-24',
  },

  pages: {
    home: {
      ...kaveri.pages.home,
      sections: [
        // ── Sections 01–07 unchanged from 1.0.0 ────────────────────────────

        ...kaveri.pages.home.sections.slice(0, 7),  // announcement → mosaic

        // ── NEW: editorial-2 (after mosaic, before sale) ───────────────────

        {
          key:   'editorial-2',
          type:  'editorial_banner',
          label: 'The Artisan Edit',
          settings: {
            scriptText:    'The Artisan Edit',
            subtitle:      'Certified cooperative weavers',
            bg:            '#FAF7F2',
            accentColor:   '#2C2420',
            paddingTop:    32,
            paddingBottom: 32,
          },
          blocks: [],
        },

        // ── Sections 08 (sale) unchanged ────────────────────────────────────

        kaveri.pages.home.sections[7],  // sale featured_collection

        // ── Section 09: brand-story — updated copy ────────────────────────

        {
          ...kaveri.pages.home.sections[8],  // brand-story
          settings: {
            ...kaveri.pages.home.sections[8].settings,
            body: 'We work with certified master weavers across India to bring you ' +
                  'textiles that carry the weight of generations. Every artisan in our ' +
                  'cooperative is verified, paid fairly, and celebrated by name. Each saree ' +
                  'is unique — a conversation between skilled hands and centuries of tradition.',
          },
        },

        // ── Section 10: trust — 5th badge added ──────────────────────────

        {
          ...kaveri.pages.home.sections[9],  // trust_badges_bar
          settings: {
            ...kaveri.pages.home.sections[9].settings,
            badges: [
              ...(kaveri.pages.home.sections[9].settings.badges as any[]),
              {
                icon:        '🏅',
                title:       'Weave Certified',
                description: 'Verified cooperative weavers',
              },
            ],
          },
        },

        // ── Section 11: newsletter unchanged ──────────────────────────────

        kaveri.pages.home.sections[10],  // newsletter
      ],
    },
  },
};
