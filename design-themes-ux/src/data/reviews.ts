import { PRODUCTS, Product, ThemeKey } from '@/data/products';

export interface Review {
  name: string;
  rating: number;
  date: string;
  title: string;
  body: string;
}

const NAMES = ['Ananya R.', 'Vikram S.', 'Priya M.', 'Rohan K.', 'Sneha T.', 'Arjun P.', 'Meera D.', 'Kabir N.'];
const TITLES = ['Absolutely loved it!', 'Exceeded expectations', 'Great quality', 'Worth every rupee', 'Beautiful craftsmanship', 'Highly recommend'];
const BODIES = [
  'The quality is outstanding and it arrived beautifully packaged. Will definitely order again.',
  'Exactly as pictured. The finish and detailing are even better in person.',
  'Fast delivery and excellent customer service. Very happy with my purchase.',
  'Gifted this and the recipient was thrilled. Premium feel all around.',
  'Stunning piece — the photos don\'t do it justice. Five stars!',
  'Good value for money. Comfortable, well-made, and elegant.',
];

export function getReviews(product: Product): Review[] {
  const count = 4 + (product.name.length % 3);
  return Array.from({ length: count }).map((_, i) => ({
    name: NAMES[(i + product.name.length) % NAMES.length],
    rating: Math.min(5, 4 + ((i + product.reviews) % 2)),
    date: `${1 + ((i * 7 + product.price) % 27)} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][(i + 2) % 6]} 2026`,
    title: TITLES[(i + product.price) % TITLES.length],
    body: BODIES[(i + product.reviews) % BODIES.length],
  }));
}

export function getRelated(product: Product, theme: ThemeKey, n = 4): Product[] {
  return PRODUCTS[theme].filter(p => p.id !== product.id).slice(0, n);
}

export const VARIANTS: Record<ThemeKey, { label: string; options: string[] }> = {
  craft: { label: 'Size', options: ['Small', 'Medium', 'Large'] },
  jewel: { label: 'Ring Size', options: ['6', '7', '8', '9', '10', '12'] },
  fashion: { label: 'Size', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
  market: { label: 'Variant', options: ['Black', 'White', 'Blue'] },
  aurus: { label: 'Ring Size', options: ['6', '7', '8', '9', '10', '11', '12'] },
};
