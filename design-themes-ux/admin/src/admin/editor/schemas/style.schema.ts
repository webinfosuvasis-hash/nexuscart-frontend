import type { SettingField } from '../types';

/**
 * STYLE_SCHEMA — drives the Style tab in the inspector.
 * Every key here maps directly to a styleResolver.ts property.
 * Key names are locked — changing them requires a content migration.
 */
export const STYLE_SCHEMA: SettingField[] = [
  // ── Background ──────────────────────────────────────────────────────────────
  {
    key: 'bg', label: 'Fill color', type: 'color',
    group: 'Background', helpText: 'Background color of this layer.',
  },
  {
    key: 'bgImage', label: 'Background image', type: 'image',
    group: 'Background',
  },
  {
    key: 'bgSize', label: 'Image size', type: 'select',
    group: 'Background',
    condition: { field: 'bgImage', operator: 'truthy' },
    options: [
      { label: 'Cover', value: 'cover' },
      { label: 'Contain', value: 'contain' },
      { label: 'Auto', value: 'auto' },
    ],
  },
  {
    key: 'bgPos', label: 'Image position', type: 'select',
    group: 'Background',
    condition: { field: 'bgImage', operator: 'truthy' },
    options: [
      { label: 'Center', value: 'center' },
      { label: 'Top', value: 'top' },
      { label: 'Bottom', value: 'bottom' },
      { label: 'Left', value: 'left' },
      { label: 'Right', value: 'right' },
    ],
  },

  // ── Typography ──────────────────────────────────────────────────────────────
  {
    key: 'color', label: 'Text color', type: 'color',
    group: 'Typography',
  },
  {
    key: 'fontSize', label: 'Font size', type: 'range',
    min: 8, max: 96, step: 1, unit: 'px',
    group: 'Typography',
  },
  {
    key: 'fontWeight', label: 'Weight', type: 'select',
    group: 'Typography',
    options: [
      { label: 'Thin 100',      value: '100' },
      { label: 'Light 300',     value: '300' },
      { label: 'Regular 400',   value: '400' },
      { label: 'Medium 500',    value: '500' },
      { label: 'Semibold 600',  value: '600' },
      { label: 'Bold 700',      value: '700' },
      { label: 'Extrabold 800', value: '800' },
    ],
  },
  {
    key: 'lineHeight', label: 'Line height', type: 'range',
    min: 1, max: 3, step: 0.1,
    group: 'Typography',
  },
  {
    key: 'textAlign', label: 'Align', type: 'alignment',
    group: 'Typography',
  },
  {
    key: 'letterSpacing', label: 'Letter spacing', type: 'range',
    min: -2, max: 8, step: 0.5, unit: 'px',
    group: 'Typography',
  },

  // ── Spacing ─────────────────────────────────────────────────────────────────
  { key: 'pt', label: 'Top',    type: 'number', unit: 'px', group: 'Padding', min: 0, max: 200 },
  { key: 'pr', label: 'Right',  type: 'number', unit: 'px', group: 'Padding', min: 0, max: 200 },
  { key: 'pb', label: 'Bottom', type: 'number', unit: 'px', group: 'Padding', min: 0, max: 200 },
  { key: 'pl', label: 'Left',   type: 'number', unit: 'px', group: 'Padding', min: 0, max: 200 },

  { key: 'mt', label: 'Top',    type: 'number', unit: 'px', group: 'Margin', min: -100, max: 200 },
  { key: 'mr', label: 'Right',  type: 'number', unit: 'px', group: 'Margin', min: -100, max: 200 },
  { key: 'mb', label: 'Bottom', type: 'number', unit: 'px', group: 'Margin', min: -100, max: 200 },
  { key: 'ml', label: 'Left',   type: 'number', unit: 'px', group: 'Margin', min: -100, max: 200 },

  // ── Border ──────────────────────────────────────────────────────────────────
  {
    key: 'bw', label: 'Width', type: 'range',
    min: 0, max: 8, step: 1, unit: 'px',
    group: 'Border',
  },
  {
    key: 'bs', label: 'Style', type: 'select',
    group: 'Border',
    options: [
      { label: 'None',   value: 'none'   },
      { label: 'Solid',  value: 'solid'  },
      { label: 'Dashed', value: 'dashed' },
      { label: 'Dotted', value: 'dotted' },
    ],
  },
  {
    key: 'bc', label: 'Color', type: 'color',
    group: 'Border',
  },
  {
    key: 'br', label: 'Radius', type: 'range',
    min: 0, max: 64, step: 1, unit: 'px',
    group: 'Border',
  },

  // ── Effects ─────────────────────────────────────────────────────────────────
  {
    key: 'opacity', label: 'Opacity', type: 'range',
    min: 0, max: 100, step: 1, unit: '%',
    default: 100,
    group: 'Effects',
  },
  {
    key: 'shadow', label: 'Shadow', type: 'select',
    group: 'Effects',
    options: [
      { label: 'None',      value: 'none' },
      { label: 'Small',     value: 'sm'   },
      { label: 'Medium',    value: 'md'   },
      { label: 'Large',     value: 'lg'   },
      { label: 'X-Large',   value: 'xl'   },
      { label: 'XX-Large',  value: '2xl'  },
    ],
  },
  {
    key: 'zIndex', label: 'Z-index', type: 'number',
    min: -10, max: 100,
    group: 'Effects',
  },
  {
    key: 'overflow', label: 'Overflow', type: 'select',
    group: 'Effects',
    options: [
      { label: 'Visible', value: 'visible' },
      { label: 'Hidden',  value: 'hidden'  },
      { label: 'Scroll',  value: 'scroll'  },
      { label: 'Auto',    value: 'auto'    },
    ],
  },
];
