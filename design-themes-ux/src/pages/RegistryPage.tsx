import React from 'react';
import { AppProvider } from '@/contexts/AppContext';
import { RegistryProvider } from '@/context/RegistryContext';
import AurusRegistry from '@/themes/AurusRegistry';

const RegistryPage: React.FC = () => (
  <AppProvider>
    <RegistryProvider>
      <AurusRegistry />
    </RegistryProvider>
  </AppProvider>
);

export default RegistryPage;
