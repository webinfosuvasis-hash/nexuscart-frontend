import React, { useRef } from 'react';
import { useEditor } from './EditorContext';
import SimulatedCanvas from './canvas/SimulatedCanvas';
import { Monitor, Tablet, Smartphone } from 'lucide-react';

const CANVAS_WIDTHS: Record<string, string> = {
  desktop: '100%',
  tablet:  '768px',
  mobile:  '390px',
};

const BREAKPOINT_LABELS: Record<string, string> = {
  desktop: 'Desktop — 1440px',
  tablet:  'Tablet — 768px',
  mobile:  'Mobile — 390px',
};

const CanvasPanel: React.FC = () => {
  const { state, deselect } = useEditor();
  const { previewMode } = state;
  const containerRef = useRef<HTMLDivElement>(null);

  const width = CANVAS_WIDTHS[previewMode] ?? '100%';
  const isConstrained = previewMode !== 'desktop';

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col items-center overflow-y-auto relative"
      style={{ minWidth: 0, background: 'var(--nx-void)' }}
      onClick={(e) => { if (e.target === e.currentTarget) deselect(); }}
    >
      {/* Breakpoint label pill — floats above canvas */}
      {isConstrained && (
        <div
          className="sticky top-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full self-center mt-3"
          style={{
            background: 'var(--nx-raised)',
            border: '1px solid var(--nx-border-2)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          {previewMode === 'tablet'
            ? <Tablet size={12} style={{ color: 'var(--nx-violet-400)' }} />
            : <Smartphone size={12} style={{ color: 'var(--nx-violet-400)' }} />}
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--nx-violet-400)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {BREAKPOINT_LABELS[previewMode]}
          </span>
        </div>
      )}

      {/* Device frame */}
      <div
        className="bg-white transition-all duration-300 ease-out"
        style={{
          width,
          maxWidth: width,
          minHeight: isConstrained ? 'calc(100vh - 100px)' : '100%',
          marginTop: isConstrained ? 8 : 0,
          marginBottom: isConstrained ? 32 : 0,
          borderRadius: isConstrained ? 12 : 0,
          overflow: isConstrained ? 'hidden' : 'visible',
          boxShadow: isConstrained
            ? '0 0 0 1px rgba(255,255,255,0.06), 0 16px 48px rgba(0,0,0,0.5)'
            : 'none',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) deselect();
        }}
      >
        <SimulatedCanvas />
      </div>
    </div>
  );
};

export default CanvasPanel;
