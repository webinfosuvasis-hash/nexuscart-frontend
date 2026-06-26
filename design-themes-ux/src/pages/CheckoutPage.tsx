import React from 'react';
import { AppProvider } from '@/contexts/AppContext';
import AurusCheckout from '@/themes/AurusCheckout';

const CheckoutPage: React.FC = () => (
  <AppProvider>
    <AurusCheckout />
  </AppProvider>
);

export default CheckoutPage;
