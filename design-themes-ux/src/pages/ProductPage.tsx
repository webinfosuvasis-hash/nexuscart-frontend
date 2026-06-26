import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { PRODUCTS, ThemeKey } from '@/data/products';
import { useStore } from '@/context/StoreContext';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import CraftProduct from '@/themes/CraftProduct';
import JewelProduct from '@/themes/JewelProduct';
import FashionProduct from '@/themes/FashionProduct';
import MarketProduct from '@/themes/MarketProduct';
import AurusProduct from '@/themes/AurusProduct';

const ProductPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { theme, setTheme } = useStore();

  // Find product across all themes by id
  const all = Object.values(PRODUCTS).flat();
  const product = all.find(p => p.id === id);

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center px-4">
        <h1 className="text-3xl font-bold mb-2">Product not found</h1>
        <p className="text-gray-500 mb-6">We couldn't find what you were looking for.</p>
        <Link to="/" className="bg-gray-900 text-white px-6 py-3 rounded-lg">Back to Store</Link>
      </div>
    );
  }

  // Ensure the active theme matches the product's brand universe
  if (product.theme !== theme) {
    setTheme(product.theme as ThemeKey);
  }

  return (
    <div>
      {product.theme === 'craft' && <CraftProduct product={product} />}
      {product.theme === 'jewel' && <JewelProduct product={product} />}
      {product.theme === 'fashion' && <FashionProduct product={product} />}
      {product.theme === 'market' && <MarketProduct product={product} />}
      {product.theme === 'aurus' && <AurusProduct product={product} />}
      <ThemeSwitcher />
    </div>
  );
};

export default ProductPage;
