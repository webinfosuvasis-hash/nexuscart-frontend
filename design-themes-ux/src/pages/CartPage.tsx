import React from 'react';
import { AppProvider } from '@/contexts/AppContext';
import AurusCart from '@/themes/AurusCart';

const CartPage: React.FC = () => (
  <AppProvider>
    <AurusCart />
  </AppProvider>
);

export default CartPage;
