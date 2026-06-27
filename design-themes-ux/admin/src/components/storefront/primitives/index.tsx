/**
 * Layout Primitives — Sprint 8
 *
 * Six generic layout components driven entirely by settings via resolveStyle.
 * They render in the editor canvas (SimulatedCanvas) and will be registered
 * in PRIMITIVE_REGISTRY in Sprint 11 with zero changes — the same components,
 * same settings keys, same CSS output.
 *
 * Block children render inside these primitives in Sprint 11 (NodeRenderer).
 * For now they show a styled container + a visual label in the editor.
 */

import React from 'react';
import { useEditor }    from '@/admin/editor/EditorContext';
import { resolveStyle } from '@/admin/editor/styleResolver';
import type { SectionDoc } from '@/admin/editor/types';

export interface PrimitiveProps {
  section: SectionDoc;
}

// ─── Canvas placeholder (shown inside primitives in the editor) ───────────────

const PrimitivePlaceholder: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <div
    className="flex items-center justify-center py-6"
    style={{
      borderRadius: 6,
      border: `1.5px dashed ${color}40`,
      background: `${color}08`,
      minHeight: 48,
    }}
  >
    <span style={{ fontSize: 11, fontWeight: 600, color: `${color}80`, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      {label}
    </span>
  </div>
);

// ─── Container ────────────────────────────────────────────────────────────────

export const ContainerPrimitive: React.FC<PrimitiveProps> = ({ section }) => {
  const { state } = useEditor();
  const style = resolveStyle(section.settings, state.previewMode);
  return (
    <div style={{ display: 'block', ...style }}>
      {section.blocks.length === 0
        ? <PrimitivePlaceholder label="Container" color="#38BDF8" />
        : null /* block children: Sprint 11 */
      }
    </div>
  );
};

// ─── Stack ────────────────────────────────────────────────────────────────────

export const StackPrimitive: React.FC<PrimitiveProps> = ({ section }) => {
  const { state } = useEditor();
  const base = resolveStyle(section.settings, state.previewMode);
  const style: React.CSSProperties = {
    display:       'flex',
    flexDirection: (section.settings.flexDir as any) ?? 'column',
    gap:           section.settings.gap !== undefined ? `${section.settings.gap}px` : '16px',
    alignItems:    (section.settings.align as any) ?? 'stretch',
    ...base,
  };
  return (
    <div style={style}>
      {section.blocks.length === 0
        ? <PrimitivePlaceholder label="Stack" color="#38BDF8" />
        : null
      }
    </div>
  );
};

// ─── Grid ─────────────────────────────────────────────────────────────────────

export const GridPrimitive: React.FC<PrimitiveProps> = ({ section }) => {
  const { state } = useEditor();
  const base = resolveStyle(section.settings, state.previewMode);
  const cols = section.settings.gridCols as number ?? 3;
  const style: React.CSSProperties = {
    display:             'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap:                 section.settings.gap !== undefined ? `${section.settings.gap}px` : '24px',
    ...base,
  };
  return (
    <div style={style}>
      {section.blocks.length === 0
        ? Array.from({ length: cols }).map((_, i) => (
            <PrimitivePlaceholder key={i} label={`Col ${i + 1}`} color="#38BDF8" />
          ))
        : null
      }
    </div>
  );
};

// ─── Columns ──────────────────────────────────────────────────────────────────

export const ColumnsPrimitive: React.FC<PrimitiveProps> = ({ section }) => {
  const { state } = useEditor();
  const base      = resolveStyle(section.settings, state.previewMode);
  const ratioStr  = String(section.settings.ratios ?? '1,1');
  const parts     = ratioStr.split(',').map((n) => n.trim());
  const fractions = parts.map((n) => `${n}fr`).join(' ');
  const stackOn   = (section.settings.stackOn as string) ?? 'mobile';
  const isMobile  = state.previewMode === 'mobile';
  const isTablet  = state.previewMode === 'tablet';
  const shouldStack = stackOn === 'never' ? false : stackOn === 'tablet' ? (isMobile || isTablet) : isMobile;
  const style: React.CSSProperties = {
    display:             'grid',
    gridTemplateColumns: shouldStack ? '1fr' : fractions,
    gap:                 section.settings.gap !== undefined ? `${section.settings.gap}px` : '24px',
    ...base,
  };
  return (
    <div style={style}>
      {section.blocks.length === 0
        ? parts.map((r, i) => (
            <PrimitivePlaceholder key={i} label={`Col (${r}fr)`} color="#38BDF8" />
          ))
        : null
      }
    </div>
  );
};

// ─── Spacer ───────────────────────────────────────────────────────────────────

export const SpacerPrimitive: React.FC<PrimitiveProps> = ({ section }) => {
  const { state } = useEditor();
  const h = section.settings.h as number ?? 48;
  // Show dashed line in editor so merchant can see/select the spacer
  return (
    <div
      style={{ width: '100%', height: h, position: 'relative', flexShrink: 0 }}
      title={`Spacer ${h}px`}
    >
      {state.selection.sectionId === section.id && (
        <div style={{
          position: 'absolute', inset: 0,
          border: '1px dashed rgba(56,189,248,0.4)',
          borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 10, color: 'rgba(56,189,248,0.6)', fontWeight: 600 }}>{h}px</span>
        </div>
      )}
    </div>
  );
};

// ─── Divider ─────────────────────────────────────────────────────────────────

export const DividerPrimitive: React.FC<PrimitiveProps> = ({ section }) => {
  const s  = section.settings;
  const mt = (s.mt as number) ?? 16;
  const mb = (s.mb as number) ?? 16;
  const bw = (s.bw as number) ?? 1;
  const bs = (s.bs as string) ?? 'solid';
  const bc = (s.bc as string) ?? '#e5e7eb';
  const op = s.opacity !== undefined ? Number(s.opacity) / 100 : 1;
  return (
    <div style={{ paddingTop: mt, paddingBottom: mb }}>
      <hr style={{ border: 'none', borderTop: `${bw}px ${bs} ${bc}`, opacity: op, margin: 0 }} />
    </div>
  );
};
