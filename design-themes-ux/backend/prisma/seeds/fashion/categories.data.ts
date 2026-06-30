import { img, slugify } from './constants';

export interface CategorySeed {
  name: string;
  slug: string;
  description: string;
  image: string;
  bannerImage: string;
  metaTitle: string;
  metaDescription: string;
  sortOrder: number;
  isFeatured: boolean;
  showOnHomepage: boolean;
}

/**
 * Subcategories created under the store's existing root "Women" category.
 * The parent category already exists in the DB — categories.seed looks it
 * up by name at runtime rather than assuming an id.
 */
const RAW_SUBCATEGORIES: Array<Pick<CategorySeed, 'name' | 'description'>> = [
  { name: 'Sarees',            description: 'Timeless Indian sarees in silk, cotton and georgette — handpicked for everyday elegance and grand occasions.' },
  { name: 'Kurtis',            description: 'Comfortable, stylish kurtis for daily wear, office and weekend outings.' },
  { name: 'Lehengas',          description: 'Festive and bridal lehenga cholis with intricate embroidery and rich fabrics.' },
  { name: 'Shirts',            description: 'Smart-casual women\'s shirts and tops for the modern wardrobe.' },
  { name: 'Dupattas',          description: 'Hand-block printed and embellished dupattas to complete every ethnic look.' },
  { name: 'Blouses',           description: 'Ready-made and designer saree blouses in a range of necklines and fabrics.' },
  { name: 'Co-ord Sets',       description: 'Matching ethnic co-ord sets for an effortlessly put-together look.' },
  { name: 'Ethnic Dresses',    description: 'Fusion ethnic dresses that blend traditional prints with contemporary cuts.' },
  { name: 'Office Wear',       description: 'Polished, comfortable ethnic and fusion wear for the workplace.' },
  { name: 'Casual Wear',       description: 'Easy, everyday fashion for running errands or lounging at home.' },
  { name: 'Cotton Collection', description: 'Breathable pure cotton pieces designed for Indian weather.' },
  { name: 'Silk Collection',   description: 'Luxurious silk sarees and suits for weddings and festive celebrations.' },
  { name: 'Wedding Collection',description: 'Curated bridal and wedding-guest fashion for every ceremony.' },
  { name: 'Party Wear',        description: 'Statement pieces with sequins, sheen and bold colour for evening events.' },
  { name: 'Summer Collection', description: 'Lightweight, breathable fabrics designed to beat the Indian summer heat.' },
];

export const SUBCATEGORIES: CategorySeed[] = RAW_SUBCATEGORIES.map((c, i) => {
  const slug = slugify(c.name);
  return {
    ...c,
    slug,
    image: img(i + 20, 400, 400),
    bannerImage: img(i + 35, 1600, 500),
    metaTitle: `${c.name} Online — Shop Latest ${c.name} for Women | NexusCart`,
    metaDescription: `${c.description} Free shipping, easy returns, and COD available.`,
    sortOrder: i + 1,
    isFeatured: i < 6,
    showOnHomepage: i < 10,
  };
});
