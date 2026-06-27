/**
 * CategoryIconsEditor — Category Icon Strip (Section 5)
 *
 * Horizontal scrollable row of circular category icons with labels.
 * Appears between the Campaign Grid and Trust Badges on the Aurus homepage.
 */

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SectionEditor } from '../framework/SectionEditor';
import {
  Label, Hint, FieldGroup, SectionDivider, TextInput, ColorInput, ImageField,
} from '../framework/FormFields';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IconEntry {
  id: string;
  image: string;
  label: string;
  linkUrl: string;
}

export interface CategoryIconsConfig {
  icons: IconEntry[];
  borderColor: string;
  hoverBorderColor: string;
  backgroundColor: string;
}

const DEFAULT_ICONS: IconEntry[] = [
  { id: '1', image: '', label: 'Wedding Rings',      linkUrl: '/jewellery/wedding'    },
  { id: '2', image: '', label: 'Solitaire Pendants', linkUrl: '/jewellery/solitaire'  },
  { id: '3', image: '', label: 'Bestselling Styles', linkUrl: '/jewellery/bestsellers'},
  { id: '4', image: '', label: 'New Styles For You', linkUrl: '/jewellery/new'        },
  { id: '5', image: '', label: 'Daily Wear Drops',   linkUrl: '/jewellery/daily'      },
  { id: '6', image: '', label: 'Gold Rings',         linkUrl: '/jewellery/gold-rings' },
  { id: '7', image: '', label: 'Diamond Earrings',   linkUrl: '/jewellery/diamond'    },
  { id: '8', image: '', label: 'Mangalsutra',        linkUrl: '/jewellery/mangalsutra'},
];

const DEFAULT: CategoryIconsConfig = {
  icons: DEFAULT_ICONS,
  borderColor:      '#E5E7EB',
  hoverBorderColor: '#7C3AED',
  backgroundColor:  '#F9FAFB',
};

function parse(raw: unknown): CategoryIconsConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT;
  const r = raw as Partial<CategoryIconsConfig>;
  return { ...DEFAULT, ...r, icons: Array.isArray(r.icons) && r.icons.length ? r.icons : DEFAULT.icons };
}

function newIcon(): IconEntry {
  return { id: `icon-${Date.now()}`, image: '', label: 'New Category', linkUrl: '/' };
}

// ─── Preview ──────────────────────────────────────────────────────────────────

const Preview: React.FC<{ config: CategoryIconsConfig }> = ({ config }) => (
  <div className="py-4 bg-white rounded-xl border border-slate-100">
    <div className="flex gap-5 overflow-hidden justify-center px-4">
      {config.icons.slice(0, 6).map(icon => (
        <div key={icon.id} className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <div className="w-12 h-12 rounded-full border-2 overflow-hidden"
            style={{ borderColor: config.borderColor, background: config.backgroundColor }}>
            {icon.image
              ? <img src={icon.image} alt={icon.label} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-purple-50" />
            }
          </div>
          <p className="text-[9px] text-slate-600 font-medium text-center leading-tight max-w-[52px]">{icon.label}</p>
        </div>
      ))}
    </div>
  </div>
);

// ─── Icon row ─────────────────────────────────────────────────────────────────

const IconRow: React.FC<{
  icon: IconEntry;
  onChange: (v: IconEntry) => void;
  onDelete: () => void;
}> = ({ icon, onChange, onDelete }) => (
  <div className="flex gap-3 items-start border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-900">
    <div className="w-14 flex-shrink-0">
      <ImageField value={icon.image} onChange={image => onChange({ ...icon, image })} aspectClass="aspect-square" label="Icon" hint="Circular" />
    </div>
    <div className="flex-1 space-y-1.5">
      <TextInput value={icon.label} onChange={label => onChange({ ...icon, label })} placeholder="Category name" />
      <TextInput value={icon.linkUrl} onChange={linkUrl => onChange({ ...icon, linkUrl })} placeholder="/jewellery/rings" />
    </div>
    <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-500 flex-shrink-0 transition-colors"><Trash2 size={13} /></button>
  </div>
);

// ─── Content form ─────────────────────────────────────────────────────────────

const ContentTab: React.FC<{ config: CategoryIconsConfig; onChange: (c: CategoryIconsConfig) => void }> = ({ config, onChange }) => (
  <div className="space-y-4">
    <SectionDivider label="Styling" />
    <div className="grid grid-cols-2 gap-3">
      <FieldGroup><Label>Icon border</Label><ColorInput value={config.borderColor} onChange={v => onChange({ ...config, borderColor: v })} /></FieldGroup>
      <FieldGroup><Label>Hover border</Label><ColorInput value={config.hoverBorderColor} onChange={v => onChange({ ...config, hoverBorderColor: v })} /></FieldGroup>
    </div>

    <SectionDivider label={`Icons (${config.icons.length}/12)`} />
    <Hint>Label and URL shown below each circular icon. Drag to reorder (coming in Phase 3).</Hint>
    <div className="space-y-2">
      {config.icons.map((icon, i) => (
        <IconRow
          key={icon.id}
          icon={icon}
          onChange={updated => onChange({ ...config, icons: config.icons.map((ic, idx) => idx === i ? updated : ic) })}
          onDelete={() => onChange({ ...config, icons: config.icons.filter((_, idx) => idx !== i) })}
        />
      ))}
    </div>
    {config.icons.length < 12 && (
      <button
        onClick={() => onChange({ ...config, icons: [...config.icons, newIcon()] })}
        className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
      >
        <Plus size={14} /> Add icon
      </button>
    )}
  </div>
);

// ─── Editor ───────────────────────────────────────────────────────────────────

const CategoryIconsEditor: React.FC<{ sectionId: string; onBack: () => void }> = ({ sectionId, onBack }) => (
  <SectionEditor<CategoryIconsConfig>
    sectionId={sectionId}
    sectionLabel="Category Icons"
    onBack={onBack}
    defaultConfig={DEFAULT}
    parseConfig={parse}
    renderPreview={(config) => <Preview config={config} />}
    renderContent={(config, onChange) => <ContentTab config={config} onChange={onChange} />}
  />
);

export default CategoryIconsEditor;
