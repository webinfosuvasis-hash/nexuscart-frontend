/**
 * Shared constants + helpers for the "Indian Ladies Fashion" production seed.
 *
 * Targets the existing store that the running Aurus storefront reads from
 * (VITE_STORE_ID in design-themes-ux/.env.development). This store already
 * exists in the DB with an owner, root categories, and 17 Homepage Builder
 * sections — the seeder upserts into it, it never recreates it.
 */

export const STORE_ID = 'cmqpfhdsf0003bhb9df1jq8j2';

/**
 * Curated pool of permanent images.unsplash.com/photo-<id> URLs.
 *
 * Every ID below was both (a) verified to return HTTP 200, and (b) downloaded
 * and visually reviewed to confirm it actually depicts women's clothing/
 * fashion content (sarees, dresses, coats, racks of garments, etc.) — an
 * earlier pass here picked IDs from memory and several turned out to show
 * unrelated subjects (a man in a suit, a chef, jewelry, a baby, a car).
 * Reused across products/variants/banners at different crop sizes via query
 * params (Unsplash serves any size from the same source photo on demand).
 */
export const IMAGE_POOL_IDS = [
  '1610030469983-98e550d6193c', // Indian woman in a saree
  '1601924994987-69e26d50dc26', // jackets on a clothing rack
  '1490481651871-ab68de25d43d', // clothes on hangers, closet
  '1483985988355-763728e1935b', // woman in maroon coat with shopping bags
  '1485968579580-b6d095142e6e', // woman in plaid coat, street style
  '1539109136881-3be0616acf4b', // woman in blue coat, Milan street style
  '1539008835657-9e8e9680c956', // woman in blue dress on the beach
  '1515372039744-b8f02a3ae446', // woman in white dress on stairs
  '1525507119028-ed4c629a60a3', // jeans, shirt and shoes flat-lay
  '1572804013309-59a88b7e92f1', // woman in red floral dress
  '1596783074918-c84cb06531ca', // woman in peach dress with plant
  '1567401893414-76b7b1e5a7a5', // closet, clothes on rack
  '1581044777550-4cfa60707c03', // woman in pink ruffled dress, field
  '1517841905240-472988babdf9', // woman in denim jacket and hoodie
  '1554568218-0f1715e72254',    // woman in white graphic t-shirt
  '1542295669297-4d352b042bca', // woman in red floral dress, shadow
  '1518049362265-d5b2a6467637', // bridal/wedding shoes close-up
  '1525450824786-227cbef70703', // woman in gingham jacket, street style
  '1496747611176-843222e1e57c', // woman in floral wrap dress, beach
  '1551803091-e20673f15770',    // woman in purple crochet cutout dress
  '1581338834647-b0fb40704e21', // woman in white shirt with suspenders
  '1566174053879-31528523f8ae', // woman in purple off-shoulder dress
  '1503185912284-5271ff81b9a8', // woman in hat and off-shoulder top
  '1551232864-3f0890e580d9',    // clothing rack with jackets and shoes
];

/** Build a sized/cropped Unsplash URL from a pool index (wraps around the pool). */
export function img(index: number, w = 800, h = 1000): string {
  const id = IMAGE_POOL_IDS[((index % IMAGE_POOL_IDS.length) + IMAGE_POOL_IDS.length) % IMAGE_POOL_IDS.length];
  return `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&q=80&auto=format&fit=crop`;
}

/** Build a gallery of N distinct sized images starting at a given pool offset. */
export function gallery(offset: number, count: number, w = 900, h = 1125): string[] {
  return Array.from({ length: count }, (_, i) => img(offset + i, w, h));
}

export const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export const COLOR_OPTIONS = ['Red', 'Pink', 'Blue', 'Green', 'Black', 'White', 'Cream', 'Mustard', 'Maroon', 'Wine'] as const;

/** Deterministic slugifier (lowercase, hyphenated, strips punctuation). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** INR price formatter for description copy. */
export function inr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
