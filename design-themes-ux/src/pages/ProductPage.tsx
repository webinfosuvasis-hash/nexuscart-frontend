import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';
import { PRODUCTS, ThemeKey } from '@/data/products';
import { useStore } from '@/context/StoreContext';
// import ThemeSwitcher from '@/components/ThemeSwitcher';
import CraftProduct from '@/themes/CraftProduct';
import JewelProduct from '@/themes/JewelProduct';
import FashionProduct from '@/themes/FashionProduct';
import MarketProduct from '@/themes/MarketProduct';
import AurusProduct from '@/themes/AurusProduct';
import AurusProductDetail from '@/themes/AurusProductDetail';
import { AppProvider } from '@/contexts/AppContext';

interface PageMeta { title: string; description?: string; canonical: string; image?: string }

/**
 * ProductPage — resolves `:id` against the legacy static demo catalog
 * (`src/data/products.ts`, ids like "aurus-1") first, preserving the
 * existing multi-theme (craft/jewel/fashion/market/aurus) demo switcher
 * unchanged. Any id that isn't a static demo id is treated as a real
 * catalog product (cuid) and rendered via the data-driven AurusProductDetail
 * (Phase P2) — every live product-card link app-wide already points here.
 */
const ProductPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { theme, setTheme } = useStore();

  const all = Object.values(PRODUCTS).flat();
  const staticProduct = all.find(p => p.id === id);

  // Sync theme to the product's brand universe without mutating during render
  useEffect(() => {
    if (staticProduct && staticProduct.theme !== theme) {
      setTheme(staticProduct.theme as ThemeKey);
    }
  }, [staticProduct?.theme]);

  const [meta, setMeta] = useState<PageMeta>({ title: 'Aurus', canonical: '/' });
  const onMetaChange = useCallback((m: PageMeta) => setMeta(m), []);

  if (staticProduct) {
    return (
      <div>
        <Helmet>
          <title>{staticProduct.name} | Aurus Fine Jewellery</title>
          <meta name="description" content={staticProduct.desc} />
        </Helmet>
        {staticProduct.theme === 'craft' && <CraftProduct product={staticProduct} />}
        {staticProduct.theme === 'jewel' && <JewelProduct product={staticProduct} />}
        {staticProduct.theme === 'fashion' && <FashionProduct product={staticProduct} />}
        {staticProduct.theme === 'market' && <MarketProduct product={staticProduct} />}
        {staticProduct.theme === 'aurus' && <AurusProduct product={staticProduct} />}
        {/* <ThemeSwitcher /> */}
      </div>
    );
  }

  if (!id) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center px-4">
        <h1 className="text-3xl font-bold mb-2">Product not found</h1>
      </div>
    );
  }

  return (
    <AppProvider>
      <Helmet>
        <title>{meta.title}</title>
        {meta.description && <meta name="description" content={meta.description} />}
        <link rel="canonical" href={meta.canonical} />

        {/* Per-product Open Graph — overrides the site-wide defaults declared in App.tsx */}
        <meta property="og:type" content="product" />
        <meta property="og:title" content={meta.title} />
        {meta.description && <meta property="og:description" content={meta.description} />}
        <meta property="og:url" content={meta.canonical} />
        {meta.image && <meta property="og:image" content={meta.image} />}

        {/* Per-product Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={meta.title} />
        {meta.description && <meta name="twitter:description" content={meta.description} />}
        {meta.image && <meta name="twitter:image" content={meta.image} />}
      </Helmet>
      <AurusProductDetail id={id} onMetaChange={onMetaChange} />
    </AppProvider>
  );
};

export default ProductPage;
