import { img, slugify } from './constants';
import type { ProductSeed } from './products.data';

export interface CollectionSeed {
  name: string;
  slug: string;
  description: string;
  image: string;
  isFeatured: boolean;
  /** Selects which seeded products belong to this collection. */
  matches: (p: ProductSeed) => boolean;
}

const RAW_COLLECTIONS: Array<Pick<CollectionSeed, 'name' | 'description' | 'matches'> & { isFeatured?: boolean }> = [
  { name: 'New Arrivals',        description: 'The latest additions to our fashion edit — fresh prints, fabrics and silhouettes.', isFeatured: true,  matches: (p) => p.badges.includes('New Arrival') },
  { name: 'Best Sellers',        description: 'Customer favourites that keep flying off the shelf.',                              isFeatured: true,  matches: (p) => p.badges.includes('Bestseller') },
  { name: 'Wedding Collection',  description: 'Bridal and wedding-guest fashion for every ceremony, from the mehendi to the reception.', isFeatured: true, matches: (p) => p.occasion.toLowerCase().includes('wedding') },
  { name: 'Office Wear',         description: 'Polished, comfortable pieces for the workplace.',                                  isFeatured: false, matches: (p) => p.occasion === 'Office Wear' },
  { name: 'Summer Collection',   description: 'Lightweight, breathable fabrics to beat the heat.',                                 isFeatured: true,  matches: (p) => p.season === 'Summer' },
  { name: 'Premium Collection',  description: 'Our most luxurious silks, velvets and hand-embroidered pieces.',                    isFeatured: true,  matches: (p) => p.price >= 8000 },
  { name: 'Silk Collection',     description: 'Pure and blended silk sarees, lehengas and suits.',                                 isFeatured: false, matches: (p) => p.fabric.toLowerCase().includes('silk') },
  { name: 'Cotton Collection',   description: 'Breathable pure cotton pieces for everyday comfort.',                               isFeatured: false, matches: (p) => p.fabric.toLowerCase().includes('cotton') && !p.fabric.toLowerCase().includes('silk') },
  { name: 'Festive Collection',  description: 'Vibrant, statement pieces for Diwali, Navratri and every festive occasion.',        isFeatured: true,  matches: (p) => p.occasion === 'Festive Wear' },
  { name: 'Trending Now',        description: 'What everyone is shopping for this season.',                                       isFeatured: false, matches: (p) => p.badges.includes('Trending') },
];

export const COLLECTIONS: CollectionSeed[] = RAW_COLLECTIONS.map((c, i) => ({
  ...c,
  slug: slugify(c.name),
  image: img(i + 50, 800, 600),
  isFeatured: c.isFeatured ?? false,
}));
