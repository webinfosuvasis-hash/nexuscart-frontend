import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';
import AurusListing from '@/themes/AurusListing';
import { AppProvider } from '@/contexts/AppContext';

const ListingPage: React.FC = () => {
  const { category = 'jewellery' } = useParams<{ category: string }>();
  const title = category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <AppProvider>
      <Helmet>
        <title>{title} — Aurus Fine Jewellery</title>
        <meta name="description" content={`Shop ${title} at Aurus — certified fine jewellery with flat 100% off on making charges. Free shipping above ₹1,999.`} />
      </Helmet>
      <AurusListing />
    </AppProvider>
  );
};

export default ListingPage;
