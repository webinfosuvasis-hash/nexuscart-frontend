import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  Breadcrumb,
  buildBreadcrumbs, calcDiscountPercent, parseJsonArray,
} from '@/common/catalog/product-query.util';
import { StorefrontProduct, StorefrontProductsService } from './storefront-products.service';

export interface ProductVariantDto {
  id:      string;
  sku:     string;
  price:   number;
  mrp:     number;
  stock:   number;
  image?:  string;
  options: Record<string, string>;
}

export interface ProductAttributeGroup {
  slug:   string;
  name:   string;
  values: { value: string; label: string }[];
}

export interface ProductDetailResponse {
  id:               string;
  name:             string;
  slug:             string;
  sku:              string;
  description:      string | null;
  shortDescription: string | null;
  price:            number;
  mrp:              number;
  discount:         number;
  images:           string[];
  badges:           string[];
  stock:            number;
  rating:           number;
  reviewCount:      number;
  brand:            { id: string; name: string; slug: string } | null;
  category:         { id: string; name: string; slug: string } | null;
  variants:         ProductVariantDto[];
  attributes:       ProductAttributeGroup[];
  seo:              { title?: string; description?: string } | null;
  breadcrumbs:      Breadcrumb[];
  relatedProducts:  StorefrontProduct[];
  similarProducts:  StorefrontProduct[];
}

/**
 * StorefrontProductDetailService — public, read-only single-product detail
 * for the Product Detail Page (Phase P2). Reuses StorefrontProductsService
 * for related/similar product *lists* (same StorefrontProduct shape as the
 * PLP) so card rendering stays consistent across listing and detail pages.
 */
@Injectable()
export class StorefrontProductDetailService {
  constructor(
    private readonly prisma:         PrismaService,
    private readonly productsService: StorefrontProductsService,
  ) {}

  async getProductDetail(storeId: string, id: string): Promise<ProductDetailResponse> {
    const product = await this.prisma.product.findFirst({
      where: { id, storeId, status: 'ACTIVE', deletedAt: null },
      include: {
        variants: true,
        brand:    { select: { id: true, name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true, parentId: true } },
        attributeValues: {
          include: { attributeValue: { include: { attribute: true } } },
        },
      },
    });
    if (!product) throw new NotFoundException(`Product not found: ${id}`);

    const images = parseJsonArray(product.images);
    const badges = parseJsonArray(product.badges ?? null);
    const { avg, count } = await this.getAverageRating(product.id);
    const discount = calcDiscountPercent(
      Number(product.price),
      product.comparePrice ? Number(product.comparePrice) : null,
    );

    const variants: ProductVariantDto[] = product.variants.map((v) => ({
      id:      v.id,
      sku:     v.sku,
      price:   Number(v.price),
      mrp:     v.comparePrice ? Number(v.comparePrice) : Number(v.price),
      stock:   v.stock,
      image:   v.image ?? undefined,
      options: this.parseOptions(v.options),
    }));

    const attributes = this.groupAttributes(product.attributeValues);

    let seo: { title?: string; description?: string } | null = null;
    if (product.seo) {
      try { seo = JSON.parse(product.seo); } catch { seo = null; }
    }

    const breadcrumbs = product.category
      ? await buildBreadcrumbs(this.prisma, product.category)
      : [{ label: 'Home', url: '/' }];
    breadcrumbs.push({ label: product.name, url: `/products/${product.id}` });

    const { relatedProducts, similarProducts } = await this.resolveRelated(storeId, product);

    return {
      id:               product.id,
      name:             product.name,
      slug:             product.slug,
      sku:              product.sku,
      description:      product.description,
      shortDescription: product.shortDescription,
      price:            Number(product.price),
      mrp:              product.comparePrice ? Number(product.comparePrice) : Number(product.price),
      discount,
      images: images.length ? images : (product.thumbnail ? [product.thumbnail] : []),
      badges,
      stock:    product.stock,
      rating:   Math.round(avg * 10) / 10,
      reviewCount: count,
      brand:    product.brand ?? null,
      category: product.category
        ? { id: product.category.id, name: product.category.name, slug: product.category.slug }
        : null,
      variants,
      attributes,
      seo,
      breadcrumbs,
      relatedProducts,
      similarProducts,
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Related = curated same-category siblings from the seeded `relatedProductIds`
   * field. Similar = a live "same category, excluding self" query, used both as
   * its own section and to top up Related when the curated list is sparse/empty
   * (e.g. a product the seed/admin never curated), so neither section is ever
   * empty for a product that has any category siblings at all.
   */
  private async resolveRelated(
    storeId: string,
    product: { id: string; relatedProductIds: string | null; category: { slug: string } | null },
  ): Promise<{ relatedProducts: StorefrontProduct[]; similarProducts: StorefrontProduct[] }> {
    const relatedIds = parseJsonArray(product.relatedProductIds).filter((rid) => rid !== product.id);

    let relatedProducts: StorefrontProduct[] = [];
    if (relatedIds.length) {
      const res = await this.productsService.getProducts(storeId, { ids: relatedIds.join(',') });
      relatedProducts = res.products;
    }

    let similarProducts: StorefrontProduct[] = [];
    if (product.category) {
      const res = await this.productsService.getProducts(storeId, {
        categorySlug: product.category.slug,
        sortBy: 'featured',
        limit: 9,
      });
      similarProducts = res.products.filter((p) => p.id !== product.id).slice(0, 8);
    }

    if (relatedProducts.length < 4) {
      const existingIds = new Set([product.id, ...relatedProducts.map((p) => p.id)]);
      const topUp = similarProducts.filter((p) => !existingIds.has(p.id)).slice(0, 4 - relatedProducts.length);
      relatedProducts = [...relatedProducts, ...topUp];
    }

    return { relatedProducts, similarProducts };
  }

  private async getAverageRating(productId: string): Promise<{ avg: number; count: number }> {
    const agg = await this.prisma.productReview.aggregate({
      where: { productId, isVisible: true },
      _avg:   { rating: true },
      _count: { _all: true },
    });
    return { avg: agg._avg.rating ?? 0, count: agg._count._all };
  }

  private parseOptions(optionsJson: string | null): Record<string, string> {
    if (!optionsJson?.trim()) return {};
    try {
      const parsed = JSON.parse(optionsJson);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }

  private groupAttributes(
    attributeValues: Array<{
      attributeValue: {
        value: string; label: string;
        attribute: { slug: string; name: string; sortOrder: number; isVisible: boolean };
      };
    }>,
  ): ProductAttributeGroup[] {
    const byAttribute = new Map<string, ProductAttributeGroup & { sortOrder: number }>();
    for (const av of attributeValues) {
      const { attribute, value, label } = av.attributeValue;
      if (!attribute.isVisible) continue;
      const existing = byAttribute.get(attribute.slug);
      if (existing) {
        existing.values.push({ value, label });
      } else {
        byAttribute.set(attribute.slug, {
          slug: attribute.slug, name: attribute.name, sortOrder: attribute.sortOrder,
          values: [{ value, label }],
        });
      }
    }
    return Array.from(byAttribute.values())
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ slug, name, values }) => ({ slug, name, values }));
  }
}
