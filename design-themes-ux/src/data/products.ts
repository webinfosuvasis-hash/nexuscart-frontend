export type ThemeKey = 'craft' | 'jewel' | 'fashion' | 'market' | 'aurus';

export interface Product {
  id: string;
  theme: ThemeKey;
  name: string;
  category: string;
  price: number;
  mrp: number;
  image: string;
  badge?: string;
  rating: number;
  reviews: number;
  desc: string;
  tryAtHome?: boolean;
  metalType?: string;
}

const craftImgs = [
  'https://d64gsuwffb70l.cloudfront.net/6a3b4da249de39a7622ff70c_1782271589680_18359a72.png',
  'https://d64gsuwffb70l.cloudfront.net/6a3b4da249de39a7622ff70c_1782271609116_130f778a.png',
  'https://d64gsuwffb70l.cloudfront.net/6a3b4da249de39a7622ff70c_1782271585499_a9d9c8bc.jpg',
  'https://d64gsuwffb70l.cloudfront.net/6a3b4da249de39a7622ff70c_1782271591212_45eb1817.png',
];
const jewelImgs = [
  'https://d64gsuwffb70l.cloudfront.net/6a3b4da249de39a7622ff70c_1782271632215_fb902b18.png',
  'https://d64gsuwffb70l.cloudfront.net/6a3b4da249de39a7622ff70c_1782271624008_3cf817ec.jpg',
  'https://d64gsuwffb70l.cloudfront.net/6a3b4da249de39a7622ff70c_1782271631001_66abad25.png',
  'https://d64gsuwffb70l.cloudfront.net/6a3b4da249de39a7622ff70c_1782271632108_b37d0dc7.png',
];
const fashionImgs = [
  'https://d64gsuwffb70l.cloudfront.net/6a3b4da249de39a7622ff70c_1782271662034_23c895cf.png',
  'https://d64gsuwffb70l.cloudfront.net/6a3b4da249de39a7622ff70c_1782271671597_ef85e085.png',
  'https://d64gsuwffb70l.cloudfront.net/6a3b4da249de39a7622ff70c_1782271655754_51c2a078.jpg',
  'https://d64gsuwffb70l.cloudfront.net/6a3b4da249de39a7622ff70c_1782271658079_7cca4ec4.jpg',
];
const marketImgs = [
  'https://d64gsuwffb70l.cloudfront.net/6a3b4da249de39a7622ff70c_1782271699490_a260db24.png',
  'https://d64gsuwffb70l.cloudfront.net/6a3b4da249de39a7622ff70c_1782271689982_668caae0.jpg',
  'https://d64gsuwffb70l.cloudfront.net/6a3b4da249de39a7622ff70c_1782271696303_436eb47b.png',
  'https://d64gsuwffb70l.cloudfront.net/6a3b4da249de39a7622ff70c_1782271692215_f8204994.jpg',
];

// Aurus — 8 unique Indian ladies garment images (suta.in style sarees, all verified Unsplash free-tier)
const aurusImgs = [
  'https://images.unsplash.com/photo-1614940685083-c5409b57da6e?auto=format&fit=crop&w=600&h=600&q=80', // orange sari on balcony
  'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=600&h=600&q=80', // woman in red & blue sari
  'https://images.unsplash.com/photo-1654764746225-e63f5e90facd?auto=format&fit=crop&w=600&h=600&q=80', // red & gold bridal outfit
  'https://images.unsplash.com/photo-1583878448938-0de973eec3b9?auto=format&fit=crop&w=600&h=600&q=80', // group of women in red & gold saris
  'https://images.unsplash.com/photo-1727430228383-aa1fb59db8bf?auto=format&fit=crop&w=600&h=600&q=80', // Kerala sari portrait
  'https://images.unsplash.com/photo-1679006831648-7c9ea12e5807?auto=format&fit=crop&w=600&h=600&q=80', // green sari with jewellery
  'https://images.unsplash.com/photo-1692992193981-d3d92fabd9cb?auto=format&fit=crop&w=600&h=600&q=80', // colorful festive sari
  'https://images.unsplash.com/photo-1572470176170-98fa8abcb741?auto=format&fit=crop&w=600&h=600&q=80', // black & white saree, outdoor
];

const aurusProducts: Product[] = [
  { id: 'aurus-1', theme: 'aurus', name: 'Line of Hearts Diamond Ring', category: 'Rings', price: 10151, mrp: 14715, image: aurusImgs[0], badge: 'New', rating: 4.5, reviews: 234, desc: 'A delicate ring featuring heart-shaped diamonds set in 18KT gold, crafted for everyday love.', tryAtHome: true, metalType: '18KT Gold' },
  { id: 'aurus-2', theme: 'aurus', name: 'Classic Solitaire Diamond Ring', category: 'Rings', price: 32450, mrp: 44620, image: aurusImgs[1], badge: 'Bestseller', rating: 4.8, reviews: 891, desc: 'A timeless solitaire ring with a brilliant-cut diamond set in 18KT white gold.', tryAtHome: true, metalType: '18KT White Gold' },
  { id: 'aurus-3', theme: 'aurus', name: 'Rose Gold Diamond Stud Earrings', category: 'Earrings', price: 8799, mrp: 13200, image: aurusImgs[2], badge: 'New', rating: 4.6, reviews: 456, desc: 'Elegant diamond studs crafted in 18KT rose gold — the perfect everyday luxury.', tryAtHome: false, metalType: '18KT Rose Gold' },
  { id: 'aurus-4', theme: 'aurus', name: 'Floral Diamond Drop Earrings', category: 'Earrings', price: 18950, mrp: 26800, image: aurusImgs[3], badge: undefined, rating: 4.4, reviews: 178, desc: 'Blooming floral diamond earrings in 18KT gold, inspired by nature\'s finest designs.', tryAtHome: true, metalType: '18KT Gold' },
  { id: 'aurus-5', theme: 'aurus', name: 'Eternal Diamond Pendant Necklace', category: 'Necklaces', price: 22500, mrp: 32400, image: aurusImgs[4], badge: 'Bestseller', rating: 4.9, reviews: 612, desc: 'A stunning diamond pendant suspended on a fine 18KT white gold chain.', tryAtHome: true, metalType: '18KT White Gold' },
  { id: 'aurus-6', theme: 'aurus', name: 'Heart Lock Gold Necklace', category: 'Necklaces', price: 14200, mrp: 19860, image: aurusImgs[5], badge: undefined, rating: 4.7, reviews: 342, desc: 'A charming heart-shaped lock necklace in 22KT yellow gold — a timeless symbol of love.', tryAtHome: false, metalType: '22KT Gold' },
  { id: 'aurus-7', theme: 'aurus', name: 'Diamond Tennis Bracelet', category: 'Bracelets', price: 45800, mrp: 66200, image: aurusImgs[6], badge: 'Bestseller', rating: 4.7, reviews: 189, desc: 'A classic tennis bracelet with round brilliant diamonds in 18KT gold — elegant on every wrist.', tryAtHome: true, metalType: '18KT Gold' },
  { id: 'aurus-8', theme: 'aurus', name: 'Twisted Rope Gold Bangle', category: 'Bracelets', price: 12700, mrp: 17800, image: aurusImgs[7], badge: 'New', rating: 4.3, reviews: 95, desc: 'An elegant twisted rope bangle in 22KT yellow gold — crafted to be worn every day.', tryAtHome: false, metalType: '22KT Gold' },
];

export const HERO_IMAGES: Record<ThemeKey, string> = {
  craft: 'https://d64gsuwffb70l.cloudfront.net/6a3b4da249de39a7622ff70c_1782271737296_b5e559d8.png',
  jewel: 'https://d64gsuwffb70l.cloudfront.net/6a3b4da249de39a7622ff70c_1782271760257_ee717744.png',
  fashion: 'https://d64gsuwffb70l.cloudfront.net/6a3b4da249de39a7622ff70c_1782271784260_a0fab83a.jpg',
  market: 'https://d64gsuwffb70l.cloudfront.net/6a3b4da249de39a7622ff70c_1782271802291_4fc306f4.jpg',
  aurus: 'https://images.unsplash.com/photo-1692992193981-d3d92fabd9cb?auto=format&fit=crop&w=1920&q=80',
};

const r = (min: number, max: number): number => Math.round(Math.random() * (max - min) + min);

function build(theme: ThemeKey, imgs: string[], names: string[], cats: string[], basePrice: number): Product[] {
  return names.map((name, i) => {
    const price = Math.round(basePrice + i * (basePrice / 4) + r(-50, 50));
    return {
      id: `${theme}-${i + 1}`,
      theme,
      name,
      category: cats[i % cats.length],
      price,
      mrp: Math.round(price * 1.4),
      image: imgs[i % imgs.length],
      badge: i % 3 === 0 ? 'Bestseller' : i % 3 === 1 ? 'New' : undefined,
      rating: +(4 + Math.random()).toFixed(1),
      reviews: r(24, 980),
      desc: `${name} — crafted with care and built to be loved every day.`,
    };
  });
}

export const PRODUCTS: Record<ThemeKey, Product[]> = {
  craft: build('craft', craftImgs,
    ['Peacock Brass Diya', 'Handpainted Wall Plate', 'Royal Tea Light Holder', 'Ganesha Idol Set', 'Antique Urli Bowl', 'Carved Wooden Elephant', 'Festive Pooja Thali', 'Meenakari Showpiece'],
    ['Home Decor', 'Pooja & Spiritual', 'Gifting', 'Wall Art'], 899),
  jewel: build('jewel', jewelImgs,
    ['Solitaire Promise Ring', 'Rose Gold Pendant', 'Diamond Stud Earrings', 'Eternity Band', 'Pearl Drop Necklace', 'Classic Tennis Bracelet', 'Halo Engagement Ring', 'Minimalist Gold Chain'],
    ['Rings', 'Earrings', 'Necklaces', 'Bracelets'], 18999),
  fashion: build('fashion', fashionImgs,
    ['Mulmul Cotton Saree', 'Handloom Linen Drape', 'Block Print Kurta', 'Ikat Cotton Saree', 'Pastel Organza Saree', 'Everyday Comfort Blouse', 'Chanderi Silk Saree', 'Indigo Wrap Dress'],
    ['Sarees', 'Kurtas', 'Blouses', 'Dresses'], 2499),
  market: build('market', marketImgs,
    ['Wireless Earbuds Pro', 'Smart Fitness Band', 'Ceramic Cookware Set', 'Cotton Bedsheet Combo', 'Bluetooth Speaker', 'Stainless Bottle', 'LED Desk Lamp', 'Backpack 30L'],
    ['Electronics', 'Home', 'Fashion', 'Kitchen'], 799),
  aurus: aurusProducts,
};

export const CATEGORIES: Record<ThemeKey, { name: string; img: string }[]> = {
  craft: [
    { name: 'Home Decor', img: craftImgs[0] },
    { name: 'Pooja & Spiritual', img: craftImgs[1] },
    { name: 'Gifting', img: craftImgs[2] },
    { name: 'Wall Art', img: craftImgs[3] },
  ],
  jewel: [
    { name: 'Rings', img: jewelImgs[0] },
    { name: 'Earrings', img: jewelImgs[1] },
    { name: 'Necklaces', img: jewelImgs[2] },
    { name: 'Bracelets', img: jewelImgs[3] },
  ],
  fashion: [
    { name: 'Sarees', img: fashionImgs[0] },
    { name: 'Kurtas', img: fashionImgs[1] },
    { name: 'Blouses', img: fashionImgs[2] },
    { name: 'Dresses', img: fashionImgs[3] },
  ],
  market: [
    { name: 'Electronics', img: marketImgs[0] },
    { name: 'Home', img: marketImgs[1] },
    { name: 'Fashion', img: marketImgs[2] },
    { name: 'Kitchen', img: marketImgs[3] },
  ],
  aurus: [
    { name: 'Rings', img: aurusImgs[0] },
    { name: 'Earrings', img: aurusImgs[1] },
    { name: 'Necklaces', img: aurusImgs[2] },
    { name: 'Bracelets', img: aurusImgs[3] },
    { name: 'Pendants', img: aurusImgs[0] },
    { name: 'Bangles', img: aurusImgs[1] },
  ],
};

export const THEME_META: Record<ThemeKey, { label: string; brand: string; tagline: string }> = {
  craft: { label: 'Handicrafts', brand: 'KalaKriti', tagline: 'Crafted Culture, Delivered with Soul' },
  jewel: { label: 'Jewellery', brand: 'Lumiere', tagline: 'Moments That Sparkle Forever' },
  fashion: { label: 'Fashion', brand: 'Saanjh', tagline: 'Woven Stories, Worn with Pride' },
  market: { label: 'Marketplace', brand: 'BazaarOne', tagline: 'Everything You Love, One Place' },
  aurus: { label: 'CaratLane Style', brand: 'Aurus', tagline: 'Certified Fine Jewellery — Transparent, Beautiful, Yours' },
};
