import React, { useEffect } from 'react';
import type { DraftPageData } from '@/services/storefrontService';

interface Props {
  data:     DraftPageData;
  children: React.ReactNode;
}

/**
 * PreviewShell — Sprint 5
 *
 * Sets document-level metadata and body classes for the preview page.
 * Ensures the preview is not indexed by search engines.
 */
const PreviewShell: React.FC<Props> = ({ data, children }) => {
  useEffect(() => {
    // Title
    document.title = `Preview — ${data.pageTitle} — ${data.store.name}`;

    // No-index meta
    let robotsMeta = document.querySelector('meta[name="robots"]');
    if (!robotsMeta) {
      robotsMeta     = document.createElement('meta');
      (robotsMeta as HTMLMetaElement).name = 'robots';
      document.head.appendChild(robotsMeta);
    }
    (robotsMeta as HTMLMetaElement).content = 'noindex, nofollow';

    // Body class signals editor bridge that we're in preview mode
    document.body.classList.add('nx-preview-mode');

    // Apply body background from theme
    document.body.style.background = data.themeConfig.colors.background ?? '#ffffff';
    document.body.style.fontFamily = `var(--nx-font-body, 'Inter', sans-serif)`;
    document.body.style.color      = data.themeConfig.colors.text ?? '#1a1a1a';
    document.body.style.margin     = '0';

    return () => {
      document.body.classList.remove('nx-preview-mode');
      document.body.style.background = '';
      document.body.style.fontFamily = '';
      document.body.style.color      = '';
      document.body.style.margin     = '';
    };
  }, [data]);

  return <>{children}</>;
};

export default PreviewShell;
