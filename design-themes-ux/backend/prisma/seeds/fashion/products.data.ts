import { COLOR_OPTIONS, gallery, img, inr, slugify } from './constants';

export type ProductFamily = 'saree' | 'kurti' | 'lehenga' | 'shirt' | 'dupatta' | 'coord';

export interface ProductSeed {
  family: ProductFamily;
  name: string;
  slug: string;
  sku: string;
  barcode: string;
  categorySlug: string;
  brandSlug: string;
  fabric: string;
  pattern: string;
  occasion: string;
  season: string;
  fit: string;
  sleeve: string;
  neck: string;
  color: string;
  price: number;
  comparePrice: number;
  costPrice: number;
  weight: number;
  stock: number;
  lowStockThreshold: number;
  hsCode: string;
  taxCategory: string;
  isFeatured: boolean;
  badges: string[];
  thumbnail: string;
  images: string[];
  variantColors: string[];
  variantSizes: string[];
  shortDescription: string;
  description: string;
  seo: string;
}

interface RawProduct {
  family: ProductFamily;
  name: string;
  categorySlug: string;
  brandSlug: string;
  fabric: string;
  pattern: string;
  occasion: string;
  season: string;
  fit: string;
  sleeve: string;
  neck: string;
  color: string;
  price: number;
  comparePrice: number;
  badges: string[];
  isFeatured?: boolean;
  variantColors: string[];
  variantSizes: string[];
}

const FAMILY_CODE: Record<ProductFamily, string> = {
  saree: 'SAR', kurti: 'KUR', lehenga: 'LEH', shirt: 'SHT', dupatta: 'DUP', coord: 'COD',
};

const FAMILY_HS_CODE: Record<ProductFamily, string> = {
  saree: '54079200', dupatta: '54072000',
  kurti: '62046300', lehenga: '62044290', shirt: '62061000', coord: '62044290',
};

const FAMILY_WEIGHT_KG: Record<ProductFamily, number> = {
  saree: 0.45, dupatta: 0.12, kurti: 0.25, lehenga: 1.1, shirt: 0.2, coord: 0.5,
};

function highlightsFor(p: RawProduct): string[] {
  return [
    `Premium ${p.fabric.toLowerCase()} fabric`,
    `${p.pattern} design`,
    `Ideal for ${p.occasion.toLowerCase()}`,
    `${p.fit} fit with ${p.sleeve.toLowerCase()} sleeves`,
    'Machine wash cold, dry in shade',
  ];
}

function buildDescription(p: RawProduct): string {
  const highlights = highlightsFor(p).map((h) => `- ${h}`).join('\n');
  return [
    `The ${p.name} is crafted from premium ${p.fabric.toLowerCase()} with a beautiful ${p.pattern.toLowerCase()} that makes it perfect for ${p.occasion.toLowerCase()}. `
      + `Finished with a ${p.fit.toLowerCase()} fit and a flattering ${p.neck.toLowerCase()}, this piece pairs effortlessly with both statement and minimal accessories.`,
    '',
    'Highlights:',
    highlights,
    '',
    'Care Instructions: Dry clean recommended for silk and embellished pieces; hand wash cold and dry in shade for cotton and linen pieces. Do not bleach. Iron on reverse at low heat.',
    '',
    'Shipping & Returns: Ships within 2-4 business days. 7-day easy returns and exchange on unused pieces with tags intact. Cash on delivery available across India.',
  ].join('\n');
}

function buildSeo(p: RawProduct): string {
  return JSON.stringify({
    title: `Buy ${p.name} Online | ${inr(p.price)} | NexusCart`,
    description: `Shop the ${p.name} in ${p.color} ${p.fabric} — ${p.occasion} wear, ${p.pattern.toLowerCase()} design. Free shipping & easy returns.`,
    keywords: [p.name, p.fabric, p.color, p.occasion, p.pattern, 'Indian ethnic wear', 'women fashion'].join(', '),
  });
}

function toSeed(raw: RawProduct, familyIndex: number, imageOffset: number): ProductSeed {
  const slug = slugify(raw.name) + '-' + familyIndex;
  const sku = `${FAMILY_CODE[raw.family]}-${String(familyIndex).padStart(3, '0')}`;
  const barcode = `89012${FAMILY_CODE[raw.family].charCodeAt(0)}${String(familyIndex).padStart(6, '0')}`;
  const gstPercent = raw.price <= 1000 ? 5 : 12;

  return {
    family: raw.family,
    name: raw.name,
    slug,
    sku,
    barcode,
    categorySlug: raw.categorySlug,
    brandSlug: raw.brandSlug,
    fabric: raw.fabric,
    pattern: raw.pattern,
    occasion: raw.occasion,
    season: raw.season,
    fit: raw.fit,
    sleeve: raw.sleeve,
    neck: raw.neck,
    color: raw.color,
    price: raw.price,
    comparePrice: raw.comparePrice,
    costPrice: Math.round(raw.price * 0.55),
    weight: FAMILY_WEIGHT_KG[raw.family],
    stock: 18 + ((familyIndex * 7) % 60),
    lowStockThreshold: 5,
    hsCode: FAMILY_HS_CODE[raw.family],
    taxCategory: `GST ${gstPercent}%`,
    isFeatured: raw.isFeatured ?? false,
    badges: raw.badges,
    thumbnail: img(imageOffset, 800, 1000),
    images: gallery(imageOffset, 6),
    variantColors: raw.variantColors,
    variantSizes: raw.variantSizes,
    shortDescription: `${raw.color} ${raw.fabric} ${raw.name.split(' ').slice(-1)[0]} with ${raw.pattern.toLowerCase()} detailing — perfect for ${raw.occasion.toLowerCase()}.`,
    description: buildDescription(raw),
    seo: buildSeo(raw),
  };
}

// ─── Sarees (15) ──────────────────────────────────────────────────────────────
const SAREES: RawProduct[] = [
  { family: 'saree', name: 'Banarasi Silk Saree',            categorySlug: 'sarees', brandSlug: 'anaya',  fabric: 'Silk',           pattern: 'Woven Zari Border',     occasion: 'Wedding',     season: 'All Season', fit: 'Free Size', sleeve: 'N/A', neck: 'N/A', color: 'Maroon',  price: 8499,  comparePrice: 11999, badges: ['Bestseller', 'Featured'], isFeatured: true,  variantColors: ['Maroon', 'Wine'],   variantSizes: ['S', 'M', 'L'] },
  { family: 'saree', name: 'Kanjivaram Silk Saree',          categorySlug: 'sarees', brandSlug: 'anaya',  fabric: 'Silk',           pattern: 'Temple Border',         occasion: 'Wedding',     season: 'All Season', fit: 'Free Size', sleeve: 'N/A', neck: 'N/A', color: 'Mustard', price: 12999, comparePrice: 16999, badges: ['Featured'],               isFeatured: true,  variantColors: ['Mustard', 'Maroon'], variantSizes: ['S', 'M', 'L'] },
  { family: 'saree', name: 'Mysore Silk Saree',              categorySlug: 'sarees', brandSlug: 'vastra', fabric: 'Silk',           pattern: 'Zari Border',           occasion: 'Festive Wear', season: 'All Season', fit: 'Free Size', sleeve: 'N/A', neck: 'N/A', color: 'Wine',     price: 6999,  comparePrice: 9499,  badges: ['Bestseller'],             isFeatured: false, variantColors: ['Wine', 'Black'],    variantSizes: ['S', 'M', 'L'] },
  { family: 'saree', name: 'Tussar Silk Saree',              categorySlug: 'sarees', brandSlug: 'suta',   fabric: 'Tussar Silk',    pattern: 'Hand-painted Madhubani', occasion: 'Festive Wear', season: 'All Season', fit: 'Free Size', sleeve: 'N/A', neck: 'N/A', color: 'Cream',    price: 5499,  comparePrice: 7499,  badges: ['New Arrival'],            isFeatured: false, variantColors: ['Cream', 'White'],   variantSizes: ['S', 'M', 'L'] },
  { family: 'saree', name: 'Chanderi Cotton Saree',          categorySlug: 'sarees', brandSlug: 'suta',   fabric: 'Cotton Silk',    pattern: 'Butti Print',           occasion: 'Office Wear',  season: 'Summer',      fit: 'Free Size', sleeve: 'N/A', neck: 'N/A', color: 'Pink',     price: 2799,  comparePrice: 3499,  badges: [],                          isFeatured: false, variantColors: ['Pink', 'Blue'],     variantSizes: ['S', 'M', 'L'] },
  { family: 'saree', name: 'Cotton Handloom Saree',          categorySlug: 'sarees', brandSlug: 'vastra', fabric: 'Cotton',         pattern: 'Ikat',                  occasion: 'Casual Wear',  season: 'Summer',      fit: 'Free Size', sleeve: 'N/A', neck: 'N/A', color: 'Blue',     price: 1899,  comparePrice: 2399,  badges: ['Trending'],               isFeatured: false, variantColors: ['Blue', 'Green'],    variantSizes: ['S', 'M', 'L'] },
  { family: 'saree', name: 'Linen Saree',                    categorySlug: 'sarees', brandSlug: 'aurus',  fabric: 'Linen',          pattern: 'Solid',                 occasion: 'Summer Collection', season: 'Summer', fit: 'Free Size', sleeve: 'N/A', neck: 'N/A', color: 'Green',    price: 3299,  comparePrice: 3999,  badges: [],                          isFeatured: false, variantColors: ['Green', 'White'],   variantSizes: ['S', 'M', 'L'] },
  { family: 'saree', name: 'Georgette Printed Saree',        categorySlug: 'sarees', brandSlug: 'aurus',  fabric: 'Georgette',      pattern: 'Floral Print',          occasion: 'Party Wear',   season: 'All Season', fit: 'Free Size', sleeve: 'N/A', neck: 'N/A', color: 'Black',    price: 2299,  comparePrice: 2999,  badges: ['Trending'],               isFeatured: false, variantColors: ['Black', 'Wine'],    variantSizes: ['S', 'M', 'L'] },
  { family: 'saree', name: 'Chiffon Ombre Saree',            categorySlug: 'sarees', brandSlug: 'vastra', fabric: 'Chiffon',        pattern: 'Ombre',                 occasion: 'Summer Collection', season: 'Summer', fit: 'Free Size', sleeve: 'N/A', neck: 'N/A', color: 'White',    price: 2599,  comparePrice: 3299,  badges: [],                          isFeatured: false, variantColors: ['White', 'Cream'],   variantSizes: ['S', 'M', 'L'] },
  { family: 'saree', name: 'Organza Sequin Saree',           categorySlug: 'sarees', brandSlug: 'anaya',  fabric: 'Organza',        pattern: 'Sequin Border',         occasion: 'Party Wear',   season: 'All Season', fit: 'Free Size', sleeve: 'N/A', neck: 'N/A', color: 'Red',      price: 4499,  comparePrice: 5999,  badges: ['New Arrival'],            isFeatured: false, variantColors: ['Red', 'Maroon'],    variantSizes: ['S', 'M', 'L'] },
  { family: 'saree', name: 'Bridal Banarasi Silk Saree',     categorySlug: 'sarees', brandSlug: 'anaya',  fabric: 'Silk',           pattern: 'Heavy Zari Work',       occasion: 'Wedding Collection', season: 'All Season', fit: 'Free Size', sleeve: 'N/A', neck: 'N/A', color: 'Red',  price: 15999, comparePrice: 21999, badges: ['Bestseller', 'Featured'], isFeatured: true,  variantColors: ['Red', 'Maroon'],    variantSizes: ['S', 'M', 'L'] },
  { family: 'saree', name: 'Patola Silk Saree',              categorySlug: 'sarees', brandSlug: 'anaya',  fabric: 'Silk',           pattern: 'Patola Print',          occasion: 'Festive Wear', season: 'All Season', fit: 'Free Size', sleeve: 'N/A', neck: 'N/A', color: 'Maroon',   price: 9499,  comparePrice: 12499, badges: ['Featured'],               isFeatured: true,  variantColors: ['Maroon', 'Mustard'], variantSizes: ['S', 'M', 'L'] },
  { family: 'saree', name: 'Bandhani Georgette Saree',       categorySlug: 'sarees', brandSlug: 'vastra', fabric: 'Georgette',      pattern: 'Bandhani',              occasion: 'Festive Wear', season: 'All Season', fit: 'Free Size', sleeve: 'N/A', neck: 'N/A', color: 'Pink',     price: 3199,  comparePrice: 3999,  badges: ['Trending'],               isFeatured: false, variantColors: ['Pink', 'Red'],      variantSizes: ['S', 'M', 'L'] },
  { family: 'saree', name: 'Soft Silk Office Saree',         categorySlug: 'sarees', brandSlug: 'suta',   fabric: 'Soft Silk',      pattern: 'Self Design',           occasion: 'Office Wear',  season: 'All Season', fit: 'Free Size', sleeve: 'N/A', neck: 'N/A', color: 'Mustard',  price: 3899,  comparePrice: 4799,  badges: [],                          isFeatured: false, variantColors: ['Mustard', 'Cream'], variantSizes: ['S', 'M', 'L'] },
  { family: 'saree', name: 'Pochampally Ikat Saree',         categorySlug: 'sarees', brandSlug: 'vastra', fabric: 'Cotton Silk',    pattern: 'Ikat',                  occasion: 'Casual Wear',  season: 'All Season', fit: 'Free Size', sleeve: 'N/A', neck: 'N/A', color: 'Black',    price: 4299,  comparePrice: 5499,  badges: [],                          isFeatured: false, variantColors: ['Black', 'Blue'],    variantSizes: ['S', 'M', 'L'] },
];

// ─── Kurtis (10) ──────────────────────────────────────────────────────────────
const KURTIS: RawProduct[] = [
  { family: 'kurti', name: 'Embroidered Anarkali Kurti',  categorySlug: 'kurtis', brandSlug: 'libas',    fabric: 'Rayon',      pattern: 'Embroidered',    occasion: 'Party Wear',   season: 'All Season', fit: 'Anarkali Flared', sleeve: 'Three-Quarter', neck: 'Round Neck',   color: 'Wine',    price: 1899, comparePrice: 2499, badges: ['Bestseller'],  isFeatured: true,  variantColors: ['Wine', 'Black'],   variantSizes: ['S', 'M', 'L', 'XL'] },
  { family: 'kurti', name: 'Cotton Straight Kurti',       categorySlug: 'kurtis', brandSlug: 'biba',     fabric: 'Cotton',     pattern: 'Printed',        occasion: 'Casual Wear',  season: 'Summer',      fit: 'Straight',        sleeve: 'Three-Quarter', neck: 'Mandarin Collar', color: 'Blue',   price: 999,  comparePrice: 1299, badges: [],              isFeatured: false, variantColors: ['Blue', 'Green'],   variantSizes: ['S', 'M', 'L', 'XL'] },
  { family: 'kurti', name: 'A-Line Solid Kurti',          categorySlug: 'kurtis', brandSlug: 'aurelia',  fabric: 'Rayon',      pattern: 'Solid',          occasion: 'Office Wear',  season: 'All Season', fit: 'A-Line',          sleeve: 'Full Sleeve',   neck: 'V-Neck',         color: 'Green',   price: 1299, comparePrice: 1599, badges: [],              isFeatured: false, variantColors: ['Green', 'Black'],  variantSizes: ['S', 'M', 'L', 'XL'] },
  { family: 'kurti', name: 'Chikankari Hand-Embroidered Kurti', categorySlug: 'kurtis', brandSlug: 'libas', fabric: 'Cotton',  pattern: 'Chikankari',     occasion: 'Festive Wear', season: 'Summer',      fit: 'Straight',        sleeve: 'Three-Quarter', neck: 'Round Neck',   color: 'White',  price: 2199, comparePrice: 2799, badges: ['Featured'],    isFeatured: true,  variantColors: ['White', 'Cream'],  variantSizes: ['S', 'M', 'L', 'XL'] },
  { family: 'kurti', name: 'Floral Printed Flared Kurti', categorySlug: 'kurtis', brandSlug: 'biba',     fabric: 'Rayon',      pattern: 'Floral Print',   occasion: 'Casual Wear',  season: 'Summer',      fit: 'Flared',          sleeve: 'Three-Quarter', neck: 'Round Neck',   color: 'Pink',    price: 1199, comparePrice: 1499, badges: ['Trending'],    isFeatured: false, variantColors: ['Pink', 'Mustard'], variantSizes: ['S', 'M', 'L', 'XL'] },
  { family: 'kurti', name: 'High-Low Embellished Kurti',  categorySlug: 'kurtis', brandSlug: 'indya',    fabric: 'Georgette',  pattern: 'Embellished',    occasion: 'Party Wear',   season: 'All Season', fit: 'High-Low Hem',    sleeve: 'Sleeveless',    neck: 'Boat Neck',      color: 'Black',   price: 2499, comparePrice: 3199, badges: ['New Arrival'], isFeatured: false, variantColors: ['Black', 'Wine'],   variantSizes: ['S', 'M', 'L', 'XL'] },
  { family: 'kurti', name: 'Straight Cotton Office Kurti',categorySlug: 'kurtis', brandSlug: 'aurelia',  fabric: 'Cotton',     pattern: 'Solid',          occasion: 'Office Wear',  season: 'All Season', fit: 'Straight',        sleeve: 'Full Sleeve',   neck: 'Mandarin Collar', color: 'Cream',  price: 1099, comparePrice: 1399, badges: [],              isFeatured: false, variantColors: ['Cream', 'White'],  variantSizes: ['S', 'M', 'L', 'XL'] },
  { family: 'kurti', name: 'Block Print Cotton Kurti',    categorySlug: 'kurtis', brandSlug: 'libas',    fabric: 'Cotton',     pattern: 'Block Print',    occasion: 'Casual Wear',  season: 'Summer',      fit: 'Straight',        sleeve: 'Three-Quarter', neck: 'Round Neck',   color: 'Mustard', price: 999,  comparePrice: 1299, badges: ['Trending'],    isFeatured: false, variantColors: ['Mustard', 'Blue'], variantSizes: ['S', 'M', 'L', 'XL'] },
  { family: 'kurti', name: 'Zari Work Designer Kurti',    categorySlug: 'kurtis', brandSlug: 'indya',    fabric: 'Silk Blend', pattern: 'Zari Work',      occasion: 'Festive Wear', season: 'All Season', fit: 'A-Line',          sleeve: 'Three-Quarter', neck: 'V-Neck',         color: 'Maroon',  price: 2899, comparePrice: 3699, badges: ['Featured'],    isFeatured: true,  variantColors: ['Maroon', 'Mustard'], variantSizes: ['S', 'M', 'L', 'XL'] },
  { family: 'kurti', name: 'Angrakha Style Kurti',        categorySlug: 'kurtis', brandSlug: 'biba',     fabric: 'Cotton',     pattern: 'Solid',          occasion: 'Casual Wear',  season: 'All Season', fit: 'Angrakha',        sleeve: 'Three-Quarter', neck: 'Angrakha Overlap', color: 'Red',  price: 1399, comparePrice: 1799, badges: [],              isFeatured: false, variantColors: ['Red', 'Green'],    variantSizes: ['S', 'M', 'L', 'XL'] },
];

// ─── Lehengas (8) ─────────────────────────────────────────────────────────────
const LEHENGAS: RawProduct[] = [
  { family: 'lehenga', name: 'Bridal Heavy Embroidered Lehenga Choli', categorySlug: 'lehengas', brandSlug: 'shaya', fabric: 'Silk',       pattern: 'Heavy Embroidery', occasion: 'Wedding Collection', season: 'All Season', fit: 'A-Line Flared', sleeve: 'Three-Quarter', neck: 'Sweetheart', color: 'Red',    price: 18999, comparePrice: 24999, badges: ['Bestseller', 'Featured'], isFeatured: true,  variantColors: ['Red', 'Maroon'],   variantSizes: ['S', 'M', 'L'] },
  { family: 'lehenga', name: 'Net Sequin Lehenga Choli',               categorySlug: 'lehengas', brandSlug: 'shaya', fabric: 'Net',        pattern: 'Sequin Work',      occasion: 'Party Wear',         season: 'All Season', fit: 'A-Line Flared', sleeve: 'Sleeveless',    neck: 'Halter',     color: 'Pink',   price: 7999,  comparePrice: 10499, badges: ['Trending'],               isFeatured: false, variantColors: ['Pink', 'Black'],   variantSizes: ['S', 'M', 'L'] },
  { family: 'lehenga', name: 'Banarasi Silk Lehenga Set',              categorySlug: 'lehengas', brandSlug: 'anaya', fabric: 'Silk',       pattern: 'Zari Woven',       occasion: 'Wedding Collection', season: 'All Season', fit: 'A-Line Flared', sleeve: 'Three-Quarter', neck: 'Round Neck', color: 'Maroon', price: 14999, comparePrice: 19999, badges: ['Featured'],               isFeatured: true,  variantColors: ['Maroon', 'Mustard'], variantSizes: ['S', 'M', 'L'] },
  { family: 'lehenga', name: 'Georgette Thread Work Lehenga',          categorySlug: 'lehengas', brandSlug: 'shaya', fabric: 'Georgette',  pattern: 'Thread Work',      occasion: 'Festive Wear',       season: 'All Season', fit: 'A-Line Flared', sleeve: 'Three-Quarter', neck: 'Round Neck', color: 'Green',  price: 6499,  comparePrice: 8499,  badges: [],                          isFeatured: false, variantColors: ['Green', 'Pink'],   variantSizes: ['S', 'M', 'L'] },
  { family: 'lehenga', name: 'Velvet Zardozi Bridal Lehenga',          categorySlug: 'lehengas', brandSlug: 'anaya', fabric: 'Velvet',     pattern: 'Zardozi',          occasion: 'Wedding Collection', season: 'All Season', fit: 'A-Line Flared', sleeve: 'Full Sleeve',   neck: 'Sweetheart', color: 'Wine',   price: 21999, comparePrice: 27999, badges: ['Bestseller'],             isFeatured: true,  variantColors: ['Wine', 'Maroon'],  variantSizes: ['S', 'M', 'L'] },
  { family: 'lehenga', name: 'Mirror Work Designer Lehenga',           categorySlug: 'lehengas', brandSlug: 'shaya', fabric: 'Silk Blend', pattern: 'Mirror Work',      occasion: 'Party Wear',         season: 'All Season', fit: 'A-Line Flared', sleeve: 'Sleeveless',    neck: 'Halter',     color: 'Mustard', price: 8999,  comparePrice: 11999, badges: ['New Arrival'],            isFeatured: false, variantColors: ['Mustard', 'Green'], variantSizes: ['S', 'M', 'L'] },
  { family: 'lehenga', name: 'Crop Top Sequin Lehenga',                categorySlug: 'lehengas', brandSlug: 'shaya', fabric: 'Net',        pattern: 'Sequin',           occasion: 'Party Wear',         season: 'All Season', fit: 'Crop Flared',   sleeve: 'Sleeveless',    neck: 'Boat Neck',  color: 'Black',  price: 6999,  comparePrice: 8999,  badges: ['Trending'],               isFeatured: false, variantColors: ['Black', 'Wine'],   variantSizes: ['S', 'M', 'L'] },
  { family: 'lehenga', name: 'Half Saree Temple Border Lehenga',       categorySlug: 'lehengas', brandSlug: 'anaya', fabric: 'Silk',       pattern: 'Temple Border',    occasion: 'Festive Wear',       season: 'All Season', fit: 'A-Line Flared', sleeve: 'Three-Quarter', neck: 'Round Neck', color: 'Cream',  price: 9499,  comparePrice: 12499, badges: [],                          isFeatured: false, variantColors: ['Cream', 'Maroon'], variantSizes: ['S', 'M', 'L'] },
];

// ─── Women's Shirts (7) ───────────────────────────────────────────────────────
const SHIRTS: RawProduct[] = [
  { family: 'shirt', name: 'Cotton Formal Shirt',         categorySlug: 'shirts', brandSlug: 'w-for-woman', fabric: 'Cotton', pattern: 'Solid',   occasion: 'Office Wear',  season: 'All Season', fit: 'Regular Fit', sleeve: 'Full Sleeve', neck: 'Collared', color: 'White',  price: 1299, comparePrice: 1599, badges: ['Bestseller'], isFeatured: true,  variantColors: ['White', 'Black'],  variantSizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { family: 'shirt', name: 'Floral Printed Casual Shirt', categorySlug: 'shirts', brandSlug: 'aurelia',     fabric: 'Rayon',  pattern: 'Floral Print', occasion: 'Casual Wear', season: 'Summer', fit: 'Relaxed Fit', sleeve: 'Three-Quarter', neck: 'Collared', color: 'Blue',  price: 999,  comparePrice: 1299, badges: ['Trending'],   isFeatured: false, variantColors: ['Blue', 'Pink'],    variantSizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { family: 'shirt', name: 'Striped Office Shirt',        categorySlug: 'shirts', brandSlug: 'w-for-woman', fabric: 'Cotton', pattern: 'Striped', occasion: 'Office Wear',  season: 'All Season', fit: 'Slim Fit',    sleeve: 'Full Sleeve', neck: 'Collared', color: 'Black',  price: 1399, comparePrice: 1799, badges: [],              isFeatured: false, variantColors: ['Black', 'White'],  variantSizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { family: 'shirt', name: 'Pure Linen Shirt',            categorySlug: 'shirts', brandSlug: 'aurelia',     fabric: 'Linen',  pattern: 'Solid',   occasion: 'Summer Collection', season: 'Summer', fit: 'Relaxed Fit', sleeve: 'Full Sleeve', neck: 'Collared', color: 'Green', price: 1599, comparePrice: 1999, badges: ['New Arrival'], isFeatured: false, variantColors: ['Green', 'Cream'],  variantSizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { family: 'shirt', name: 'Tie-Up Waist Shirt',          categorySlug: 'shirts', brandSlug: 'biba',        fabric: 'Rayon',  pattern: 'Solid',   occasion: 'Casual Wear',  season: 'All Season', fit: 'Fitted',      sleeve: 'Three-Quarter', neck: 'V-Neck',   color: 'Pink',   price: 899,  comparePrice: 1199, badges: [],              isFeatured: false, variantColors: ['Pink', 'Mustard'], variantSizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { family: 'shirt', name: 'Embroidered Yoke Shirt',      categorySlug: 'shirts', brandSlug: 'w-for-woman', fabric: 'Cotton', pattern: 'Embroidered', occasion: 'Office Wear', season: 'All Season', fit: 'Regular Fit', sleeve: 'Full Sleeve', neck: 'Collared', color: 'Cream', price: 1799, comparePrice: 2299, badges: ['Featured'],   isFeatured: true,  variantColors: ['Cream', 'White'],  variantSizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { family: 'shirt', name: 'Classic Denim Shirt',         categorySlug: 'shirts', brandSlug: 'aurelia',     fabric: 'Denim',  pattern: 'Solid',   occasion: 'Casual Wear',  season: 'All Season', fit: 'Relaxed Fit', sleeve: 'Full Sleeve', neck: 'Collared', color: 'Blue',  price: 1499, comparePrice: 1899, badges: ['Trending'],   isFeatured: false, variantColors: ['Blue', 'Black'],   variantSizes: ['XS', 'S', 'M', 'L', 'XL'] },
];

// ─── Dupattas (5) ─────────────────────────────────────────────────────────────
const DUPATTAS: RawProduct[] = [
  { family: 'dupatta', name: 'Bandhani Cotton Silk Dupatta',  categorySlug: 'dupattas', brandSlug: 'vastra', fabric: 'Cotton Silk', pattern: 'Bandhani',      occasion: 'Festive Wear', season: 'All Season', fit: 'N/A', sleeve: 'N/A', neck: 'N/A', color: 'Pink',    price: 799,  comparePrice: 999,  badges: ['Trending'],    isFeatured: false, variantColors: ['Pink', 'Mustard'], variantSizes: ['S', 'M', 'L'] },
  { family: 'dupatta', name: 'Chiffon Embroidered Dupatta',   categorySlug: 'dupattas', brandSlug: 'suta',   fabric: 'Chiffon',      pattern: 'Embroidered',   occasion: 'Party Wear',   season: 'All Season', fit: 'N/A', sleeve: 'N/A', neck: 'N/A', color: 'White',   price: 899,  comparePrice: 1199, badges: ['New Arrival'], isFeatured: false, variantColors: ['White', 'Cream'],  variantSizes: ['S', 'M', 'L'] },
  { family: 'dupatta', name: 'Phulkari Hand-Embroidered Dupatta', categorySlug: 'dupattas', brandSlug: 'vastra', fabric: 'Cotton', pattern: 'Phulkari',  occasion: 'Festive Wear', season: 'All Season', fit: 'N/A', sleeve: 'N/A', neck: 'N/A', color: 'Mustard', price: 1199, comparePrice: 1499, badges: ['Featured'],    isFeatured: true,  variantColors: ['Mustard', 'Red'],  variantSizes: ['S', 'M', 'L'] },
  { family: 'dupatta', name: 'Net Sequin Border Dupatta',     categorySlug: 'dupattas', brandSlug: 'suta',   fabric: 'Net',          pattern: 'Sequin Border', occasion: 'Party Wear',   season: 'All Season', fit: 'N/A', sleeve: 'N/A', neck: 'N/A', color: 'Black',   price: 999,  comparePrice: 1299, badges: [],              isFeatured: false, variantColors: ['Black', 'Wine'],   variantSizes: ['S', 'M', 'L'] },
  { family: 'dupatta', name: 'Block Print Cotton Dupatta',    categorySlug: 'dupattas', brandSlug: 'vastra', fabric: 'Cotton',       pattern: 'Block Print',   occasion: 'Casual Wear',  season: 'Summer',      fit: 'N/A', sleeve: 'N/A', neck: 'N/A', color: 'Blue',    price: 599,  comparePrice: 799,  badges: [],              isFeatured: false, variantColors: ['Blue', 'Green'],   variantSizes: ['S', 'M', 'L'] },
];

// ─── Co-ord Sets (5) ──────────────────────────────────────────────────────────
const COORDS: RawProduct[] = [
  { family: 'coord', name: 'Floral Printed Co-ord Set',       categorySlug: 'co-ord-sets', brandSlug: 'indya', fabric: 'Rayon',      pattern: 'Floral Print', occasion: 'Casual Wear',  season: 'Summer',      fit: 'Relaxed Fit', sleeve: 'Three-Quarter', neck: 'Round Neck', color: 'Green',  price: 2199, comparePrice: 2799, badges: ['Trending'],   isFeatured: false, variantColors: ['Green', 'Pink'],   variantSizes: ['S', 'M', 'L', 'XL'] },
  { family: 'coord', name: 'Embroidered Office Co-ord Set',   categorySlug: 'co-ord-sets', brandSlug: 'libas', fabric: 'Cotton',     pattern: 'Embroidered',  occasion: 'Office Wear',  season: 'All Season', fit: 'Regular Fit', sleeve: 'Full Sleeve',   neck: 'Collared',   color: 'Cream',  price: 2599, comparePrice: 3299, badges: ['Featured'],   isFeatured: true,  variantColors: ['Cream', 'White'],  variantSizes: ['S', 'M', 'L', 'XL'] },
  { family: 'coord', name: 'Festive Zari Work Co-ord Set',    categorySlug: 'co-ord-sets', brandSlug: 'aurus', fabric: 'Silk Blend', pattern: 'Zari Work',    occasion: 'Festive Wear', season: 'All Season', fit: 'A-Line',       sleeve: 'Three-Quarter', neck: 'V-Neck',     color: 'Maroon', price: 3499, comparePrice: 4499, badges: ['Bestseller'], isFeatured: true,  variantColors: ['Maroon', 'Mustard'], variantSizes: ['S', 'M', 'L', 'XL'] },
  { family: 'coord', name: 'Summer Solid Co-ord Set',         categorySlug: 'co-ord-sets', brandSlug: 'indya', fabric: 'Cotton',     pattern: 'Solid',        occasion: 'Summer Collection', season: 'Summer', fit: 'Relaxed Fit', sleeve: 'Sleeveless',    neck: 'Round Neck', color: 'White',  price: 1899, comparePrice: 2399, badges: ['New Arrival'], isFeatured: false, variantColors: ['White', 'Blue'],  variantSizes: ['S', 'M', 'L', 'XL'] },
  { family: 'coord', name: 'Sequin Party Co-ord Set',         categorySlug: 'co-ord-sets', brandSlug: 'libas', fabric: 'Georgette',  pattern: 'Sequin',       occasion: 'Party Wear',   season: 'All Season', fit: 'Fitted',       sleeve: 'Sleeveless',    neck: 'Halter',     color: 'Black',  price: 3199, comparePrice: 3999, badges: ['Trending'],   isFeatured: false, variantColors: ['Black', 'Wine'],   variantSizes: ['S', 'M', 'L', 'XL'] },
];

const ALL_RAW: RawProduct[] = [...SAREES, ...KURTIS, ...LEHENGAS, ...SHIRTS, ...DUPATTAS, ...COORDS];

export const PRODUCTS: ProductSeed[] = (() => {
  const familyCounters: Record<ProductFamily, number> = { saree: 0, kurti: 0, lehenga: 0, shirt: 0, dupatta: 0, coord: 0 };
  return ALL_RAW.map((raw, globalIndex) => {
    familyCounters[raw.family] += 1;
    return toSeed(raw, familyCounters[raw.family], globalIndex * 6);
  });
})();

export { COLOR_OPTIONS };
