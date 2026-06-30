import { PrismaClient } from '@prisma/client';
import { STORE_ID, slugify } from './constants';
import { PRODUCTS, ProductSeed } from './products.data';

const TX_OPTS = { timeout: 60_000, maxWait: 60_000 };

/**
 * Backfills the relational facet system (Attribute/AttributeValue/
 * ProductAttributeValue — Phase P1 of the Product Listing Page) from the
 * descriptive fields already present on each seeded product (fabric,
 * pattern, occasion, season, fit). This finally connects the previously
 * admin-only Attribute system to real products, and is what powers
 * dynamic, non-hardcoded facet filtering on the storefront.
 */
const ATTRIBUTE_DEFS: Array<{ name: string; slug: string; field: keyof Pick<ProductSeed, 'fabric' | 'pattern' | 'occasion' | 'season' | 'fit'> }> = [
  { name: 'Fabric',   slug: 'fabric',   field: 'fabric' },
  { name: 'Pattern',  slug: 'pattern',  field: 'pattern' },
  { name: 'Occasion', slug: 'occasion', field: 'occasion' },
  { name: 'Season',   slug: 'season',   field: 'season' },
  { name: 'Fit',      slug: 'fit',      field: 'fit' },
];

export async function seedAttributes(prisma: PrismaClient, productIdBySlug: Map<string, string>): Promise<void> {
  let valueCount = 0;
  let linkCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const [index, def] of ATTRIBUTE_DEFS.entries()) {
      const attribute = await tx.attribute.upsert({
        where: { storeId_slug: { storeId: STORE_ID, slug: def.slug } },
        create: { storeId: STORE_ID, name: def.name, slug: def.slug, type: 'DROPDOWN', isFilterable: true, isVisible: true, sortOrder: index },
        update: { name: def.name, isFilterable: true, isVisible: true, sortOrder: index },
      });

      const distinctLabels = Array.from(new Set(
        PRODUCTS.map((p) => p[def.field]).filter((v): v is string => Boolean(v) && v !== 'N/A'),
      ));

      const valueIdByLabel = new Map<string, string>();
      for (const [vi, label] of distinctLabels.entries()) {
        const value = slugify(label);
        let attrValue = await tx.attributeValue.findFirst({ where: { attributeId: attribute.id, value } });
        if (attrValue) {
          attrValue = await tx.attributeValue.update({ where: { id: attrValue.id }, data: { label, sortOrder: vi } });
        } else {
          attrValue = await tx.attributeValue.create({ data: { attributeId: attribute.id, value, label, sortOrder: vi } });
          valueCount++;
        }
        valueIdByLabel.set(label, attrValue.id);
      }

      for (const product of PRODUCTS) {
        const label = product[def.field];
        if (!label || label === 'N/A') continue;
        const productId = productIdBySlug.get(product.slug);
        const attributeValueId = valueIdByLabel.get(label);
        if (!productId || !attributeValueId) continue;

        await tx.productAttributeValue.upsert({
          where: { productId_attributeValueId: { productId, attributeValueId } },
          create: { productId, attributeValueId },
          update: {},
        });
        linkCount++;
      }
    }
  }, TX_OPTS);

  console.log(`✅ ${ATTRIBUTE_DEFS.length} facet attributes seeded (${valueCount} new values, ${linkCount} product links)`);
}
