/**
 * HeroSection resolver — data resolver for the Hero Banner Carousel.
 *
 * The Hero Banner is entirely self-contained: all content (images, text, CTAs)
 * is stored in the section config. No external API calls are needed.
 *
 * This resolver returns an empty object, satisfying the DataResolver contract
 * while making explicit that this section has zero external dependencies.
 */

import type { DataResolver } from '@/themes/registry/types';
import type { HeroConfig, HeroData } from './HeroSection.types';

export const heroResolver: DataResolver<HeroConfig, HeroData> = async (
  _config,  // unused — hero is self-contained
  _context, // unused
): Promise<HeroData> => ({});
