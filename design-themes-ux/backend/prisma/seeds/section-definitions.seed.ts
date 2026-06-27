/**
 * Seed: section_definitions — all built-in section types
 *
 * Run with: npx ts-node --transpile-only prisma/seeds/section-definitions.seed.ts
 * Idempotent: uses upsert, safe to re-run.
 *
 * After this seed, run section-defaults.seed.ts to populate
 * allowedBlockTypes and defaultBlocks on each row.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SECTION_DEFINITIONS = [
  // ── Header group ──────────────────────────────────────────────────────────
  {
    id: 'announcement_bar',
    name: 'Announcement bar',
    description: 'Full-width message strip at the very top of every page',
    category: 'MEDIA' as const,
    tier: 'FREE' as const,
    icon: 'Megaphone',
    compatibleThemes: ['*'],
    settingsSchema: [
      { key: 'background',       label: 'Background',       type: 'color',  group: 'Design',    default: '#4f46e5' },
      { key: 'textColor',        label: 'Text color',       type: 'color',  group: 'Design',    default: '#ffffff' },
      { key: 'paddingVertical',  label: 'Vertical padding', type: 'range',  group: 'Design',    min: 4, max: 24, step: 2, unit: 'px', default: 8 },
      { key: 'marqueeEnabled',   label: 'Scroll messages',  type: 'toggle', group: 'Behaviour', default: false },
      { key: 'scrollSpeed',      label: 'Scroll speed',     type: 'range',  group: 'Behaviour', min: 10, max: 200, step: 10, unit: 'px/s', default: 60, condition: { field: 'marqueeEnabled', operator: 'eq', value: true } },
      { key: 'showOnMobile',     label: 'Show on mobile',   type: 'toggle', group: 'Behaviour', default: true },
      { key: 'showDismissButton',label: 'Allow dismissal',  type: 'toggle', group: 'Behaviour', default: false },
    ],
  },
  {
    id: 'header',
    name: 'Header',
    description: 'Store header with logo and navigation',
    category: 'MEDIA' as const,
    tier: 'FREE' as const,
    icon: 'LayoutPanelTop',
    compatibleThemes: ['*'],
    settingsSchema: [
      { key: 'logoPosition',      label: 'Position',            type: 'radio',  group: 'Logo',        options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }], default: 'left' },
      { key: 'menuPosition',      label: 'Position',            type: 'radio',  group: 'Menu',        options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }], default: 'left' },
      { key: 'menuRow',           label: 'Row',                 type: 'radio',  group: 'Menu',        options: [{ label: 'Top', value: 'top' }, { label: 'Bottom', value: 'bottom' }], default: 'bottom' },
      { key: 'showSearchIcon',    label: 'Search icon',         type: 'toggle', group: 'Search',      default: true },
      { key: 'showCountryFlag',   label: 'Country / region',    type: 'toggle', group: 'Localisation',default: false },
      { key: 'showLanguage',      label: 'Language selector',   type: 'toggle', group: 'Localisation',default: false },
      { key: 'stickyMode',        label: 'Sticky header',       type: 'select', group: 'Behaviour',   options: [{ label: 'Off', value: 'off' }, { label: 'Always', value: 'always' }, { label: 'On scroll up', value: 'scroll_up' }], default: 'scroll_up' },
      { key: 'transparentOnHero', label: 'Transparent on hero', type: 'toggle', group: 'Behaviour',   default: false },
      { key: 'headerFontSize',    label: 'Font size',           type: 'range',  group: 'Typography',  min: 10, max: 20, step: 1, unit: 'px', default: 14 },
    ],
  },

  // ── Template sections ────────────────────────────────────────────────────
  {
    id: 'hero',
    name: 'Hero banner',
    description: 'Full-width hero with background, headline, and CTA',
    category: 'MEDIA' as const,
    tier: 'FREE' as const,
    icon: 'Image',
    compatibleThemes: ['*'],
    settingsSchema: [
      { key: 'backgroundImage',  label: 'Background image', type: 'image',  group: 'Background' },
      { key: 'backgroundColor',  label: 'Background color', type: 'color',  group: 'Background', default: '#1a1a2e' },
      { key: 'overlayOpacity',   label: 'Overlay',          type: 'range',  group: 'Background', min: 0, max: 100, step: 5, unit: '%', default: 40 },
      { key: 'overlayColor',     label: 'Overlay color',    type: 'color',  group: 'Background', default: '#000000' },
      { key: 'height',           label: 'Section height',   type: 'select', group: 'Layout',     options: [{ label: 'Auto', value: 'auto' }, { label: 'Small (400px)', value: 'sm' }, { label: 'Medium (600px)', value: 'md' }, { label: 'Large (800px)', value: 'lg' }, { label: 'Full screen', value: 'full' }], default: 'md' },
      { key: 'contentAlignment', label: 'Content position', type: 'alignment', group: 'Layout',  default: 'center' },
      { key: 'contentWidth',     label: 'Content width',    type: 'select', group: 'Layout',     options: [{ label: 'Narrow', value: 'narrow' }, { label: 'Normal', value: 'normal' }, { label: 'Wide', value: 'wide' }], default: 'normal' },
      { key: 'mobileLayout',     label: 'Mobile layout',    type: 'select', group: 'Mobile',     options: [{ label: 'Image as background', value: 'overlay' }, { label: 'Image above content', value: 'stacked' }], default: 'overlay' },
      { key: 'spacing.top',      label: 'Top',              type: 'range',  group: 'Section spacing', min: 0, max: 120, step: 4, unit: 'px', default: 0 },
      { key: 'spacing.bottom',   label: 'Bottom',           type: 'range',  group: 'Section spacing', min: 0, max: 120, step: 4, unit: 'px', default: 0 },
    ],
  },
  {
    id: 'featured_collection',
    name: 'Featured collection',
    description: 'Product grid from a chosen collection',
    category: 'PRODUCTS' as const,
    tier: 'FREE' as const,
    icon: 'LayoutGrid',
    compatibleThemes: ['*'],
    settingsSchema: [
      { key: 'collection',      label: 'Collection',          type: 'collection_picker', group: 'Content' },
      { key: 'productsToShow',  label: 'Products to show',    type: 'range',  group: 'Content', min: 2, max: 24, step: 2, default: 4 },
      { key: 'columnsDesktop',  label: 'Columns on desktop',  type: 'radio',  group: 'Grid',    options: [{ label: '2', value: '2' }, { label: '3', value: '3' }, { label: '4', value: '4' }, { label: '5', value: '5' }], default: '4' },
      { key: 'columnsMobile',   label: 'Columns on mobile',   type: 'radio',  group: 'Grid',    options: [{ label: '1', value: '1' }, { label: '2', value: '2' }], default: '2' },
      { key: 'showViewAll',     label: 'Show "View all"',     type: 'toggle', group: 'Content', default: true },
      { key: 'spacing.top',     label: 'Top',                 type: 'range',  group: 'Section spacing', min: 0, max: 120, step: 4, unit: 'px', default: 48 },
      { key: 'spacing.bottom',  label: 'Bottom',              type: 'range',  group: 'Section spacing', min: 0, max: 120, step: 4, unit: 'px', default: 48 },
    ],
  },
  {
    id: 'product_grid',
    name: 'Product grid',
    description: 'A grid of products with configurable columns',
    category: 'PRODUCTS' as const,
    tier: 'FREE' as const,
    icon: 'LayoutGrid',
    compatibleThemes: ['*'],
    settingsSchema: [
      { key: 'collection',     label: 'Collection',        type: 'collection_picker', group: 'Content' },
      { key: 'productsToShow', label: 'Products to show',  type: 'range',  group: 'Content', min: 2, max: 24, step: 2, default: 8 },
      { key: 'columnsDesktop', label: 'Columns (desktop)', type: 'radio',  group: 'Grid',    options: [{ label: '2', value: '2' }, { label: '3', value: '3' }, { label: '4', value: '4' }, { label: '5', value: '5' }], default: '4' },
      { key: 'columnsMobile',  label: 'Columns (mobile)',  type: 'radio',  group: 'Grid',    options: [{ label: '1', value: '1' }, { label: '2', value: '2' }], default: '2' },
    ],
  },
  {
    id: 'collection_grid',
    name: 'Collection grid',
    description: 'Display multiple collection tiles',
    category: 'PRODUCTS' as const,
    tier: 'FREE' as const,
    icon: 'LayoutGrid',
    compatibleThemes: ['*'],
    settingsSchema: [
      { key: 'columns',  label: 'Columns',  type: 'radio',  group: 'Layout', options: [{ label: '2', value: '2' }, { label: '3', value: '3' }, { label: '4', value: '4' }], default: '3' },
      { key: 'showTitle',label: 'Show title',type: 'toggle', group: 'Content', default: true },
    ],
  },
  {
    id: 'rich_text',
    name: 'Rich text',
    description: 'Heading and paragraph text with optional buttons',
    category: 'CONTENT' as const,
    tier: 'FREE' as const,
    icon: 'Type',
    compatibleThemes: ['*'],
    settingsSchema: [
      { key: 'alignment',    label: 'Text position', type: 'alignment', group: 'Layout', default: 'center' },
      { key: 'contentWidth', label: 'Content width', type: 'select',    group: 'Layout', options: [{ label: 'Narrow', value: 'narrow' }, { label: 'Normal', value: 'normal' }, { label: 'Wide', value: 'wide' }], default: 'narrow' },
      { key: 'spacing.top',    label: 'Top',    type: 'range', group: 'Section spacing', min: 0, max: 120, step: 4, unit: 'px', default: 40 },
      { key: 'spacing.bottom', label: 'Bottom', type: 'range', group: 'Section spacing', min: 0, max: 120, step: 4, unit: 'px', default: 40 },
    ],
  },
  {
    id: 'newsletter',
    name: 'Newsletter',
    description: 'Email sign-up form with heading and subtext',
    category: 'SOCIAL' as const,
    tier: 'FREE' as const,
    icon: 'Mail',
    compatibleThemes: ['*'],
    settingsSchema: [
      { key: 'placeholder',   label: 'Email placeholder', type: 'text',   group: 'Form',    default: 'Email address' },
      { key: 'buttonLabel',   label: 'Button label',      type: 'text',   group: 'Form',    default: 'Subscribe' },
      { key: 'successMsg',    label: 'Success message',   type: 'text',   group: 'Form',    default: 'Thanks for subscribing!' },
      { key: 'spacing.top',   label: 'Top',               type: 'range',  group: 'Section spacing', min: 0, max: 120, step: 4, unit: 'px', default: 64 },
      { key: 'spacing.bottom',label: 'Bottom',             type: 'range',  group: 'Section spacing', min: 0, max: 120, step: 4, unit: 'px', default: 64 },
    ],
  },
  {
    id: 'testimonials',
    name: 'Testimonials',
    description: 'Customer review carousel',
    category: 'SOCIAL' as const,
    tier: 'FREE' as const,
    icon: 'Quote',
    compatibleThemes: ['*'],
    settingsSchema: [
      { key: 'style', label: 'Display style', type: 'select', group: 'Layout', options: [{ label: 'Carousel', value: 'carousel' }, { label: 'Grid', value: 'grid' }], default: 'carousel' },
    ],
  },
  {
    id: 'faq',
    name: 'FAQ accordion',
    description: 'Frequently asked questions in an expandable list',
    category: 'CONTENT' as const,
    tier: 'FREE' as const,
    icon: 'HelpCircle',
    compatibleThemes: ['*'],
    settingsSchema: [
      { key: 'openFirst', label: 'Open first item', type: 'toggle', group: 'Behaviour', default: true },
    ],
  },
  {
    id: 'image_gallery',
    name: 'Image gallery',
    description: 'Grid or masonry image gallery',
    category: 'MEDIA' as const,
    tier: 'FREE' as const,
    icon: 'Image',
    compatibleThemes: ['*'],
    settingsSchema: [
      { key: 'layout',  label: 'Layout',  type: 'radio', group: 'Display', options: [{ label: 'Grid', value: 'grid' }, { label: 'Masonry', value: 'masonry' }], default: 'grid' },
      { key: 'columns', label: 'Columns', type: 'radio', group: 'Display', options: [{ label: '2', value: '2' }, { label: '3', value: '3' }, { label: '4', value: '4' }], default: '3' },
    ],
  },
  {
    id: 'countdown',
    name: 'Countdown timer',
    description: 'Flash sale countdown with call-to-action',
    category: 'MEDIA' as const,
    tier: 'FREE' as const,
    icon: 'Timer',
    compatibleThemes: ['*'],
    settingsSchema: [
      { key: 'endsAt',    label: 'Sale ends at',    type: 'text',  group: 'Timer', placeholder: 'ISO date string' },
      { key: 'title',     label: 'Timer heading',   type: 'text',  group: 'Timer', default: 'Sale Ends In' },
      { key: 'ctaLabel',  label: 'CTA button label',type: 'text',  group: 'CTA',   default: 'Shop Now' },
      { key: 'ctaLink',   label: 'CTA link',        type: 'url',   group: 'CTA' },
    ],
  },
  {
    id: 'video',
    name: 'Video block',
    description: 'Embed a YouTube or Vimeo video',
    category: 'MEDIA' as const,
    tier: 'FREE' as const,
    icon: 'Video',
    compatibleThemes: ['*'],
    settingsSchema: [
      { key: 'url',      label: 'Video URL',     type: 'video_url', group: 'Video', placeholder: 'YouTube or Vimeo URL' },
      { key: 'autoplay', label: 'Autoplay',      type: 'toggle',    group: 'Video', default: false },
      { key: 'muted',    label: 'Mute on load',  type: 'toggle',    group: 'Video', default: true },
    ],
  },
  {
    id: 'brands',
    name: 'Brand logos',
    description: 'Partner and brand logo strip',
    category: 'SOCIAL' as const,
    tier: 'FREE' as const,
    icon: 'Star',
    compatibleThemes: ['*'],
    settingsSchema: [
      { key: 'title', label: 'Heading', type: 'text', group: 'Content', default: 'As Featured In' },
    ],
  },
  {
    id: 'promo_bar',
    name: 'Promo strip',
    description: 'Scrolling promotional announcement bar',
    category: 'MEDIA' as const,
    tier: 'FREE' as const,
    icon: 'Megaphone',
    compatibleThemes: ['*'],
    settingsSchema: [
      { key: 'speed',    label: 'Scroll speed', type: 'range',  group: 'Behaviour', min: 10, max: 100, step: 5, unit: 'px/s', default: 30 },
      { key: 'bg',       label: 'Background',   type: 'color',  group: 'Design',    default: '#4f46e5' },
      { key: 'textColor',label: 'Text color',   type: 'color',  group: 'Design',    default: '#ffffff' },
    ],
  },
  {
    id: 'blog',
    name: 'Blog posts',
    description: 'Latest blog post grid',
    category: 'CONTENT' as const,
    tier: 'FREE' as const,
    icon: 'FileText',
    compatibleThemes: ['*'],
    settingsSchema: [
      { key: 'limit',   label: 'Posts to show', type: 'range', group: 'Content', min: 2, max: 12, step: 1, default: 3 },
      { key: 'columns', label: 'Columns',       type: 'radio', group: 'Grid',    options: [{ label: '2', value: '2' }, { label: '3', value: '3' }], default: '3' },
    ],
  },

  // ── Footer group ─────────────────────────────────────────────────────────
  {
    id: 'footer',
    name: 'Footer',
    description: 'Store footer with columns and bottom bar',
    category: 'CONTENT' as const,
    tier: 'FREE' as const,
    icon: 'LayoutPanelBottom',
    compatibleThemes: ['*'],
    settingsSchema: [
      { key: 'columnLayout',  label: 'Column layout',          type: 'radio',  group: 'Layout',    options: [{ label: '2 columns', value: '2' }, { label: '3 columns', value: '3' }, { label: '4 columns', value: '4' }], default: '4' },
      { key: 'background',    label: 'Background',             type: 'color',  group: 'Design',    default: '#111827' },
      { key: 'topBorder',     label: 'Top border',             type: 'toggle', group: 'Design',    default: true },
      { key: 'divider',       label: 'Column dividers',        type: 'toggle', group: 'Design',    default: false },
      { key: 'paddingTop',    label: 'Top spacing',            type: 'range',  group: 'Spacing',   min: 0, max: 120, step: 4, unit: 'px', default: 48 },
      { key: 'paddingBottom', label: 'Bottom spacing',         type: 'range',  group: 'Spacing',   min: 0, max: 120, step: 4, unit: 'px', default: 48 },
      { key: 'showBottomBar', label: 'Show bottom bar',        type: 'toggle', group: 'Bottom bar',default: true },
      { key: 'bottomBarBg',   label: 'Bottom bar background',  type: 'color',  group: 'Bottom bar',default: '#0f172a', condition: { field: 'showBottomBar', operator: 'eq', value: true } },
    ],
  },
] as const;

async function main() {
  console.log('🌱 Seeding section_definitions…\n');

  let upserted = 0;
  for (const def of SECTION_DEFINITIONS) {
    await prisma.sectionDefinition.upsert({
      where:  { id: def.id },
      create: {
        id:              def.id,
        name:            def.name,
        description:     def.description,
        category:        def.category as any,
        tier:            def.tier as any,
        icon:            def.icon,
        compatibleThemes: def.compatibleThemes as any,
        settingsSchema:  def.settingsSchema as any,
        isBuiltIn:       true,
        isActive:        true,
      },
      update: {
        name:            def.name,
        description:     def.description,
        icon:            def.icon,
        settingsSchema:  def.settingsSchema as any,
      },
    });
    upserted++;
    console.log(`  ✓ ${def.id}`);
  }

  console.log(`\n✅ Seeded ${upserted} section definitions.`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(async () => prisma.$disconnect());
