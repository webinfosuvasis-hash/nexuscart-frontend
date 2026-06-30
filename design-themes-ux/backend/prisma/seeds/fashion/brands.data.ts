import { img, slugify } from './constants';

export interface BrandSeed {
  name: string;
  slug: string;
  description: string;
  logo: string;
  bannerImage: string;
  websiteUrl: string;
  metaTitle: string;
  metaDescription: string;
  isFeatured: boolean;
  sortOrder: number;
}

const RAW_BRANDS: Array<Omit<BrandSeed, 'slug' | 'logo' | 'bannerImage' | 'metaTitle' | 'metaDescription'>> = [
  { name: 'Aurus',        description: 'Contemporary Indian ethnic wear blending handloom textiles with modern silhouettes.', websiteUrl: 'https://aurus.example.com',        isFeatured: true,  sortOrder: 1 },
  { name: 'Shaya',        description: 'Festive and bridal couture known for intricate zari and thread embroidery.',          websiteUrl: 'https://shaya.example.com',        isFeatured: true,  sortOrder: 2 },
  { name: 'Libas',        description: 'Everyday ethnic wear — kurtis, co-ords and suits designed for comfort and colour.',    websiteUrl: 'https://libas.example.com',        isFeatured: true,  sortOrder: 3 },
  { name: 'Biba',         description: 'India\'s go-to label for printed kurtis, dresses and fusion wear.',                    websiteUrl: 'https://biba.example.com',         isFeatured: true,  sortOrder: 4 },
  { name: 'Indya',        description: 'Modern fusion fashion reinterpreting traditional silhouettes for the new-age woman.',  websiteUrl: 'https://indya.example.com',        isFeatured: false, sortOrder: 5 },
  { name: 'Aurelia',      description: 'Pastel-toned, lightweight kurtas and dresses for everyday office and casual wear.',    websiteUrl: 'https://aurelia.example.com',      isFeatured: false, sortOrder: 6 },
  { name: 'Suta',         description: 'Handwoven cotton and tussar sarees celebrating Bengal\'s weaving heritage.',           websiteUrl: 'https://suta.example.com',         isFeatured: true,  sortOrder: 7 },
  { name: 'Anaya',        description: 'Luxury silk sarees and lehengas crafted for weddings and festive occasions.',          websiteUrl: 'https://anaya.example.com',        isFeatured: false, sortOrder: 8 },
  { name: 'W for Woman',  description: 'Structured, minimal ethnic wear for the working Indian woman.',                       websiteUrl: 'https://wforwoman.example.com',    isFeatured: false, sortOrder: 9 },
  { name: 'Vastra',       description: 'Pure handloom sarees and dupattas sourced directly from weaver clusters.',             websiteUrl: 'https://vastra.example.com',       isFeatured: false, sortOrder: 10 },
];

export const BRANDS: BrandSeed[] = RAW_BRANDS.map((b, i) => {
  const slug = slugify(b.name);
  return {
    ...b,
    slug,
    logo: img(i, 200, 200),
    bannerImage: img(i + 10, 1600, 500),
    metaTitle: `${b.name} — Shop ${b.name} Sarees, Kurtis & Ethnic Wear Online`,
    metaDescription: `${b.description} Shop the latest ${b.name} collection online with free shipping and easy returns.`,
  };
});
