import React from 'react';
import AurusListing from '@/themes/AurusListing';
import { AppProvider } from '@/contexts/AppContext';

const ListingPage: React.FC = () => (
  <AppProvider>
    <AurusListing />
  </AppProvider>
);

export default ListingPage;
