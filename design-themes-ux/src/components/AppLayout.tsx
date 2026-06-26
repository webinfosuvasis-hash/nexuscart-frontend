import React from 'react';
import { useStore } from '@/context/StoreContext';
// import ThemeSwitcher from '@/components/ThemeSwitcher';
import CraftHome from '@/themes/CraftHome';
import JewelHome from '@/themes/JewelHome';
import FashionHome from '@/themes/FashionHome';
import MarketHome from '@/themes/MarketHome';
import AurusHome from '@/themes/AurusHome';

const AppLayout: React.FC = () => {
  const { theme } = useStore();

  return (
    <div>
      {theme === 'craft' && <CraftHome />}
      {theme === 'jewel' && <JewelHome />}
      {theme === 'fashion' && <FashionHome />}
      {theme === 'market' && <MarketHome />}
      {theme === 'aurus' && <AurusHome />}
      {/* <ThemeSwitcher /> */}
    </div>
  );
};

export default AppLayout;
