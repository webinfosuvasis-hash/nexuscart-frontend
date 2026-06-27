import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── The 24 universal primitives ─────────────────────────────────────────────
// These are the ONLY component types the new renderer needs.
// All ecommerce verticals (fashion, saree, jewelry, furniture, electronics,
// grocery, beauty, luxury, marketplace) compose their pages from these.

const PRIMITIVES = [
  // ── LAYOUT (accept children, no own content) ────────────────────────────────
  {
    id: 'section',
    kind: 'LAYOUT' as const,
    name: 'Section',
    icon: 'square',
    category: 'layout',
    description: 'Full-width band. Controls background, padding, color scheme, max-width.',
    acceptsChildren: true,
    allowedChildren: ['*'],
    interactive: false,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'background', label: 'Background', type: 'color', group: 'Background' },
      { key: 'backgroundImage', label: 'Background image', type: 'image', group: 'Background' },
      { key: 'colorScheme', label: 'Color scheme', type: 'color_scheme', group: 'Background' },
      { key: 'paddingTop', label: 'Padding top', type: 'range', min: 0, max: 160, step: 4, unit: 'px', group: 'Spacing' },
      { key: 'paddingBottom', label: 'Padding bottom', type: 'range', min: 0, max: 160, step: 4, unit: 'px', group: 'Spacing' },
      { key: 'contentWidth', label: 'Content max-width', type: 'select', options: [
        { label: 'Narrow (768px)', value: 'narrow' },
        { label: 'Default (1280px)', value: 'default' },
        { label: 'Wide (1440px)', value: 'wide' },
        { label: 'Full bleed', value: 'full' },
      ], group: 'Layout' },
      { key: 'minHeight', label: 'Min height', type: 'select', options: [
        { label: 'Auto', value: 'auto' },
        { label: 'Small (400px)', value: 'sm' },
        { label: 'Medium (560px)', value: 'md' },
        { label: 'Large (720px)', value: 'lg' },
        { label: 'Full viewport', value: 'full' },
      ], group: 'Layout' },
    ],
  },
  {
    id: 'container',
    kind: 'LAYOUT' as const,
    name: 'Container',
    icon: 'box',
    category: 'layout',
    description: 'Flexbox wrapper. Controls alignment, gap, padding.',
    acceptsChildren: true,
    allowedChildren: ['*'],
    interactive: false,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'direction', label: 'Direction', type: 'radio', options: [{ label: 'Row', value: 'row' }, { label: 'Column', value: 'col' }] },
      { key: 'align', label: 'Align items', type: 'select', options: [
        { label: 'Start', value: 'start' }, { label: 'Center', value: 'center' },
        { label: 'End', value: 'end' }, { label: 'Stretch', value: 'stretch' },
      ]},
      { key: 'justify', label: 'Justify content', type: 'select', options: [
        { label: 'Start', value: 'start' }, { label: 'Center', value: 'center' },
        { label: 'End', value: 'end' }, { label: 'Space between', value: 'between' },
      ]},
      { key: 'gap', label: 'Gap', type: 'range', min: 0, max: 80, step: 4, unit: 'px' },
      { key: 'wrap', label: 'Wrap', type: 'toggle' },
    ],
  },
  {
    id: 'grid',
    kind: 'LAYOUT' as const,
    name: 'Grid',
    icon: 'grid',
    category: 'layout',
    description: 'CSS Grid. Controls columns, gaps, auto-fit.',
    acceptsChildren: true,
    allowedChildren: ['*'],
    interactive: false,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'columns', label: 'Columns', type: 'range', min: 1, max: 12, step: 1, group: 'Layout' },
      { key: 'columnsTablet', label: 'Columns (tablet)', type: 'range', min: 1, max: 6, step: 1, group: 'Layout' },
      { key: 'columnsMobile', label: 'Columns (mobile)', type: 'range', min: 1, max: 4, step: 1, group: 'Layout' },
      { key: 'gap', label: 'Gap', type: 'range', min: 0, max: 80, step: 4, unit: 'px', group: 'Spacing' },
      { key: 'rowGap', label: 'Row gap', type: 'range', min: 0, max: 80, step: 4, unit: 'px', group: 'Spacing' },
      { key: 'autoFit', label: 'Auto-fit columns', type: 'toggle', group: 'Layout' },
      { key: 'minColWidth', label: 'Min column width', type: 'number', unit: 'px', group: 'Layout' },
    ],
  },
  {
    id: 'stack',
    kind: 'LAYOUT' as const,
    name: 'Stack',
    icon: 'layers',
    category: 'layout',
    description: 'Flex column or row with uniform spacing.',
    acceptsChildren: true,
    allowedChildren: ['*'],
    interactive: false,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'direction', label: 'Direction', type: 'radio', options: [{ label: 'Vertical', value: 'col' }, { label: 'Horizontal', value: 'row' }] },
      { key: 'gap', label: 'Gap', type: 'range', min: 0, max: 80, step: 4, unit: 'px' },
      { key: 'align', label: 'Align', type: 'select', options: [
        { label: 'Start', value: 'start' }, { label: 'Center', value: 'center' }, { label: 'End', value: 'end' },
      ]},
    ],
  },
  {
    id: 'columns',
    kind: 'LAYOUT' as const,
    name: 'Columns',
    icon: 'columns',
    category: 'layout',
    description: 'Explicit column ratios (e.g. 2:1 split). Stacks on mobile.',
    acceptsChildren: true,
    allowedChildren: ['*'],
    interactive: false,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'ratios', label: 'Column ratios', type: 'text', placeholder: '1,1 or 2,1 or 3,2,1' },
      { key: 'gap', label: 'Gap', type: 'range', min: 0, max: 80, step: 4, unit: 'px' },
      { key: 'stackOn', label: 'Stack on', type: 'select', options: [
        { label: 'Mobile only', value: 'mobile' }, { label: 'Tablet + mobile', value: 'tablet' }, { label: 'Never', value: 'never' },
      ]},
    ],
  },
  {
    id: 'carousel',
    kind: 'LAYOUT' as const,
    name: 'Carousel',
    icon: 'chevrons-right',
    category: 'layout',
    description: 'Horizontal scroll carousel. Children = slides. Supports autoplay, arrows, dots, responsive slides-per-view.',
    acceptsChildren: true,
    allowedChildren: ['*'],  // Any node can be a slide: Image, Heading, Button, ProductCard, Container, Grid
    interactive: true,       // Requires island hydration for touch/keyboard/autoplay
    isBuiltIn: true,
    settingsSchema: [
      // ── Layout (visible in Layout tab) ──────────────────────────────────────
      { key: 'slidesToShow', label: 'Slides on desktop', type: 'range', min: 1, max: 6, step: 1, default: 1,
        group: 'Layout' },
      { key: 'loop', label: 'Loop infinitely', type: 'toggle', default: false, group: 'Layout' },

      // ── Responsive (via Layout tab responsive overrides) ───────────────────
      // Stored in responsive.tablet.slidesToShow and responsive.mobile.slidesToShow
      // Written by the ResponsiveTab — no separate schema keys needed here.
      // The resolveCarouselSettings() function reads them from the overlay.

      // ── Spacing (visible in Style tab) ────────────────────────────────────
      { key: 'gap',  label: 'Gap between slides', type: 'range', min: 0, max: 64, step: 4, unit: 'px', default: 16,
        group: 'Spacing' },
      { key: 'pt',   label: 'Padding top',    type: 'number', unit: 'px', min: 0, max: 160, default: 0,  group: 'Padding' },
      { key: 'pb',   label: 'Padding bottom', type: 'number', unit: 'px', min: 0, max: 160, default: 0,  group: 'Padding' },
      { key: 'pl',   label: 'Padding left',   type: 'number', unit: 'px', min: 0, max: 80,  default: 0,  group: 'Padding' },
      { key: 'pr',   label: 'Padding right',  type: 'number', unit: 'px', min: 0, max: 80,  default: 0,  group: 'Padding' },
      { key: 'bg',   label: 'Background',     type: 'color',  default: '', group: 'Background' },

      // ── Autoplay ──────────────────────────────────────────────────────────
      { key: 'autoplay',      label: 'Autoplay',           type: 'toggle', default: false, group: 'Autoplay' },
      { key: 'autoplaySpeed', label: 'Autoplay speed',     type: 'range', min: 500, max: 8000, step: 500, unit: 'ms', default: 3000,
        group: 'Autoplay', condition: { field: 'autoplay', operator: 'eq', value: true } },
      { key: 'pauseOnHover',  label: 'Pause on hover',     type: 'toggle', default: true,
        group: 'Autoplay', condition: { field: 'autoplay', operator: 'eq', value: true } },

      // ── Navigation ────────────────────────────────────────────────────────
      { key: 'showArrows', label: 'Show navigation arrows', type: 'toggle', default: true,  group: 'Navigation' },
      { key: 'arrowStyle', label: 'Arrow style', type: 'select', default: 'circle',
        options: [
          { label: 'Circle (overlay)', value: 'circle' },
          { label: 'Square (overlay)', value: 'square' },
          { label: 'Edge (flush)',     value: 'edge'   },
        ],
        group: 'Navigation',
        condition: { field: 'showArrows', operator: 'eq', value: true },
      },
      { key: 'showDots',  label: 'Show pagination dots',  type: 'toggle', default: false, group: 'Navigation' },
      { key: 'dotStyle',  label: 'Dot style', type: 'select', default: 'circle',
        options: [
          { label: 'Circle', value: 'circle' },
          { label: 'Line',   value: 'line'   },
        ],
        group: 'Navigation',
        condition: { field: 'showDots', operator: 'eq', value: true },
      },
    ],
  },
  {
    id: 'tabs',
    kind: 'LAYOUT' as const,
    name: 'Tabs',
    icon: 'layout',
    category: 'layout',
    description: 'Tabbed panels. Each child node = one panel.',
    acceptsChildren: true,
    allowedChildren: ['*'],
    interactive: true,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'tabs', label: 'Tab labels (comma separated)', type: 'text', placeholder: 'Men, Women, Kids' },
      { key: 'orientation', label: 'Orientation', type: 'radio', options: [{ label: 'Horizontal', value: 'horizontal' }, { label: 'Vertical', value: 'vertical' }] },
      { key: 'defaultOpen', label: 'Default open (index)', type: 'number' },
    ],
  },
  {
    id: 'accordion',
    kind: 'LAYOUT' as const,
    name: 'Accordion',
    icon: 'chevron-down',
    category: 'layout',
    description: 'Collapsible panels. Each child node = one panel.',
    acceptsChildren: true,
    allowedChildren: ['*'],
    interactive: true,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'allowMultiple', label: 'Allow multiple open', type: 'toggle' },
      { key: 'defaultOpen', label: 'Default open (indices)', type: 'text', placeholder: '0,1' },
    ],
  },

  // ── CONTENT (leaves — no children) ─────────────────────────────────────────
  {
    id: 'heading',
    kind: 'CONTENT' as const,
    name: 'Heading',
    icon: 'type',
    category: 'content',
    description: 'H1–H6 text. Supports data binding.',
    acceptsChildren: false,
    interactive: false,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'text', label: 'Text', type: 'rich_text', richTextMode: 'inline' },
      { key: 'level', label: 'Level', type: 'select', options: [
        { label: 'H1', value: 'h1' }, { label: 'H2', value: 'h2' }, { label: 'H3', value: 'h3' },
        { label: 'H4', value: 'h4' }, { label: 'H5', value: 'h5' }, { label: 'H6', value: 'h6' },
      ]},
      { key: 'textColor', label: 'Color', type: 'color' },
      { key: 'align', label: 'Align', type: 'alignment' },
    ],
  },
  {
    id: 'richtext',
    kind: 'CONTENT' as const,
    name: 'Rich Text',
    icon: 'align-left',
    category: 'content',
    description: 'Full rich text block with headings, lists, links.',
    acceptsChildren: false,
    interactive: false,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'html', label: 'Content', type: 'rich_text', richTextMode: 'block' },
      { key: 'textColor', label: 'Color', type: 'color' },
      { key: 'maxWidth', label: 'Max width', type: 'text', placeholder: 'e.g. 720px' },
    ],
  },
  {
    id: 'image',
    kind: 'CONTENT' as const,
    name: 'Image',
    icon: 'image',
    category: 'content',
    description: 'Responsive image with alt text and object-fit controls.',
    acceptsChildren: false,
    interactive: false,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'src', label: 'Image', type: 'image' },
      { key: 'alt', label: 'Alt text', type: 'text' },
      { key: 'objectFit', label: 'Fit', type: 'select', options: [
        { label: 'Cover', value: 'cover' }, { label: 'Contain', value: 'contain' }, { label: 'Fill', value: 'fill' },
      ]},
      { key: 'aspectRatio', label: 'Aspect ratio', type: 'select', options: [
        { label: 'Auto', value: 'auto' }, { label: '1:1', value: '1/1' }, { label: '4:3', value: '4/3' },
        { label: '16:9', value: '16/9' }, { label: '3:4', value: '3/4' },
      ]},
      { key: 'borderRadius', label: 'Border radius', type: 'range', min: 0, max: 48, unit: 'px' },
    ],
  },
  {
    id: 'video',
    kind: 'CONTENT' as const,
    name: 'Video',
    icon: 'play',
    category: 'content',
    description: 'Video embed or background video. YouTube / Vimeo / direct URL.',
    acceptsChildren: false,
    interactive: true,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'url', label: 'Video URL', type: 'url' },
      { key: 'autoplay', label: 'Autoplay (muted)', type: 'toggle' },
      { key: 'loop', label: 'Loop', type: 'toggle' },
      { key: 'showControls', label: 'Show controls', type: 'toggle' },
      { key: 'aspectRatio', label: 'Aspect ratio', type: 'select', options: [
        { label: '16:9', value: '16/9' }, { label: '9:16', value: '9/16' }, { label: '1:1', value: '1/1' },
      ]},
    ],
  },
  {
    id: 'button',
    kind: 'CONTENT' as const,
    name: 'Button',
    icon: 'mouse-pointer',
    category: 'content',
    description: 'CTA button with link, variant, and size controls.',
    acceptsChildren: false,
    interactive: true,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'label', label: 'Label', type: 'text' },
      { key: 'href', label: 'Link', type: 'url' },
      { key: 'variant', label: 'Variant', type: 'radio', options: [
        { label: 'Primary', value: 'primary' }, { label: 'Secondary', value: 'secondary' },
        { label: 'Outline', value: 'outline' }, { label: 'Ghost', value: 'ghost' },
      ]},
      { key: 'size', label: 'Size', type: 'radio', options: [
        { label: 'SM', value: 'sm' }, { label: 'MD', value: 'md' }, { label: 'LG', value: 'lg' },
      ]},
      { key: 'openInNewTab', label: 'Open in new tab', type: 'toggle' },
    ],
  },
  {
    id: 'icon',
    kind: 'CONTENT' as const,
    name: 'Icon',
    icon: 'star',
    category: 'content',
    description: 'Single icon from the icon library.',
    acceptsChildren: false,
    interactive: false,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'name', label: 'Icon name', type: 'text', placeholder: 'star, heart, check…' },
      { key: 'size', label: 'Size', type: 'range', min: 12, max: 96, step: 4, unit: 'px' },
      { key: 'color', label: 'Color', type: 'color' },
    ],
  },
  {
    id: 'spacer',
    kind: 'CONTENT' as const,
    name: 'Spacer',
    icon: 'move-vertical',
    category: 'content',
    description: 'Empty space block with configurable height.',
    acceptsChildren: false,
    interactive: false,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'height', label: 'Height', type: 'range', min: 4, max: 240, step: 4, unit: 'px' },
    ],
  },
  {
    id: 'divider',
    kind: 'CONTENT' as const,
    name: 'Divider',
    icon: 'minus',
    category: 'content',
    description: 'Horizontal rule with color, width, and margin controls.',
    acceptsChildren: false,
    interactive: false,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'thickness', label: 'Thickness', type: 'range', min: 1, max: 8, unit: 'px' },
      { key: 'style', label: 'Style', type: 'select', options: [
        { label: 'Solid', value: 'solid' }, { label: 'Dashed', value: 'dashed' }, { label: 'Dotted', value: 'dotted' },
      ]},
      { key: 'marginY', label: 'Vertical margin', type: 'range', min: 0, max: 64, unit: 'px' },
    ],
  },
  {
    id: 'custom_html',
    kind: 'CONTENT' as const,
    name: 'Custom HTML',
    icon: 'code',
    category: 'content',
    description: 'Raw HTML/CSS escape hatch. Sandboxed. Review required for marketplace themes.',
    acceptsChildren: false,
    interactive: true,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'html', label: 'HTML', type: 'liquid' },
      { key: 'css', label: 'Scoped CSS', type: 'textarea' },
    ],
  },

  // ── DATA-BOUND (layout + fetch — render children per-item) ──────────────────
  {
    id: 'product_grid',
    kind: 'DATA_BOUND' as const,
    name: 'Product Grid',
    icon: 'shopping-bag',
    category: 'commerce',
    description: 'Fetches products from a collection and renders children once per product.',
    acceptsChildren: true,
    allowedChildren: ['*'],
    providesContext: 'product',
    interactive: true,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'collectionId', label: 'Collection', type: 'collection_picker', group: 'Data' },
      { key: 'limit', label: 'Products to show', type: 'range', min: 2, max: 24, step: 2, group: 'Data' },
      { key: 'sort', label: 'Sort by', type: 'select', options: [
        { label: 'Newest', value: 'newest' }, { label: 'Best selling', value: 'best_selling' },
        { label: 'Price: low–high', value: 'price_asc' }, { label: 'Price: high–low', value: 'price_desc' },
      ], group: 'Data' },
      { key: 'columns', label: 'Columns', type: 'range', min: 1, max: 6, step: 1, group: 'Layout' },
      { key: 'gap', label: 'Gap', type: 'range', min: 0, max: 48, step: 4, unit: 'px', group: 'Layout' },
    ],
  },
  {
    id: 'collection_grid',
    kind: 'DATA_BOUND' as const,
    name: 'Collection Grid',
    icon: 'layout-grid',
    category: 'commerce',
    description: 'Fetches collections and renders children once per collection.',
    acceptsChildren: true,
    allowedChildren: ['*'],
    providesContext: 'collection',
    interactive: false,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'source', label: 'Collections', type: 'select', options: [
        { label: 'All collections', value: 'all' },
        { label: 'Featured collections', value: 'featured' },
        { label: 'Manual selection', value: 'manual' },
      ], group: 'Data' },
      { key: 'limit', label: 'Collections to show', type: 'range', min: 2, max: 12, step: 1, group: 'Data' },
      { key: 'columns', label: 'Columns', type: 'range', min: 1, max: 8, step: 1, group: 'Layout' },
      { key: 'gap', label: 'Gap', type: 'range', min: 0, max: 48, step: 4, unit: 'px', group: 'Layout' },
    ],
  },
  {
    id: 'dynamic_repeater',
    kind: 'DATA_BOUND' as const,
    name: 'Dynamic Repeater',
    icon: 'repeat',
    category: 'commerce',
    description: 'Generic repeater over any context array (variants, reviews, specs).',
    acceptsChildren: true,
    allowedChildren: ['*'],
    providesContext: 'item',
    interactive: false,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'source', label: 'Data path', type: 'dynamic_source', placeholder: 'e.g. product.variants' },
      { key: 'limit', label: 'Max items', type: 'number' },
    ],
  },
  {
    id: 'menu',
    kind: 'DATA_BOUND' as const,
    name: 'Menu',
    icon: 'menu',
    category: 'navigation',
    description: 'Renders a flat navigation menu from a menu handle.',
    acceptsChildren: false,
    providesContext: 'menu_item',
    interactive: true,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'menuHandle', label: 'Menu', type: 'menu_picker' },
      { key: 'orientation', label: 'Orientation', type: 'radio', options: [
        { label: 'Horizontal', value: 'horizontal' }, { label: 'Vertical', value: 'vertical' },
      ]},
    ],
  },
  {
    id: 'mega_menu',
    kind: 'DATA_BOUND' as const,
    name: 'Mega Menu',
    icon: 'layout',
    category: 'navigation',
    description: 'Full-width dropdown with arbitrary child layout. Use inside Header.',
    acceptsChildren: true,
    allowedChildren: ['*'],
    providesContext: 'menu_item',
    interactive: true,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'menuHandle', label: 'Menu', type: 'menu_picker' },
      { key: 'triggerStyle', label: 'Trigger style', type: 'select', options: [
        { label: 'Hover', value: 'hover' }, { label: 'Click', value: 'click' },
      ]},
      { key: 'columns', label: 'Columns', type: 'range', min: 2, max: 6, step: 1 },
    ],
  },

  // ── PDP PRIMITIVES — P6 ────────────────────────────────────────────────────
  {
    id: 'product_gallery',
    kind: 'CONTENT' as const,
    name: 'Product Gallery',
    icon: 'image',
    category: 'commerce',
    description: 'Main product image with thumbnail strip and hover zoom.',
    acceptsChildren: false,
    interactive: true,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'imageRatio',     label: 'Image ratio',         type: 'select', options: [{ label:'Square 1:1',value:'1/1'},{ label:'Portrait 4:5',value:'4/5'},{ label:'Portrait 3:4',value:'3/4'},{ label:'Landscape 4:3',value:'4/3'}] },
      { key: 'thumbPosition',  label: 'Thumbnails',          type: 'select', options: [{ label:'Bottom',value:'bottom'},{ label:'Left sidebar',value:'left'}] },
      { key: 'showZoom',       label: 'Hover zoom',          type: 'toggle', default: true },
    ],
  },
  {
    id: 'product_title',
    kind: 'CONTENT' as const,
    name: 'Product Title',
    icon: 'type',
    category: 'commerce',
    description: 'Displays the product name as an H1 heading.',
    acceptsChildren: false,
    interactive: false,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'level', label: 'Heading level', type: 'select', options: [{ label:'H1',value:'h1'},{ label:'H2',value:'h2'}], default: 'h1' },
    ],
  },
  {
    id: 'product_price',
    kind: 'CONTENT' as const,
    name: 'Product Price',
    icon: 'tag',
    category: 'commerce',
    description: 'Price, compare-at price, and discount badge.',
    acceptsChildren: false,
    interactive: false,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'showDiscountBadge', label: 'Discount badge', type: 'toggle', default: true },
      { key: 'badgeColor',        label: 'Badge color',    type: 'color',  default: '#16a34a' },
      { key: 'priceSize',         label: 'Price size',     type: 'range',  min: 16, max: 48, unit: 'px', default: 28 },
    ],
  },
  {
    id: 'variant_selector',
    kind: 'CONTENT' as const,
    name: 'Variant Selector',
    icon: 'layers',
    category: 'commerce',
    description: 'Color swatches and size pills for product variants.',
    acceptsChildren: false,
    interactive: true,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'swatchType', label: 'Swatch style', type: 'select', options: [{ label:'Pills',value:'pill'},{ label:'Color swatches',value:'swatch'}], default: 'pill' },
    ],
  },
  {
    id: 'quantity_selector',
    kind: 'CONTENT' as const,
    name: 'Quantity Selector',
    icon: 'plus-minus',
    category: 'commerce',
    description: 'Plus / minus quantity stepper.',
    acceptsChildren: false,
    interactive: true,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'min', label: 'Minimum', type: 'number', default: 1 },
      { key: 'max', label: 'Maximum', type: 'number', default: 99 },
    ],
  },
  {
    id: 'add_to_cart',
    kind: 'CONTENT' as const,
    name: 'Add to Cart',
    icon: 'shopping-bag',
    category: 'commerce',
    description: 'Primary add-to-cart CTA button.',
    acceptsChildren: false,
    interactive: true,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'label',    label: 'Button text',  type: 'text', default: 'Add to Cart' },
      { key: 'variant',  label: 'Style',        type: 'select', options: [{ label:'Filled',value:'filled'},{ label:'Outline',value:'outline'}], default: 'filled' },
      { key: 'radius',   label: 'Border radius',type: 'range', min: 0, max: 32, unit: 'px', default: 8 },
    ],
  },
  {
    id: 'buy_now',
    kind: 'CONTENT' as const,
    name: 'Buy Now',
    icon: 'zap',
    category: 'commerce',
    description: 'Instant purchase button — adds to cart and redirects to checkout.',
    acceptsChildren: false,
    interactive: true,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'label',  label: 'Button text',  type: 'text', default: 'Buy Now' },
      { key: 'radius', label: 'Border radius',type: 'range', min: 0, max: 32, unit: 'px', default: 8 },
    ],
  },
  {
    id: 'product_description',
    kind: 'CONTENT' as const,
    name: 'Product Description',
    icon: 'align-left',
    category: 'commerce',
    description: 'Rich text product description, optionally collapsible.',
    acceptsChildren: false,
    interactive: false,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'collapsible', label: 'Collapsible accordion', type: 'toggle', default: false },
      { key: 'label',       label: 'Section label',         type: 'text',   default: 'Description', condition: { field: 'collapsible', operator: 'eq', value: true } },
    ],
  },
  {
    id: 'product_specifications',
    kind: 'CONTENT' as const,
    name: 'Product Specifications',
    icon: 'table',
    category: 'commerce',
    description: 'Key-value specification table or collapsible accordion. Perfect for Electronics and Furniture.',
    acceptsChildren: false,
    interactive: false,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'layout', label: 'Layout', type: 'select', options: [{ label:'Table',value:'table'},{ label:'Accordion',value:'accordion'}], default: 'table' },
      { key: 'label',  label: 'Section title', type: 'text', default: 'Specifications' },
    ],
  },
  {
    id: 'breadcrumb',
    kind: 'CONTENT' as const,
    name: 'Breadcrumb',
    icon: 'chevrons-right',
    category: 'commerce',
    description: 'Navigation path: Home > Category > Product.',
    acceptsChildren: false,
    interactive: false,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'separator', label: 'Separator', type: 'select', options: [{ label:'/',value:'/'},{ label:'>',value:'>'},{ label:'·',value:'·'}], default: '/' },
    ],
  },
  {
    id: 'trust_badges',
    kind: 'CONTENT' as const,
    name: 'Trust Badges',
    icon: 'shield-check',
    category: 'commerce',
    description: 'Configurable icon + text trust indicators. Defaults: Secure Payment, Returns, Shipping, Authentic.',
    acceptsChildren: false,
    interactive: false,
    isBuiltIn: true,
    settingsSchema: [
      { key: 'columns',         label: 'Columns',      type: 'range', min: 1, max: 4, default: 2 },
      { key: 'showDescription', label: 'Show subtitle',type: 'toggle', default: true },
      { key: 'iconColor',       label: 'Icon color',   type: 'color', default: '#374151' },
      { key: 'badgeBg',         label: 'Badge background', type: 'color', default: '#f9fafb' },
    ],
  },
] as const;

export async function seedComponentDefinitions() {
  console.log('Seeding ComponentDefinition table with 24 universal primitives…');

  let created = 0;
  let skipped = 0;

  for (const primitive of PRIMITIVES) {
    const existing = await prisma.componentDefinition.findUnique({
      where: { id: primitive.id },
    });

    if (existing) {
      // Update settingsSchema + description in case we add fields
      await prisma.componentDefinition.update({
        where: { id: primitive.id },
        data: {
          settingsSchema: primitive.settingsSchema as any,
          description: 'description' in primitive ? (primitive as any).description : null,
          isActive: true,
          updatedAt: new Date(),
        },
      });
      skipped++;
      continue;
    }

    await prisma.componentDefinition.create({
      data: {
        id:              primitive.id,
        storeId:         null,               // null = platform built-in
        kind:            primitive.kind,
        name:            primitive.name,
        icon:            primitive.icon,
        category:        primitive.category,
        description:     'description' in primitive ? (primitive as any).description : null,
        settingsSchema:  primitive.settingsSchema as any,
        acceptsChildren: primitive.acceptsChildren,
        allowedChildren: ('allowedChildren' in primitive ? (primitive as any).allowedChildren : null) as any,
        providesContext: 'providesContext' in primitive ? (primitive as any).providesContext : null,
        interactive:     primitive.interactive,
        isBuiltIn:       primitive.isBuiltIn,
        isActive:        true,
        schemaVersion:   1,
      },
    });
    created++;
  }

  console.log(`ComponentDefinitions: ${created} created, ${skipped} already existed.`);
}

// Run directly via: npx ts-node prisma/seeds/component-definitions.seed.ts
if (require.main === module) {
  seedComponentDefinitions()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
