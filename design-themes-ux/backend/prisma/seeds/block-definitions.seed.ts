/**
 * Seed: block_definitions
 *
 * Sprint 4.5 — Architecture Remediation
 * Run with: npx ts-node prisma/seeds/block-definitions.seed.ts
 *
 * Idempotent: uses upsert so it is safe to re-run.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BLOCK_DEFINITIONS = [
  {
    type: 'heading',
    name: 'Heading',
    icon: 'Heading',
    description: 'A styled text heading (H1–H6)',
    tier: 'FREE' as const,
    isRequired: false,
    maxPerSection: null,
    allowedInSections: ['*'],
    settingsSchema: [
      { key: 'text',              label: 'Text',            type: 'rich_text', group: 'Text',       default: 'Your heading here', allowedTags: ['b','i','a'], richTextMode: 'inline' },
      { key: 'width',             label: 'Width',           type: 'radio',     group: 'Layout',     options: [{ label: 'Fit', value: 'fit' }, { label: 'Fill', value: 'fill' }], default: 'fit' },
      { key: 'maxWidth',          label: 'Max width',       type: 'select',    group: 'Layout',     options: [{ label: 'Narrow', value: 'narrow' }, { label: 'Normal', value: 'normal' }, { label: 'Wide', value: 'wide' }], default: 'normal' },
      { key: 'typographyPreset',  label: 'Preset',          type: 'select',    group: 'Typography', options: [{ label: 'Heading 1', value: 'h1' }, { label: 'Heading 2', value: 'h2' }, { label: 'Heading 3', value: 'h3' }, { label: 'Subheading', value: 'subheading' }], default: 'h2' },
      { key: 'textColor',         label: 'Text color',      type: 'color',     group: 'Appearance', default: '#ffffff' },
      { key: 'background',        label: 'Background',      type: 'toggle',    group: 'Appearance', default: false },
      { key: 'bgColor',           label: 'Background color',type: 'color',     group: 'Appearance', default: '#000000', condition: { field: 'background', operator: 'eq', value: true } },
      { key: 'padding.top',       label: 'Top',             type: 'range',     group: 'Padding',    min: 0, max: 80, step: 4, unit: 'px', default: 0 },
      { key: 'padding.bottom',    label: 'Bottom',          type: 'range',     group: 'Padding',    min: 0, max: 80, step: 4, unit: 'px', default: 0 },
      { key: 'padding.left',      label: 'Left',            type: 'range',     group: 'Padding',    min: 0, max: 80, step: 4, unit: 'px', default: 0 },
      { key: 'padding.right',     label: 'Right',           type: 'range',     group: 'Padding',    min: 0, max: 80, step: 4, unit: 'px', default: 0 },
    ],
  },
  {
    type: 'paragraph',
    name: 'Text',
    icon: 'AlignLeft',
    description: 'Rich text paragraph block',
    tier: 'FREE' as const,
    isRequired: false,
    maxPerSection: null,
    allowedInSections: ['*'],
    settingsSchema: [
      { key: 'text',       label: 'Text',       type: 'rich_text', group: 'Text',       allowedTags: ['b','i','a','ul','ol','li'], richTextMode: 'block' },
      { key: 'textSize',   label: 'Size',        type: 'select',    group: 'Typography', options: [{ label: 'Small', value: 'sm' }, { label: 'Medium', value: 'md' }, { label: 'Large', value: 'lg' }], default: 'md' },
      { key: 'textColor',  label: 'Text color',  type: 'color',     group: 'Appearance', default: '#ffffff' },
      { key: 'padding.top',    label: 'Top',    type: 'range', group: 'Padding', min: 0, max: 80, step: 4, unit: 'px', default: 0 },
      { key: 'padding.bottom', label: 'Bottom', type: 'range', group: 'Padding', min: 0, max: 80, step: 4, unit: 'px', default: 0 },
    ],
  },
  {
    type: 'button',
    name: 'Button',
    icon: 'MousePointerClick',
    description: 'Call-to-action button',
    tier: 'FREE' as const,
    isRequired: false,
    maxPerSection: null,
    allowedInSections: ['*'],
    settingsSchema: [
      { key: 'label',        label: 'Label',        type: 'text',   group: 'Content', default: 'Shop now' },
      { key: 'link',         label: 'Link',         type: 'url',    group: 'Content', placeholder: 'Paste a link or search' },
      { key: 'style',        label: 'Style',        type: 'select', group: 'Design',  options: [{ label: 'Primary', value: 'primary' }, { label: 'Secondary', value: 'secondary' }, { label: 'Outline', value: 'outline' }], default: 'primary' },
      { key: 'size',         label: 'Size',         type: 'radio',  group: 'Design',  options: [{ label: 'Small', value: 'sm' }, { label: 'Medium', value: 'md' }, { label: 'Large', value: 'lg' }], default: 'md' },
      { key: 'fullWidth',    label: 'Full width',   type: 'toggle', group: 'Design',  default: false },
      { key: 'borderRadius', label: 'Shape',        type: 'select', group: 'Design',  options: [{ label: 'Pill', value: 'pill' }, { label: 'Rounded', value: 'rounded' }, { label: 'Square', value: 'square' }], default: 'rounded' },
      { key: 'openNewTab',   label: 'Open in new tab', type: 'toggle', group: 'Behaviour', default: false },
      { key: 'padding.top',    label: 'Top',    type: 'range', group: 'Padding', min: 0, max: 80, step: 4, unit: 'px', default: 0 },
      { key: 'padding.bottom', label: 'Bottom', type: 'range', group: 'Padding', min: 0, max: 80, step: 4, unit: 'px', default: 0 },
    ],
  },
  {
    type: 'image',
    name: 'Image',
    icon: 'Image',
    description: 'An image with optional link',
    tier: 'FREE' as const,
    isRequired: false,
    maxPerSection: null,
    allowedInSections: ['*'],
    settingsSchema: [
      { key: 'image',        label: 'Image',         type: 'image',  group: 'Content', formats: ['jpg','png','webp','gif','avif'] },
      { key: 'altText',      label: 'Alt text',      type: 'text',   group: 'Content', placeholder: 'Describe the image' },
      { key: 'aspectRatio',  label: 'Aspect ratio',  type: 'select', group: 'Layout',  options: [{ label: 'Original', value: 'natural' }, { label: 'Square', value: '1/1' }, { label: 'Portrait 3:4', value: '3/4' }, { label: 'Landscape 4:3', value: '4/3' }, { label: 'Widescreen 16:9', value: '16/9' }], default: 'natural' },
      { key: 'width',        label: 'Width',         type: 'select', group: 'Layout',  options: [{ label: 'Small', value: 'sm' }, { label: 'Medium', value: 'md' }, { label: 'Large', value: 'lg' }, { label: 'Full', value: 'full' }], default: 'full' },
      { key: 'borderRadius', label: 'Corner radius', type: 'range',  group: 'Design',  min: 0, max: 32, step: 2, unit: 'px', default: 0 },
      { key: 'link',         label: 'Link',          type: 'url',    group: 'Design',  placeholder: 'Optional — makes image clickable' },
    ],
  },
  {
    type: 'logo',
    name: 'Logo',
    icon: 'Store',
    description: 'Store logo with optional mobile variant',
    tier: 'FREE' as const,
    isRequired: true,
    maxPerSection: 1,
    allowedInSections: ['header'],
    settingsSchema: [
      { key: 'image',       label: 'Logo image',   type: 'image',  group: 'Logo', formats: ['jpg','png','webp','svg'] },
      { key: 'mobileImage', label: 'Mobile logo',  type: 'image',  group: 'Logo', helpText: 'Optional — falls back to main logo' },
      { key: 'width',       label: 'Logo width',   type: 'range',  group: 'Logo', min: 40, max: 300, step: 4, unit: 'px', default: 120 },
      { key: 'mobileWidth', label: 'Mobile width', type: 'range',  group: 'Logo', min: 40, max: 200, step: 4, unit: 'px', default: 80 },
      { key: 'altText',     label: 'Alt text',     type: 'text',   group: 'Logo', default: 'Store logo' },
    ],
  },
  {
    type: 'menu',
    name: 'Navigation',
    icon: 'Menu',
    description: 'Navigation menu linked to a menu handle',
    tier: 'FREE' as const,
    isRequired: true,
    maxPerSection: 1,
    allowedInSections: ['header'],
    settingsSchema: [
      { key: 'menuHandle',    label: 'Menu',              type: 'menu_picker', group: 'Menu',             default: 'main-menu' },
      { key: 'position',      label: 'Position',          type: 'radio',       group: 'Menu',             options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }], default: 'left' },
      { key: 'row',           label: 'Row',               type: 'radio',       group: 'Menu',             options: [{ label: 'Top', value: 'top' }, { label: 'Bottom', value: 'bottom' }], default: 'bottom' },
      { key: 'linkFont',      label: 'Font',              type: 'select',      group: 'Typography',       options: [{ label: 'Heading', value: 'heading' }, { label: 'Body', value: 'body' }], default: 'body' },
      { key: 'linkSize',      label: 'Size',              type: 'range',       group: 'Typography',       min: 10, max: 20, step: 1, unit: 'px', default: 14 },
      { key: 'mobileStyle',   label: 'Mobile drawer',     type: 'select',      group: 'Mobile behaviour', options: [{ label: 'Slide from left', value: 'slide_left' }, { label: 'Slide from right', value: 'slide_right' }, { label: 'Full overlay', value: 'overlay' }], default: 'slide_left' },
    ],
  },
  {
    type: 'announcement',
    name: 'Announcement',
    icon: 'Megaphone',
    description: 'Announcement text with optional link',
    tier: 'FREE' as const,
    isRequired: false,
    maxPerSection: null,
    allowedInSections: ['announcement_bar'],
    settingsSchema: [
      { key: 'text',          label: 'Text',           type: 'rich_text', group: 'Text',       default: 'Welcome to our store', allowedTags: ['b','i','a'], richTextMode: 'inline' },
      { key: 'link',          label: 'Link',           type: 'url',       group: 'Text',       placeholder: 'Optional link' },
      { key: 'font',          label: 'Font',           type: 'select',    group: 'Typography', options: [{ label: 'Heading', value: 'heading' }, { label: 'Subheading', value: 'subheading' }, { label: 'Body', value: 'body' }], default: 'subheading' },
      { key: 'fontSize',      label: 'Size',           type: 'range',     group: 'Typography', min: 10, max: 18, step: 1, unit: 'px', default: 12 },
      { key: 'fontWeight',    label: 'Weight',         type: 'select',    group: 'Typography', options: [{ label: 'Regular', value: '400' }, { label: 'Medium', value: '500' }, { label: 'Bold', value: '700' }], default: '400' },
      { key: 'letterSpacing', label: 'Letter spacing', type: 'radio',     group: 'Typography', options: [{ label: 'Tight', value: 'tight' }, { label: 'Normal', value: 'normal' }, { label: 'Loose', value: 'loose' }], default: 'normal' },
      { key: 'textCase',      label: 'Case',           type: 'radio',     group: 'Typography', options: [{ label: 'Default', value: 'none' }, { label: 'Uppercase', value: 'uppercase' }], default: 'none' },
      { key: 'textColor',     label: 'Text color',     type: 'color',     group: 'Appearance', default: '#ffffff' },
    ],
  },
  {
    type: 'collection_title',
    name: 'Collection title',
    icon: 'Type',
    description: 'Section heading, often the collection name',
    tier: 'FREE' as const,
    isRequired: false,
    maxPerSection: 1,
    allowedInSections: ['featured_collection', 'product_grid', 'collection_grid'],
    settingsSchema: [
      { key: 'text',      label: 'Heading',     type: 'text',      group: 'Content',    default: 'Products' },
      { key: 'alignment', label: 'Alignment',   type: 'alignment', group: 'Layout',     default: 'left' },
      { key: 'textColor', label: 'Text color',  type: 'color',     group: 'Appearance', default: '#111827' },
    ],
  },
  {
    type: 'view_all_button',
    name: 'View all button',
    icon: 'ArrowRight',
    description: '"View all" link to the collection',
    tier: 'FREE' as const,
    isRequired: false,
    maxPerSection: 1,
    allowedInSections: ['featured_collection', 'product_grid', 'collection_grid'],
    settingsSchema: [
      { key: 'label', label: 'Label', type: 'text',   group: 'Content', default: 'View all' },
      { key: 'link',  label: 'Link',  type: 'url',    group: 'Content' },
      { key: 'style', label: 'Style', type: 'radio',  group: 'Design',  options: [{ label: 'Link', value: 'link' }, { label: 'Outline', value: 'outline' }], default: 'link' },
    ],
  },
  {
    type: 'product_card',
    name: 'Product card',
    icon: 'ShoppingBag',
    description: 'Product card appearance and quick-add settings',
    tier: 'FREE' as const,
    isRequired: false,
    maxPerSection: 1,
    allowedInSections: ['featured_collection', 'product_grid'],
    settingsSchema: [
      { key: 'showVendor',    label: 'Show brand',          type: 'toggle', group: 'Product information', default: false },
      { key: 'showRating',    label: 'Show rating',         type: 'toggle', group: 'Product information', default: true },
      { key: 'showQuickAdd',  label: 'Show quick-add',      type: 'toggle', group: 'Product information', default: true },
      { key: 'imageRatio',    label: 'Image ratio',         type: 'select', group: 'Media', options: [{ label: 'Square', value: '1/1' }, { label: 'Portrait', value: '3/4' }, { label: 'Landscape', value: '4/3' }, { label: 'Original', value: 'natural' }], default: '1/1' },
      { key: 'hoverEffect',   label: 'Hover effect',        type: 'select', group: 'Media', options: [{ label: 'None', value: 'none' }, { label: 'Zoom in', value: 'zoom' }, { label: 'Swap image', value: 'swap' }], default: 'zoom' },
    ],
  },
  {
    type: 'copyright',
    name: 'Copyright',
    icon: 'Copyright',
    description: 'Copyright line with year substitution',
    tier: 'FREE' as const,
    isRequired: false,
    maxPerSection: 1,
    allowedInSections: ['footer'],
    settingsSchema: [
      { key: 'text',      label: 'Text',  type: 'text',  group: 'Content',    default: '© {{year}} {{store_name}}. All rights reserved.', helpText: 'Use {{year}} and {{store_name}} as dynamic variables' },
      { key: 'textColor', label: 'Color', type: 'color', group: 'Appearance', default: '#9ca3af' },
    ],
  },
] as const;

async function main() {
  console.log('🌱 Seeding block_definitions…');

  let upserted = 0;
  for (const def of BLOCK_DEFINITIONS) {
    await (prisma as any).blockDefinition.upsert({
      where:  { type: def.type },
      update: {
        name:              def.name,
        icon:              def.icon,
        description:       def.description,
        settingsSchema:    def.settingsSchema,
        allowedInSections: def.allowedInSections,
        tier:              def.tier,
        isRequired:        def.isRequired,
        maxPerSection:     def.maxPerSection ?? null,
      },
      create: {
        type:              def.type,
        name:              def.name,
        icon:              def.icon,
        description:       def.description,
        settingsSchema:    def.settingsSchema,
        allowedInSections: def.allowedInSections,
        tier:              def.tier,
        isRequired:        def.isRequired,
        maxPerSection:     def.maxPerSection ?? null,
      },
    });
    upserted++;
    console.log(`  ✓ ${def.type}`);
  }

  console.log(`\n✅ Seeded ${upserted} block definitions.`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(async () => prisma.$disconnect());
