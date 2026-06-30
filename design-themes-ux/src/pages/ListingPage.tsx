import React, { useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';
import AurusListing from '@/themes/AurusListing';
import { AppProvider } from '@/contexts/AppContext';

interface PageMeta { title: string; description?: string; canonical: string }

/**
 * ListingPage — thin route wrapper around the data-driven AurusListing PLP.
 *
 * Resolves whichever scope param matched (categorySlug / collectionSlug /
 * brandSlug, or the legacy `:category`), and renders dynamic SEO tags from
 * the API response (via AurusListing's onMetaChange callback) instead of
 * guessing a title from the URL slug.
 */
const ListingPage: React.FC = () => {
  const { categorySlug, collectionSlug, brandSlug, category } = useParams<{
    categorySlug?: string; collectionSlug?: string; brandSlug?: string; category?: string;
  }>();

  // Legacy /jewellery/:category route — best-effort pass-through; resolves to
  // an empty (not broken) result set if the slug no longer exists in the
  // current fashion catalog. Bare /jewellery (no param) shows all products.
  const resolvedCategorySlug = categorySlug ?? category;

  const [meta, setMeta] = useState<PageMeta>({ title: 'Shop — Aurus', canonical: '/' });
  const onMetaChange = useCallback((m: PageMeta) => setMeta(m), []);

  return (
    <AppProvider>
      <Helmet>
        <title>{meta.title}</title>
        {meta.description && <meta name="description" content={meta.description} />}
        <link rel="canonical" href={meta.canonical} />
      </Helmet>
      <AurusListing
        categorySlug={resolvedCategorySlug}
        collectionSlug={collectionSlug}
        brandSlug={brandSlug}
        onMetaChange={onMetaChange}
      />
    </AppProvider>
  );
};

export default ListingPage;
