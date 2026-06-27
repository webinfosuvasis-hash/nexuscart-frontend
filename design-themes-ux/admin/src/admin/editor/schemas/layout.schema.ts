import type { SettingField } from '../types';

/**
 * LAYOUT_SCHEMA — drives the Layout tab in the inspector.
 * Keys map directly to styleResolver.ts properties.
 */
export const LAYOUT_SCHEMA: SettingField[] = [
  // ── Dimensions ──────────────────────────────────────────────────────────────
  {
    key: 'w', label: 'Width', type: 'select',
    group: 'Size',
    options: [
      { label: 'Auto',    value: 'auto' },
      { label: 'Full',    value: 'full' },
      { label: '50%',     value: '50%'  },
      { label: '75%',     value: '75%'  },
      { label: 'Custom',  value: 'custom' },
    ],
  },
  {
    key: 'maxW', label: 'Max width', type: 'number',
    unit: 'px', min: 0, max: 3000,
    group: 'Size',
  },
  {
    key: 'minH', label: 'Min height', type: 'number',
    unit: 'px', min: 0, max: 2000,
    group: 'Size',
  },
  {
    key: 'maxH', label: 'Max height', type: 'number',
    unit: 'px', min: 0, max: 2000,
    group: 'Size',
  },

  // ── Display ─────────────────────────────────────────────────────────────────
  {
    key: 'display', label: 'Display', type: 'select',
    group: 'Layout',
    options: [
      { label: 'Block',       value: 'block'       },
      { label: 'Flex',        value: 'flex'        },
      { label: 'Grid',        value: 'grid'        },
      { label: 'Inline Flex', value: 'inline-flex' },
      { label: 'Inline',      value: 'inline'      },
      { label: 'None',        value: 'none'        },
    ],
  },

  // ── Flex controls (shown when display=flex) ──────────────────────────────────
  {
    key: 'flexDir', label: 'Direction', type: 'radio',
    group: 'Flex',
    condition: { field: 'display', operator: 'eq', value: 'flex' },
    options: [
      { label: '↓ Column', value: 'column'         },
      { label: '→ Row',    value: 'row'            },
      { label: '↑ Col-Rev',value: 'column-reverse' },
      { label: '← Row-Rev',value: 'row-reverse'   },
    ],
  },
  {
    key: 'wrap', label: 'Wrap', type: 'toggle',
    group: 'Flex',
    condition: { field: 'display', operator: 'eq', value: 'flex' },
  },

  // ── Alignment (flex and grid) ────────────────────────────────────────────────
  {
    key: 'justify', label: 'Justify content', type: 'select',
    group: 'Alignment',
    condition: { field: 'display', operator: 'truthy' },
    options: [
      { label: 'Start',         value: 'start'   },
      { label: 'Center',        value: 'center'  },
      { label: 'End',           value: 'end'     },
      { label: 'Space between', value: 'between' },
      { label: 'Space around',  value: 'around'  },
      { label: 'Space evenly',  value: 'evenly'  },
    ],
  },
  {
    key: 'align', label: 'Align items', type: 'select',
    group: 'Alignment',
    condition: { field: 'display', operator: 'truthy' },
    options: [
      { label: 'Start',    value: 'start'    },
      { label: 'Center',   value: 'center'   },
      { label: 'End',      value: 'end'      },
      { label: 'Stretch',  value: 'stretch'  },
      { label: 'Baseline', value: 'baseline' },
    ],
  },

  // ── Spacing ─────────────────────────────────────────────────────────────────
  {
    key: 'gap', label: 'Gap', type: 'range',
    min: 0, max: 96, step: 4, unit: 'px',
    group: 'Spacing',
  },
  {
    key: 'colGap', label: 'Column gap', type: 'range',
    min: 0, max: 96, step: 4, unit: 'px',
    group: 'Spacing',
    condition: { field: 'display', operator: 'eq', value: 'grid' },
  },
  {
    key: 'rowGap', label: 'Row gap', type: 'range',
    min: 0, max: 96, step: 4, unit: 'px',
    group: 'Spacing',
    condition: { field: 'display', operator: 'eq', value: 'grid' },
  },

  // ── Grid (shown when display=grid) ──────────────────────────────────────────
  {
    key: 'gridCols', label: 'Columns', type: 'range',
    min: 1, max: 12, step: 1,
    group: 'Grid',
    condition: { field: 'display', operator: 'eq', value: 'grid' },
  },
  {
    key: 'gridRows', label: 'Rows', type: 'number',
    min: 1, max: 12,
    group: 'Grid',
    condition: { field: 'display', operator: 'eq', value: 'grid' },
  },
  {
    key: 'autoFit', label: 'Auto-fit columns', type: 'toggle',
    group: 'Grid',
    helpText: 'Automatically fit as many columns as possible at the minimum width.',
    condition: { field: 'display', operator: 'eq', value: 'grid' },
  },
  {
    key: 'minColW', label: 'Min column width', type: 'number',
    unit: 'px', min: 100, max: 800,
    group: 'Grid',
    condition: { field: 'autoFit', operator: 'eq', value: true },
  },
];
