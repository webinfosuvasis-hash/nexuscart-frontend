import { useEffect, useRef } from 'react';
import { buildCssVars } from './ThemeStyleInjector';

interface BoundingEntry {
  id:   string;
  type: string;
  rect: { top: number; left: number; width: number; height: number };
}

/** Allowed parent origins for postMessage (security: reject unknown origins) */
const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://localhost:3000',
  'https://admin.nexuscart.com',
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return false;
}

function collectBounds(): { sections: BoundingEntry[]; blocks: BoundingEntry[] } {
  const sections: BoundingEntry[] = [];
  const blocks:   BoundingEntry[] = [];

  document.querySelectorAll<HTMLElement>('[data-nexuscart-section]').forEach((el) => {
    const rect = el.getBoundingClientRect();
    sections.push({
      id:   el.dataset.nexuscartSection!,
      type: el.dataset.sectionType ?? '',
      rect: { top: rect.top + window.scrollY, left: rect.left, width: rect.width, height: rect.height },
    });
  });

  document.querySelectorAll<HTMLElement>('[data-nexuscart-block]').forEach((el) => {
    const rect = el.getBoundingClientRect();
    blocks.push({
      id:   el.dataset.nexuscartBlock!,
      type: el.dataset.blockType ?? '',
      rect: { top: rect.top + window.scrollY, left: rect.left, width: rect.width, height: rect.height },
    });
  });

  return { sections, blocks };
}

function send(msg: Record<string, unknown>): void {
  if (window.parent === window) return;  // not in iframe
  window.parent.postMessage({ __nexuscart: true, ...msg }, '*');
}

interface Props {
  onRefresh?: (draftToken: string) => void;
}

/**
 * PreviewEditorBridge — Sprint 5 (DORMANT)
 *
 * Implements the postMessage protocol between the storefront preview (iframe)
 * and the Theme Editor shell (parent window).
 *
 * This component is DEPLOYED in Sprint 5 but only activates when the preview
 * is loaded inside an iframe (window.parent !== window).
 * In Sprint 7-8, the Theme Editor will switch from SimulatedCanvas to an
 * iframe loading the preview URL — at that point this bridge activates
 * automatically without any code changes.
 *
 * Protocol summary (Shell → Canvas):
 *   EDITOR_INIT       → acknowledge + send CANVAS_READY
 *   EDITOR_SELECT     → scroll element into view
 *   EDITOR_HOVER      → highlight element
 *   EDITOR_REFRESH    → call onRefresh(newToken)
 *   EDITOR_CSS_UPDATE → update CSS vars without re-render (fast path)
 *   EDITOR_DESELECT   → remove highlights
 *
 * Protocol summary (Canvas → Shell):
 *   CANVAS_MOUNTED    → signals SDK is ready
 *   CANVAS_READY      → sends all bounding boxes after render
 *   CANVAS_CLICK      → user clicked a section/block
 *   CANVAS_HOVER      → user hovered a section/block
 *   CANVAS_SCROLL     → viewport-visible bounds after scroll
 *   CANVAS_RERENDERED → bounds after EDITOR_REFRESH
 */
const PreviewEditorBridge: React.FC<Props> = ({ onRefresh }) => {
  const isInIframe = window !== window.parent;
  const scrollRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isInIframe) return;

    // Signal parent that SDK is ready
    send({ type: 'CANVAS_MOUNTED', payload: { sdkVersion: '1.0.0' } });

    const handleMessage = (evt: MessageEvent) => {
      if (!evt.data?.__nexuscart) return;
      if (!isAllowedOrigin(evt.origin)) return;

      const { type, payload } = evt.data as { type: string; payload: any };

      switch (type) {
        case 'EDITOR_INIT': {
          // Send all section + block bounding boxes
          const bounds = collectBounds();
          send({ type: 'CANVAS_READY', payload: { ...bounds, pageHeight: document.body.scrollHeight } });
          break;
        }
        case 'EDITOR_SELECT': {
          const { sectionId, blockId } = payload ?? {};
          const selector = blockId
            ? `[data-nexuscart-block="${blockId}"]`
            : `[data-nexuscart-section="${sectionId}"]`;
          const el = document.querySelector<HTMLElement>(selector);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        }
        case 'EDITOR_REFRESH': {
          if (payload?.draftToken && onRefresh) {
            onRefresh(payload.draftToken);
          }
          break;
        }
        case 'EDITOR_CSS_UPDATE': {
          // Fast-path color update — replaces CSS vars without React re-render
          const style = document.getElementById('nx-theme-vars');
          if (style && payload?.themeConfig) {
            style.textContent = buildCssVars(payload.themeConfig);
          }
          break;
        }
        case 'EDITOR_DESELECT':
          // Remove any selection-related DOM classes (none in Sprint 5 — placeholder)
          break;
      }
    };

    // Intercept clicks → send to parent
    const handleClick = (evt: MouseEvent) => {
      const blockEl   = (evt.target as HTMLElement).closest('[data-nexuscart-block]') as HTMLElement | null;
      const sectionEl = (evt.target as HTMLElement).closest('[data-nexuscart-section]') as HTMLElement | null;
      if (blockEl || sectionEl) {
        evt.preventDefault();
        evt.stopPropagation();
        send({
          type:    'CANVAS_CLICK',
          payload: {
            blockId:   blockEl?.dataset.nexuscartBlock ?? null,
            sectionId: sectionEl?.dataset.nexuscartSection ?? null,
            x: evt.clientX,
            y: evt.clientY,
          },
        });
      }
    };

    // Prevent all <a> navigation and <form> submissions in preview mode
    const handleAnchorClick = (evt: MouseEvent) => {
      if ((evt.target as HTMLElement).closest('a')) evt.preventDefault();
    };
    const handleFormSubmit = (evt: SubmitEvent) => evt.preventDefault();

    // Scroll → send viewport-visible bounds (debounced 16ms)
    const handleScroll = () => {
      if (scrollRef.current) clearTimeout(scrollRef.current);
      scrollRef.current = setTimeout(() => {
        const bounds = collectBounds();
        send({ type: 'CANVAS_SCROLL', payload: { scrollY: window.scrollY, updatedBounds: bounds } });
      }, 16);
    };

    window.addEventListener('message',     handleMessage);
    document.addEventListener('click',     handleClick,    true);
    document.addEventListener('click',     handleAnchorClick, true);
    document.addEventListener('submit',    handleFormSubmit,  true);
    window.addEventListener('scroll',      handleScroll,   { passive: true });

    return () => {
      window.removeEventListener('message',  handleMessage);
      document.removeEventListener('click',  handleClick, true);
      document.removeEventListener('click',  handleAnchorClick, true);
      document.removeEventListener('submit', handleFormSubmit, true);
      window.removeEventListener('scroll',   handleScroll);
      if (scrollRef.current) clearTimeout(scrollRef.current);
    };
  }, [isInIframe, onRefresh]);

  return null;
};

export default PreviewEditorBridge;
