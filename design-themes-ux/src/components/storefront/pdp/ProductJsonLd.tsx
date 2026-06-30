import React from 'react';
import { Helmet } from 'react-helmet-async';
import type { ProductDetailResponse } from '@/lib/storefrontApi';
import { absoluteUrl } from '@/lib/seo';

interface ProductJsonLdProps {
  product: ProductDetailResponse;
}

/** schema.org Product + BreadcrumbList structured data, built from the same data already fetched for the PDP (no new fields). */
const ProductJsonLd: React.FC<ProductJsonLdProps> = ({ product }) => {
  const productJson = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.images,
    description: product.shortDescription || product.description || product.name,
    sku: product.sku,
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand.name } } : {}),
    offers: {
      '@type': 'Offer',
      url: absoluteUrl(`/products/${product.id}`),
      priceCurrency: 'INR',
      price: product.price,
      availability: product.stock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
    ...(product.reviewCount > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: product.rating,
        reviewCount: product.reviewCount,
      },
    } : {}),
  };

  const breadcrumbJson = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: product.breadcrumbs.map((bc, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: bc.label,
      item: absoluteUrl(bc.url),
    })),
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(productJson)}</script>
      <script type="application/ld+json">{JSON.stringify(breadcrumbJson)}</script>
    </Helmet>
  );
};

export default ProductJsonLd;
