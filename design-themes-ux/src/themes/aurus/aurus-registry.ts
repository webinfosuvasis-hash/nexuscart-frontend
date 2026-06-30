/**
 * aurus-registry.ts — Aurus theme's SectionRegistry.
 *
 * Phase S1C complete: all 17 homepage sections are registered.
 * AurusHomeSections.tsx is now only used as a loading-state fallback
 * and will be removed once Phase S2 (admin editor) is wired.
 *
 * To add a new section:
 *   1. Create its section folder under src/themes/aurus/sections/
 *   2. Export its SectionRegistryEntry from that folder's index.tsx
 *   3. Import and register it here
 */

import { SectionRegistry }             from '@/themes/registry/SectionRegistry';
// sortOrder 1
import { HeroBannerEntry }             from './sections/HeroSection';
// sortOrder 2
import { FeaturedProductsEntry }       from './sections/FeaturedProductsSection';
// sortOrder 3
import { CampaignGridEntry }           from './sections/CampaignGridSection';
// sortOrder 4
import { CategoryDiscoveryEntry }      from './sections/CategoryDiscoverySection';
// sortOrder 5
import { CategoryIconsEntry }          from './sections/CategoryIconsSection';
// sortOrder 6
import { TrustBadgesEntry }            from './sections/TrustBadgesSection';
// sortOrder 7
import { CollectionsEntry }            from './sections/CollectionsSection';
// sortOrder 8
import { BridalEntry }                 from './sections/BridalSection';
// sortOrder 9
import { EditorialBannersEntry }       from './sections/EditorialBannersSection';
// sortOrder 10
import { StoreLocatorEntry }           from './sections/StoreLocatorSection';
// sortOrder 11
import { TryAtHomeEntry }              from './sections/TryAtHomeSection';
// sortOrder 12 — renders null; layout owned by TryAtHomeSection
import { VideoCallEntry }              from './sections/VideoCallSection';
// sortOrder 13
import { GiftRegistryEntry }           from './sections/GiftRegistrySection';
// sortOrder 14
import { PromotionalCardsEntry }       from './sections/PromotionalCardsSection';
// sortOrder 15
import { ExpertHelpEntry }             from './sections/ExpertHelpSection';
// sortOrder 16
import { SocialUGCEntry }              from './sections/SocialUGCSection';
// sortOrder 17
import { NewsletterEntry }             from './sections/NewsletterSection';

/** The Aurus theme's complete section registry (Phase S1C — all 17 sections). */
export const aurusSectionRegistry = new SectionRegistry()
  .register(HeroBannerEntry)
  .register(FeaturedProductsEntry)
  .register(CampaignGridEntry)
  .register(CategoryDiscoveryEntry)
  .register(CategoryIconsEntry)
  .register(TrustBadgesEntry)
  .register(CollectionsEntry)
  .register(BridalEntry)
  .register(EditorialBannersEntry)
  .register(StoreLocatorEntry)
  .register(TryAtHomeEntry)
  .register(VideoCallEntry)
  .register(GiftRegistryEntry)
  .register(PromotionalCardsEntry)
  .register(ExpertHelpEntry)
  .register(SocialUGCEntry)
  .register(NewsletterEntry);
