import React from 'react';
import { useStore } from '@/context/StoreContext';
// import ThemeSwitcher from '@/components/ThemeSwitcher';
import CraftHome   from '@/themes/CraftHome';
import JewelHome   from '@/themes/JewelHome';
import FashionHome from '@/themes/FashionHome';
import MarketHome  from '@/themes/MarketHome';
import AurusHome   from '@/themes/AurusHome';

/**
 * Phase S1A — Data-driven homepage feature flag.
 *
 * VITE_DATA_DRIVEN_HOME=false (default) → AurusHome V1 (hardcoded, unchanged)
 * VITE_DATA_DRIVEN_HOME=true  (dev)     → AurusHomeV2 (Page Builder API-driven)
 *
 * Default is false: customers always see V1 until Phase S1C is complete.
 * Set to true in .env.development.local to test the data-driven implementation.
 *
 * Lazy-loaded so V2's dependencies don't increase the initial bundle when disabled.
 */
const DATA_DRIVEN_HOME = import.meta.env.VITE_DATA_DRIVEN_HOME === 'true';

const AurusHomeV2 = DATA_DRIVEN_HOME
  ? React.lazy(() => import('@/themes/AurusHomeV2'))
  : null;

/**
 * Minimal blank loading state shown while the AurusHomeV2 chunk loads.
 * Matches the page background so there is no flash. AurusHomeV2 then
 * renders the HeroSkeleton for its own API-loading state.
 * V1 (AurusHome) is NEVER rendered in the V2 path — single-render guaranteed.
 */
const V2LoadingShell: React.FC = () => (
  <div className="min-h-screen bg-white" aria-busy="true" aria-label="Loading…" />
);

const AurusRenderer: React.FC = () => {
  if (DATA_DRIVEN_HOME && AurusHomeV2) {
    return (
      <React.Suspense fallback={<V2LoadingShell />}>
        <AurusHomeV2 />
      </React.Suspense>
    );
  }
  return <AurusHome />;
};

const AppLayout: React.FC = () => {
  const { theme } = useStore();

  return (
    <div>
      {theme === 'craft'   && <CraftHome />}
      {theme === 'jewel'   && <JewelHome />}
      {theme === 'fashion' && <FashionHome />}
      {theme === 'market'  && <MarketHome />}
      {theme === 'aurus'   && <AurusRenderer />}
      {/* <ThemeSwitcher /> */}
    </div>
  );
};

export default AppLayout;
