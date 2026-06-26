
import React from 'react';
import { Helmet } from 'react-helmet-async';
import AppLayout from '@/components/AppLayout';
import { AppProvider } from '@/contexts/AppContext';

const Index: React.FC = () => {
  return (
    <AppProvider>
      <Helmet>
        <title>Aurus Fine Jewellery — Diamonds, Gold & Silver</title>
        <meta name="description" content="Discover Aurus Fine Jewellery — certified diamond rings, gold necklaces, silver jewellery and more. Flat 100% off on making charges. Free shipping above ₹1,999." />
      </Helmet>
      <AppLayout />
    </AppProvider>
  );
};

export default Index;
