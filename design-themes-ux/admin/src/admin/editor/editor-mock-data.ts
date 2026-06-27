import type { PageDoc, SectionDefinition, BlockDefinition, SettingField } from './types';

// ─── Shared field schemas ────────────────────────────────────────────────────

const spacingFields: SettingField[] = [
  { key: 'spacing.top',    label: 'Top',    type: 'range', group: 'Section spacing', min: 0, max: 120, step: 4, unit: 'px', default: 40 },
  { key: 'spacing.bottom', label: 'Bottom', type: 'range', group: 'Section spacing', min: 0, max: 120, step: 4, unit: 'px', default: 40 },
];

const paddingFields: SettingField[] = [
  { key: 'padding.top',    label: 'Top',    type: 'range', group: 'Padding', min: 0, max: 80, step: 4, unit: 'px', default: 0 },
  { key: 'padding.bottom', label: 'Bottom', type: 'range', group: 'Padding', min: 0, max: 80, step: 4, unit: 'px', default: 0 },
  { key: 'padding.left',   label: 'Left',   type: 'range', group: 'Padding', min: 0, max: 80, step: 4, unit: 'px', default: 0 },
  { key: 'padding.right',  label: 'Right',  type: 'range', group: 'Padding', min: 0, max: 80, step: 4, unit: 'px', default: 0 },
];

// ─── Block Definitions ────────────────────────────────────────────────────────

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  {
    type: 'heading', name: 'Heading', icon: 'Heading', description: 'A styled heading',
    allowedInSections: ['*'], isRequired: false, tier: 'free',
    settingsSchema: [
      { key: 'text',  label: 'Text',  type: 'rich_text', group: 'Text', default: 'Your heading here', allowedTags: ['b','i','a'], richTextMode: 'inline' as const },
      { key: 'width', label: 'Width', type: 'radio', group: 'Layout',
        options: [{ label: 'Fit', value: 'fit' }, { label: 'Fill', value: 'fill' }], default: 'fit' },
      { key: 'maxWidth', label: 'Max width', type: 'select', group: 'Layout',
        options: [{ label: 'Narrow', value: 'narrow' }, { label: 'Normal', value: 'normal' }, { label: 'Wide', value: 'wide' }], default: 'normal' },
      { key: 'typographyPreset', label: 'Preset', type: 'select', group: 'Typography',
        options: [
          { label: 'Heading 1', value: 'h1' }, { label: 'Heading 2', value: 'h2' },
          { label: 'Heading 3', value: 'h3' }, { label: 'Subheading', value: 'subheading' },
        ], default: 'h2',
        helpText: 'Edit presets in theme settings' },
      { key: 'textColor',  label: 'Text color',  type: 'color', group: 'Appearance', default: '#ffffff' },
      { key: 'background', label: 'Background',  type: 'toggle', group: 'Appearance', default: false },
      { key: 'bgColor',    label: 'Background color', type: 'color', group: 'Appearance', default: '#000000',
        condition: { field: 'background', operator: 'eq', value: true } },
      ...paddingFields,
    ],
  },
  {
    type: 'paragraph', name: 'Text', icon: 'AlignLeft', description: 'Rich text paragraph',
    allowedInSections: ['*'], isRequired: false, tier: 'free',
    settingsSchema: [
      { key: 'text',      label: 'Text',       type: 'rich_text', group: 'Text', allowedTags: ['b','i','a','ul','ol','li'], richTextMode: 'block' as const },
      { key: 'textSize',  label: 'Size',        type: 'select',    group: 'Typography',
        options: [{ label: 'Small', value: 'sm' }, { label: 'Medium', value: 'md' }, { label: 'Large', value: 'lg' }], default: 'md' },
      { key: 'textColor', label: 'Text color',  type: 'color',     group: 'Appearance', default: '#ffffff' },
      ...paddingFields,
    ],
  },
  {
    type: 'button', name: 'Button', icon: 'MousePointerClick', description: 'Call-to-action button',
    allowedInSections: ['*'], isRequired: false, tier: 'free',
    settingsSchema: [
      { key: 'label',        label: 'Label',       type: 'text',   group: 'Content', default: 'Shop all' },
      { key: 'link',         label: 'Link',        type: 'url',    group: 'Content', placeholder: 'Paste a link or search' },
      { key: 'style',        label: 'Style',       type: 'select', group: 'Design',
        options: [{ label: 'Primary', value: 'primary' }, { label: 'Secondary', value: 'secondary' }, { label: 'Outline', value: 'outline' }], default: 'primary' },
      { key: 'size',         label: 'Size',        type: 'radio',  group: 'Design',
        options: [{ label: 'Small', value: 'sm' }, { label: 'Medium', value: 'md' }, { label: 'Large', value: 'lg' }], default: 'md' },
      { key: 'fullWidth',    label: 'Full width',  type: 'toggle', group: 'Design', default: false },
      { key: 'borderRadius', label: 'Shape',       type: 'select', group: 'Design',
        options: [{ label: 'Pill', value: 'pill' }, { label: 'Rounded', value: 'rounded' }, { label: 'Square', value: 'square' }], default: 'rounded' },
      { key: 'openNewTab',   label: 'Open in new tab', type: 'toggle', group: 'Behaviour', default: false },
      ...paddingFields,
    ],
  },
  {
    type: 'image', name: 'Image', icon: 'Image', description: 'An image block',
    allowedInSections: ['*'], isRequired: false, tier: 'free',
    settingsSchema: [
      { key: 'image',        label: 'Image',        type: 'image',  group: 'Content', formats: ['jpg','png','webp','gif','avif'] },
      { key: 'altText',      label: 'Alt text',     type: 'text',   group: 'Content', placeholder: 'Describe the image' },
      { key: 'aspectRatio',  label: 'Aspect ratio', type: 'select', group: 'Layout',
        options: [{ label: 'Original', value: 'natural' }, { label: 'Square', value: '1/1' }, { label: 'Portrait 3:4', value: '3/4' }, { label: 'Landscape 4:3', value: '4/3' }, { label: 'Widescreen 16:9', value: '16/9' }], default: 'natural' },
      { key: 'width',        label: 'Width',        type: 'select', group: 'Layout',
        options: [{ label: 'Small', value: 'sm' }, { label: 'Medium', value: 'md' }, { label: 'Large', value: 'lg' }, { label: 'Full', value: 'full' }], default: 'full' },
      { key: 'borderRadius', label: 'Corner radius', type: 'range', group: 'Design', min: 0, max: 32, step: 2, unit: 'px', default: 0 },
      { key: 'link',         label: 'Link',         type: 'url',   group: 'Design', placeholder: 'Optional — makes image clickable' },
      ...paddingFields,
    ],
  },
  {
    type: 'logo', name: 'Logo', icon: 'Store', description: 'Store logo image',
    allowedInSections: ['header'], isRequired: true, tier: 'free',
    settingsSchema: [
      { key: 'image',          label: 'Logo image',    type: 'image',  group: 'Logo', formats: ['jpg','png','webp','svg'] },
      { key: 'width',          label: 'Logo width',    type: 'range',  group: 'Logo', min: 40, max: 300, step: 4, unit: 'px', default: 120 },
      { key: 'altText',        label: 'Alt text',      type: 'text',   group: 'Logo', default: 'Store logo' },
      // P2 BACKLOG (hidden): mobileImage, mobileWidth — responsive logo switching not yet implemented
    ],
  },
  {
    type: 'menu', name: 'Navigation', icon: 'Menu', description: 'Navigation menu',
    allowedInSections: ['header'], isRequired: true, tier: 'free',
    settingsSchema: [
      { key: 'menuHandle',    label: 'Menu',              type: 'menu_picker', group: 'Menu', default: 'main-menu' },
      { key: 'position',      label: 'Position',          type: 'radio',       group: 'Menu',
        options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }], default: 'left' },
      { key: 'row',           label: 'Row',               type: 'radio',       group: 'Menu',
        options: [{ label: 'Top', value: 'top' }, { label: 'Bottom', value: 'bottom' }], default: 'bottom' },
      { key: 'linkFont',      label: 'Font',              type: 'select',      group: 'Typography',
        options: [{ label: 'Heading', value: 'heading' }, { label: 'Body', value: 'body' }], default: 'body' },
      { key: 'linkSize',      label: 'Size',              type: 'range',       group: 'Typography', min: 10, max: 20, step: 1, unit: 'px', default: 14 },
      // P2 BACKLOG (hidden): mobileStyle — mobile drawer not yet implemented
    ],
  },
  {
    type: 'announcement', name: 'Announcement', icon: 'Megaphone', description: 'Announcement text with link',
    allowedInSections: ['announcement_bar'], isRequired: false, tier: 'free',
    settingsSchema: [
      { key: 'text',          label: 'Text',           type: 'rich_text', group: 'Text', default: 'Welcome to our store', allowedTags: ['b','i','a'], richTextMode: 'inline' as const },
      { key: 'link',          label: 'Link',           type: 'url',       group: 'Text', placeholder: 'Optional link' },
      { key: 'font',          label: 'Font',           type: 'select',    group: 'Typography',
        options: [{ label: 'Heading', value: 'heading' }, { label: 'Subheading', value: 'subheading' }, { label: 'Body', value: 'body' }], default: 'subheading' },
      { key: 'fontSize',      label: 'Size',           type: 'range',     group: 'Typography', min: 10, max: 18, step: 1, unit: 'px', default: 12 },
      { key: 'fontWeight',    label: 'Weight',         type: 'select',    group: 'Typography',
        options: [{ label: 'Regular', value: '400' }, { label: 'Medium', value: '500' }, { label: 'Bold', value: '700' }], default: '400' },
      { key: 'letterSpacing', label: 'Letter spacing', type: 'radio',     group: 'Typography',
        options: [{ label: 'Tight', value: 'tight' }, { label: 'Normal', value: 'normal' }, { label: 'Loose', value: 'loose' }], default: 'normal' },
      { key: 'textCase',      label: 'Case',           type: 'radio',     group: 'Typography',
        options: [{ label: 'Default', value: 'none' }, { label: 'Uppercase', value: 'uppercase' }], default: 'none' },
      { key: 'textColor',     label: 'Text color',     type: 'color',     group: 'Appearance', default: '#ffffff' },
    ],
  },
  {
    type: 'collection_title', name: 'Collection title', icon: 'Type', description: 'Section title from collection',
    allowedInSections: ['featured_collection'], isRequired: false, tier: 'free',
    settingsSchema: [
      { key: 'text',      label: 'Heading',     type: 'text',   group: 'Content', default: 'Products' },
      { key: 'alignment', label: 'Alignment',   type: 'alignment', group: 'Layout', default: 'left' },
      { key: 'textColor', label: 'Text color',  type: 'color',  group: 'Appearance', default: '#111827' },
    ],
  },
  {
    type: 'view_all_button', name: 'View all button', icon: 'ArrowRight', description: '"View all" link button',
    allowedInSections: ['featured_collection'], isRequired: false, tier: 'free',
    settingsSchema: [
      { key: 'label',     label: 'Label',   type: 'text',   group: 'Content', default: 'View all' },
      { key: 'link',      label: 'Link',    type: 'url',    group: 'Content' },
      { key: 'style',     label: 'Style',   type: 'radio',  group: 'Design',
        options: [{ label: 'Link', value: 'link' }, { label: 'Outline', value: 'outline' }], default: 'link' },
    ],
  },
  {
    type: 'product_card', name: 'Product card', icon: 'ShoppingBag', description: 'Product card appearance settings',
    allowedInSections: ['featured_collection', 'product_grid'], isRequired: false, tier: 'free',
    settingsSchema: [
      { key: 'showVendor',   label: 'Show brand',       type: 'toggle', group: 'Product information', default: false },
      { key: 'showRating',   label: 'Show rating',      type: 'toggle', group: 'Product information', default: true },
      { key: 'showQuickAdd', label: 'Show quick-add',   type: 'toggle', group: 'Product information', default: true },
      { key: 'imageRatio',   label: 'Image ratio',      type: 'select', group: 'Media',
        options: [{ label: 'Square', value: '1/1' }, { label: 'Portrait', value: '3/4' }, { label: 'Landscape', value: '4/3' }, { label: 'Original', value: 'natural' }], default: '1/1' },
      { key: 'hoverEffect',  label: 'Hover effect',     type: 'select', group: 'Media',
        options: [{ label: 'None', value: 'none' }, { label: 'Zoom in', value: 'zoom' }, { label: 'Swap image', value: 'swap' }], default: 'zoom' },
    ],
  },
  {
    type: 'copyright', name: 'Copyright', icon: 'Copyright', description: 'Copyright line with year',
    allowedInSections: ['footer'], isRequired: false, tier: 'free',
    settingsSchema: [
      { key: 'text',      label: 'Text',  type: 'text',  group: 'Content',    default: '© {{year}} {{store_name}}. All rights reserved.',
        helpText: 'Use {{year}} and {{store_name}} as dynamic variables' },
      { key: 'textColor', label: 'Color', type: 'color', group: 'Appearance', default: '#9ca3af' },
    ],
  },
];

// ─── Section Definitions ──────────────────────────────────────────────────────

export const SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    type: 'announcement_bar', name: 'Announcement bar', icon: 'Megaphone', description: 'Full-width message strip at the top',
    category: 'Header', tier: 'free', allowedBlockTypes: ['announcement'],
    defaultBlocks: [{ type: 'announcement', settings: { text: 'Welcome to our store' }, isVisible: true, sortOrder: 1.0 }],
    settingsSchema: [
      { key: 'background',       label: 'Background',       type: 'color',  group: 'Design',  default: '#4f46e5' },
      { key: 'textColor',        label: 'Text color',       type: 'color',  group: 'Design',  default: '#ffffff' },
      { key: 'paddingVertical',  label: 'Vertical padding', type: 'range',  group: 'Design',  min: 4, max: 24, step: 2, unit: 'px', default: 8 },
      // P1-D: showOnMobile is implemented — keep it
      { key: 'showOnMobile',     label: 'Show on mobile',   type: 'toggle', group: 'Behaviour', default: true },
      // P2 BACKLOG (hidden): marqueeEnabled, scrollSpeed, showDismissButton — not yet implemented
    ],
  },
  {
    type: 'header', name: 'Header', icon: 'LayoutPanelTop', description: 'Store header with logo and navigation',
    category: 'Header', tier: 'free', allowedBlockTypes: ['logo', 'menu', 'search', 'cart', 'account', 'spacer'],
    defaultBlocks: [],
    settingsSchema: [
      { key: 'logoPosition',     label: 'Position',           type: 'radio',  group: 'Logo',
        options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }], default: 'left' },
      { key: 'menuPosition',     label: 'Position',           type: 'radio',  group: 'Menu',
        options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }], default: 'left' },
      { key: 'menuRow',          label: 'Row',                type: 'radio',  group: 'Menu',
        options: [{ label: 'Top', value: 'top' }, { label: 'Bottom', value: 'bottom' }], default: 'bottom' },
      { key: 'showSearchIcon',   label: 'Search icon',        type: 'toggle', group: 'Search', default: true },
      { key: 'searchPosition',   label: 'Position',           type: 'radio',  group: 'Search',
        options: [{ label: 'Left', value: 'left' }, { label: 'Right', value: 'right' }], default: 'right' },
      // P2 BACKLOG (hidden): showCountryFlag, showLanguage — not yet implemented
      { key: 'stickyMode',       label: 'Sticky header',      type: 'select', group: 'Behaviour',
        options: [{ label: 'Off', value: 'off' }, { label: 'Always', value: 'always' }, { label: 'On scroll up', value: 'scroll_up' }], default: 'scroll_up' },
      { key: 'transparentOnHero',label: 'Transparent on hero',type: 'toggle', group: 'Behaviour', default: false },
      { key: 'headerFont',       label: 'Font',               type: 'select', group: 'Typography',
        options: [{ label: 'Heading', value: 'heading' }, { label: 'Body', value: 'body' }], default: 'heading' },
      { key: 'headerFontSize',   label: 'Size',               type: 'range',  group: 'Typography', min: 10, max: 20, step: 1, unit: 'px', default: 14 },
    ],
  },
  {
    type: 'hero', name: 'Hero banner', icon: 'Image', description: 'Full-width hero with headline and CTA',
    category: 'Media', tier: 'free',
    allowedBlockTypes: ['heading', 'paragraph', 'button', 'image'],
    defaultBlocks: [
      { type: 'heading',   settings: { text: 'Browse our latest products', typographyPreset: 'h1', textColor: '#ffffff' }, isVisible: true, sortOrder: 1.0 },
      { type: 'button',    settings: { label: 'Shop all', style: 'outline' }, isVisible: true, sortOrder: 2.0 },
    ],
    settingsSchema: [
      { key: 'backgroundImage',  label: 'Background image', type: 'image',  group: 'Background' },
      { key: 'backgroundColor',  label: 'Background color', type: 'color',  group: 'Background', default: '#1a1a2e' },
      { key: 'overlayOpacity',   label: 'Overlay',          type: 'range',  group: 'Background', min: 0, max: 100, step: 5, unit: '%', default: 40 },
      { key: 'overlayColor',     label: 'Overlay color',    type: 'color',  group: 'Background', default: '#000000' },
      { key: 'height',           label: 'Section height',   type: 'select', group: 'Layout',
        options: [{ label: 'Auto', value: 'auto' }, { label: 'Small (400px)', value: 'sm' }, { label: 'Medium (600px)', value: 'md' }, { label: 'Large (800px)', value: 'lg' }, { label: 'Full screen', value: 'full' }], default: 'md' },
      { key: 'contentAlignment', label: 'Content position', type: 'alignment', group: 'Layout', default: 'center' },
      { key: 'contentWidth',     label: 'Content width',    type: 'select', group: 'Layout',
        options: [{ label: 'Narrow', value: 'narrow' }, { label: 'Normal', value: 'normal' }, { label: 'Wide', value: 'wide' }], default: 'normal' },
      // P2 BACKLOG (hidden): mobileLayout (overlay/stacked) — not yet implemented
      ...spacingFields,
    ],
  },
  {
    type: 'featured_collection', name: 'Featured collection', icon: 'LayoutGrid', description: 'Product grid from a collection',
    category: 'Products', tier: 'free',
    allowedBlockTypes: ['collection_title', 'view_all_button', 'product_card'],
    defaultBlocks: [
      { type: 'collection_title', settings: { text: 'Products' },   isVisible: true, sortOrder: 1.0 },
      { type: 'view_all_button',  settings: { label: 'View all' },  isVisible: true, sortOrder: 2.0 },
      { type: 'product_card',     settings: { showQuickAdd: true },  isVisible: true, sortOrder: 3.0 },
    ],
    settingsSchema: [
      { key: 'collection',      label: 'Collection',          type: 'collection_picker', group: 'Content' },
      { key: 'productsToShow',  label: 'Products to show',    type: 'range', group: 'Content', min: 2, max: 24, step: 2, default: 4 },
      { key: 'columnsDesktop',  label: 'Columns on desktop',  type: 'radio', group: 'Grid',
        options: [{ label: '2', value: '2' }, { label: '3', value: '3' }, { label: '4', value: '4' }, { label: '5', value: '5' }], default: '4' },
      { key: 'columnsMobile',   label: 'Columns on mobile',   type: 'radio', group: 'Grid',
        options: [{ label: '1', value: '1' }, { label: '2', value: '2' }], default: '2' },
      { key: 'showViewAll',     label: 'Show "View all"',     type: 'toggle', group: 'Content', default: true },
      { key: 'colorScheme',     label: 'Color scheme',        type: 'color_scheme', group: 'Design', default: 'scheme-1' },
      ...spacingFields,
    ],
  },
  {
    type: 'footer', name: 'Footer', icon: 'LayoutPanelBottom', description: 'Store footer with columns',
    category: 'Footer', tier: 'free', allowedBlockTypes: ['footer_column', 'brand_block', 'nav_column', 'newsletter_form', 'payment_badges', 'copyright'],
    defaultBlocks: [],
    settingsSchema: [
      // P2 BACKLOG (hidden): columnLayout — doesn't change footer_configs.columns (complex migration needed)
      // { key: 'columnLayout', ... }
      { key: 'background',     label: 'Background',           type: 'color',  group: 'Design', default: '#111827' },
      { key: 'topBorder',      label: 'Top border',           type: 'toggle', group: 'Design', default: true },
      { key: 'divider',        label: 'Column dividers',      type: 'toggle', group: 'Design', default: false },
      { key: 'paddingTop',     label: 'Top spacing',          type: 'range',  group: 'Spacing', min: 0, max: 120, step: 4, unit: 'px', default: 48 },
      { key: 'paddingBottom',  label: 'Bottom spacing',       type: 'range',  group: 'Spacing', min: 0, max: 120, step: 4, unit: 'px', default: 48 },
      { key: 'showBottomBar',  label: 'Show bottom bar',      type: 'toggle', group: 'Bottom bar', default: true },
      { key: 'bottomBarBg',    label: 'Bottom bar background',type: 'color',  group: 'Bottom bar', default: '#0f172a',
        condition: { field: 'showBottomBar', operator: 'eq', value: true } },
    ],
  },
  {
    type: 'rich_text', name: 'Rich text', icon: 'Type', description: 'Heading and paragraph text',
    category: 'Content', tier: 'free', allowedBlockTypes: ['heading', 'paragraph', 'button'],
    defaultBlocks: [
      { type: 'heading',   settings: { text: 'Heading', typographyPreset: 'h2', textColor: '#111827' }, isVisible: true, sortOrder: 1.0 },
      { type: 'paragraph', settings: { text: 'Share information about your brand with your customers.', textColor: '#374151' }, isVisible: true, sortOrder: 2.0 },
    ],
    settingsSchema: [
      { key: 'colorScheme', label: 'Color scheme',  type: 'color_scheme', group: 'Design', default: 'scheme-1' },
      { key: 'alignment',   label: 'Text position', type: 'alignment',    group: 'Layout', default: 'center' },
      { key: 'contentWidth',label: 'Content width', type: 'select',       group: 'Layout',
        options: [{ label: 'Narrow', value: 'narrow' }, { label: 'Normal', value: 'normal' }, { label: 'Wide', value: 'wide' }], default: 'narrow' },
      ...spacingFields,
    ],
  },
  {
    type: 'newsletter', name: 'Newsletter', icon: 'Mail', description: 'Email sign-up form',
    category: 'Social', tier: 'free', allowedBlockTypes: ['heading', 'paragraph'],
    defaultBlocks: [
      { type: 'heading',   settings: { text: 'Subscribe to our emails', typographyPreset: 'h2', textColor: '#111827' }, isVisible: true, sortOrder: 1.0 },
      { type: 'paragraph', settings: { text: 'Be the first to know about new collections and exclusive offers.', textColor: '#374151' }, isVisible: true, sortOrder: 2.0 },
    ],
    settingsSchema: [
      { key: 'placeholder',   label: 'Email placeholder', type: 'text',   group: 'Form', default: 'Email address' },
      { key: 'buttonLabel',   label: 'Button label',      type: 'text',   group: 'Form', default: 'Subscribe' },
      // P2 BACKLOG (hidden): successMsg — form not wired to any provider
      { key: 'colorScheme',   label: 'Color scheme',      type: 'color_scheme', group: 'Design', default: 'scheme-2' },
      ...spacingFields,
    ],
  },
  {
    type: 'brand_story', name: 'Brand story', icon: 'Quote', description: 'Brand heritage or mission statement text section',
    category: 'Content', tier: 'free', allowedBlockTypes: [],
    defaultBlocks: [],
    settingsSchema: [
      { key: 'title',         label: 'Heading',       type: 'text',     group: 'Content', default: 'Made with hands. Worn with love.' },
      { key: 'body',          label: 'Body text',     type: 'textarea', group: 'Content', default: 'Share your brand story, craftsmanship, and values with your customers.' },
      { key: 'bg',            label: 'Background',    type: 'color',    group: 'Design',  default: '#ffffff' },
      { key: 'paddingTop',    label: 'Top spacing',   type: 'range',    group: 'Spacing', min: 0, max: 120, step: 4, unit: 'px', default: 32 },
      { key: 'paddingBottom', label: 'Bottom spacing',type: 'range',    group: 'Spacing', min: 0, max: 120, step: 4, unit: 'px', default: 32 },
    ],
  },
  {
    type: 'editorial_banner', name: 'Editorial banner', icon: 'Star', description: 'Script-font editorial divider with accent headline',
    category: 'Content', tier: 'free', allowedBlockTypes: [],
    defaultBlocks: [],
    settingsSchema: [
      { key: 'scriptText',    label: 'Script heading',  type: 'text',  group: 'Content', default: 'New Arrival' },
      { key: 'subtitle',      label: 'Accent text',     type: 'text',  group: 'Content', default: 'latest collection' },
      { key: 'bg',            label: 'Background',      type: 'color', group: 'Design',  default: '#fdf8f3' },
      { key: 'accentColor',   label: 'Accent color',    type: 'color', group: 'Design',  default: '#cc3300' },
      { key: 'paddingTop',    label: 'Top spacing',     type: 'range', group: 'Spacing', min: 0, max: 80, step: 4, unit: 'px', default: 24 },
      { key: 'paddingBottom', label: 'Bottom spacing',  type: 'range', group: 'Spacing', min: 0, max: 80, step: 4, unit: 'px', default: 24 },
    ],
  },
  {
    type: 'collection_circles', name: 'Category circles', icon: 'LayoutGrid', description: 'Scrollable row of circular category thumbnails',
    category: 'Products', tier: 'free', allowedBlockTypes: [],
    defaultBlocks: [],
    settingsSchema: [
      { key: 'title',         label: 'Section heading', type: 'text',  group: 'Content', placeholder: 'Optional — leave blank to hide' },
      { key: 'circleSize',    label: 'Circle size',     type: 'range', group: 'Layout',  min: 60, max: 180, step: 10, unit: 'px', default: 100 },
      { key: 'bg',            label: 'Background',      type: 'color', group: 'Design',  default: '#ffffff' },
      { key: 'paddingTop',    label: 'Top spacing',     type: 'range', group: 'Spacing', min: 0, max: 120, step: 4, unit: 'px', default: 32 },
      { key: 'paddingBottom', label: 'Bottom spacing',  type: 'range', group: 'Spacing', min: 0, max: 120, step: 4, unit: 'px', default: 32 },
    ],
  },
  {
    type: 'product_mosaic', name: 'Category mosaic', icon: 'Image', description: 'Asymmetric category grid with a featured tall image',
    category: 'Products', tier: 'free', allowedBlockTypes: [],
    defaultBlocks: [],
    settingsSchema: [
      { key: 'bg',            label: 'Background',      type: 'color', group: 'Design',  default: '#ffffff' },
      { key: 'paddingTop',    label: 'Top spacing',     type: 'range', group: 'Spacing', min: 0, max: 80, step: 4, unit: 'px', default: 16 },
      { key: 'paddingBottom', label: 'Bottom spacing',  type: 'range', group: 'Spacing', min: 0, max: 80, step: 4, unit: 'px', default: 32 },
    ],
  },
  {
    type: 'trust_badges_bar', name: 'Trust badges', icon: 'ShoppingBag', description: 'Horizontal bar of trust signals — shipping, returns, support',
    category: 'Social', tier: 'free', allowedBlockTypes: [],
    defaultBlocks: [],
    settingsSchema: [
      { key: 'bg',            label: 'Background',      type: 'color', group: 'Design',  default: '#ffffff' },
      { key: 'borderColor',   label: 'Border color',    type: 'color', group: 'Design',  default: '#e5e7eb' },
      { key: 'paddingTop',    label: 'Top spacing',     type: 'range', group: 'Spacing', min: 0, max: 60, step: 4, unit: 'px', default: 20 },
      { key: 'paddingBottom', label: 'Bottom spacing',  type: 'range', group: 'Spacing', min: 0, max: 60, step: 4, unit: 'px', default: 20 },
    ],
  },
];

// ─── Mock Page Document ───────────────────────────────────────────────────────

export const MOCK_PAGE_DOC: PageDoc = {
  pageId:    'home',
  pageTitle: 'Home page',
  themeId:   'dawn',
  groups: {
    header: {
      groupId:  'grp_header_001',
      handle:   'header',
      sections: [
        {
          id: 'sec_ann_001', type: 'announcement_bar', label: 'Announcement bar',
          isVisible: true, isSystem: true, groupHandle: 'header',
          settings: { background: '#4f46e5', textColor: '#ffffff', paddingVertical: 8 },
          blocks: [
            { id: 'blk_ann_001', type: 'announcement', isVisible: true, isRequired: false, sortOrder: 1.0,
              settings: { text: 'Welcome to our store', font: 'subheading', fontSize: 12, textColor: '#ffffff', letterSpacing: 'normal', textCase: 'none' } },
          ],
        },
        {
          id: 'sec_hdr_001', type: 'header', label: 'Header',
          isVisible: true, isSystem: true, groupHandle: 'header',
          settings: { logoPosition: 'left', menuPosition: 'left', menuRow: 'bottom', showSearchIcon: true, stickyMode: 'scroll_up', headerFontSize: 14 },
          blocks: [
            { id: 'blk_logo_001', type: 'logo',  isVisible: true, isRequired: true,  sortOrder: 1.0, settings: { width: 120, altText: 'My Store' } },
            { id: 'blk_menu_001', type: 'menu',  isVisible: true, isRequired: true,  sortOrder: 2.0, settings: { menuHandle: 'main-menu', position: 'left' } },
          ],
        },
      ],
    },
    footer: {
      groupId:  'grp_footer_001',
      handle:   'footer',
      sections: [
        {
          id: 'sec_ftr_001', type: 'footer', label: 'Footer',
          isVisible: true, isSystem: true, groupHandle: 'footer',
          settings: { background: '#111827', paddingTop: 48, paddingBottom: 48, showBottomBar: true, bottomBarBg: '#0f172a' },
          blocks: [
            { id: 'blk_copy_001', type: 'copyright', isVisible: true, isRequired: false, sortOrder: 1.0,
              settings: { text: '© {{year}} My Store 2. All rights reserved.', textColor: '#9ca3af' } },
          ],
        },
      ],
    },
  },
  sections: [
    {
      id: 'sec_hero_001', type: 'hero', label: 'Hero',
      isVisible: true,
      settings: {
        backgroundColor: '#1a1a2e', overlayOpacity: 50, overlayColor: '#000000',
        height: 'md', contentAlignment: 'center', contentWidth: 'normal',
        backgroundImage: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1400&q=80',
      },
      blocks: [
        { id: 'blk_hdr_001', type: 'heading', isVisible: true, isRequired: false, sortOrder: 1.0,
          settings: { text: 'Browse our latest products', typographyPreset: 'h1', textColor: '#ffffff', width: 'fit', maxWidth: 'normal' } },
        { id: 'blk_btn_001', type: 'button', isVisible: true, isRequired: false, sortOrder: 2.0,
          settings: { label: 'Shop all', link: '/collections', style: 'outline', size: 'lg', borderRadius: 'rounded' } },
      ],
    },
    {
      id: 'sec_col_001', type: 'featured_collection', label: 'Featured collection',
      isVisible: true,
      settings: { productsToShow: 4, columnsDesktop: '4', columnsMobile: '2', showViewAll: true },
      blocks: [
        { id: 'blk_ct_001',  type: 'collection_title', isVisible: true, isRequired: false, sortOrder: 1.0, settings: { text: 'Products' } },
        { id: 'blk_va_001',  type: 'view_all_button',  isVisible: true, isRequired: false, sortOrder: 2.0, settings: { label: 'View all' } },
        { id: 'blk_pc_001',  type: 'product_card',     isVisible: true, isRequired: false, sortOrder: 3.0, settings: { showVendor: false, showRating: true, showQuickAdd: true, imageRatio: '1/1', hoverEffect: 'zoom' } },
      ],
    },
    {
      id: 'sec_nl_001', type: 'newsletter', label: 'Newsletter',
      isVisible: true,
      settings: { colorScheme: 'scheme-2' },
      blocks: [
        { id: 'blk_nh_001', type: 'heading',   isVisible: true, isRequired: false, sortOrder: 1.0, settings: { text: 'Subscribe to our emails', typographyPreset: 'h2', textColor: '#111827' } },
        { id: 'blk_np_001', type: 'paragraph', isVisible: true, isRequired: false, sortOrder: 2.0, settings: { text: 'Be the first to know about new collections and exclusive offers.', textColor: '#374151' } },
      ],
    },
  ],
};

// ─── Available pages for page switcher ───────────────────────────────────────

export const AVAILABLE_PAGES = [
  { id: 'home',       title: 'Home page',   slug: '/'                },
  { id: 'collection', title: 'Collections', slug: '/collections'     },
  { id: 'product',    title: 'Product',     slug: '/products/sample' },
  { id: 'cart',       title: 'Cart',        slug: '/cart'            },
  { id: 'search',     title: 'Search',      slug: '/search'          },
] as const;

export type PageId = typeof AVAILABLE_PAGES[number]['id'];

/** Canonical page titles — used whenever a pageId must be presented to the merchant. */
export const PAGE_TITLES: Record<string, string> = {
  home:       'Home page',
  collection: 'Collections',
  product:    'Product',
  cart:       'Cart',
  search:     'Search',
};

/**
 * Build a PageDoc shell for a page that has no sections yet.
 * Reuses the global header/footer groups from MOCK_PAGE_DOC so the
 * editor always shows a consistent header and footer regardless of page.
 */
export function buildEmptyPageDoc(pageId: string): PageDoc {
  return {
    ...MOCK_PAGE_DOC,
    pageId,
    pageTitle: PAGE_TITLES[pageId] ?? pageId,
    sections:  [],
  };
}
