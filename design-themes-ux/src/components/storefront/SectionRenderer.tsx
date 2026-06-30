/**
 * SectionRenderer — registry-driven section renderer.
 *
 * Architecture compliance:
 *   - NO switch statement on sectionType
 *   - Receives the SectionRegistry from the active theme
 *   - Looks up the entry, receives already-validated config + resolved data
 *   - Renders the pure component; never performs API calls
 *   - Silently skips unknown section types (null return, no crash)
 *
 * This component is intentionally generic. It knows nothing about Aurus,
 * Classic, Luxury, or any other theme — those are in the registries.
 */

import React from 'react';
import type { SectionRegistry } from '@/themes/registry/SectionRegistry';
import type { Viewport } from '@/themes/registry/types';

interface SectionRendererProps {
  /** sectionType string from the Page Builder API */
  sectionType:  string;
  /** Validated, merged config (pipeline already applied by the caller) */
  config:       Record<string, unknown>;
  /** Resolved external data (products, categories, etc.) */
  data:         Record<string, unknown>;
  /** The active theme's section registry */
  registry:     SectionRegistry;
  /** true = admin editor preview mode */
  isPreview?:   boolean;
  /** true = resolver is still fetching data */
  isLoading?:   boolean;
  /** Current viewport for responsive preview */
  viewport?:    Viewport;
}

const SectionRenderer: React.FC<SectionRendererProps> = ({
  sectionType,
  config,
  data,
  registry,
  isPreview  = false,
  isLoading  = false,
}) => {
  // 1. Look up the registered entry for this section type
  const entry = registry.get(sectionType);

  // 2. Unknown section type → silent skip (no crash, no warning to customer)
  if (!entry) {
    if (import.meta.env.DEV) {
      console.warn(
        `[SectionRenderer] sectionType "${sectionType}" is not registered in the active theme's registry. ` +
        'This section will not render. Register it to display it.',
      );
    }
    return null;
  }

  // 3. Render the pure section component
  //    config and data have already been parsed, merged, and validated by the
  //    orchestrator (AurusHomeV2) before reaching this renderer.
  const Component = entry.component;

  return (
    <Component
      config={config as any}
      data={data as any}
      isPreview={isPreview}
      isLoading={isLoading}
    />
  );
};

export default SectionRenderer;
