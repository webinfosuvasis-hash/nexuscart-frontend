import { describe, it, expect } from 'vitest';
import {
  makeNode,
  createNodeFromDefinition,
  createNodeFromSeed,
  type SectionSeed,
} from '../nodeFactory';
import type { SectionDefinition } from '@/admin/editor/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const HERO_DEF: SectionDefinition = {
  type:     'hero',
  name:     'Hero banner',
  icon:     'Image',
  description: 'Full-width hero with headline and CTA',
  category: 'Media',
  tier:     'free',
  allowedBlockTypes: ['heading', 'paragraph', 'button', 'image'],
  settingsSchema: [
    { key: 'height',         label: 'Height',   type: 'select', default: 'md' },
    { key: 'overlayOpacity', label: 'Overlay',  type: 'range',  default: 40   },
    { key: 'backgroundColor',label: 'BG color', type: 'color',  default: '#1a1a2e' },
    { key: 'noDefault',      label: 'No default', type: 'text' },  // no default — should be omitted
  ],
  defaultBlocks: [
    { type: 'heading', settings: { text: 'Browse our latest products', typographyPreset: 'h1', textColor: '#ffffff' }, isVisible: true, sortOrder: 1.0 },
    { type: 'button',  settings: { label: 'Shop all', style: 'outline' }, isVisible: true, sortOrder: 2.0 },
  ],
};

const NEWSLETTER_DEF: SectionDefinition = {
  type:     'newsletter',
  name:     'Newsletter',
  icon:     'Mail',
  description: 'Email sign-up form',
  category: 'Social',
  tier:     'free',
  allowedBlockTypes: ['heading', 'paragraph'],
  settingsSchema: [
    { key: 'placeholder', label: 'Placeholder', type: 'text', default: 'Email address' },
  ],
  defaultBlocks: [
    { type: 'heading',   settings: { text: 'Subscribe to our emails' }, isVisible: true, sortOrder: 1.0 },
    { type: 'paragraph', settings: { text: 'Be the first to know.' },   isVisible: true, sortOrder: 2.0 },
  ],
};

const NO_BLOCK_DEF: SectionDefinition = {
  type:    'brand_story',
  name:    'Brand story',
  icon:    'Quote',
  description: 'Brand story text section',
  category: 'Content',
  tier:    'free',
  allowedBlockTypes: [],   // no blocks allowed
  settingsSchema: [
    { key: 'title', label: 'Title', type: 'text', default: 'Our Story' },
    { key: 'bg',    label: 'BG',   type: 'color', default: '#ffffff' },
  ],
  defaultBlocks: [],       // empty — respects allowedBlockTypes: []
};

const SEED: SectionSeed = {
  type:     'featured_collection',
  label:    'New Arrivals',
  settings: { collection: 'new-arrivals', columnsDesktop: '4', productsToShow: 4 },
  blocks:   [
    { type: 'collection_title', settings: { text: 'New Arrivals' } },
    { type: 'view_all_button',  settings: { label: 'View all' } },
  ],
};

// ─── makeNode ─────────────────────────────────────────────────────────────────

describe('makeNode', () => {
  it('returns a Node with the given type and label', () => {
    const node = makeNode('container', 'My Container');
    expect(node.type).toBe('container');
    expect(node.label).toBe('My Container');
  });

  it('generates a unique id on each call', () => {
    const a = makeNode('stack', 'A');
    const b = makeNode('stack', 'B');
    expect(a.id).not.toBe(b.id);
  });

  it('id starts with "node-"', () => {
    expect(makeNode('grid', 'Grid').id).toMatch(/^node-/);
  });

  it('defaults settings to {}', () => {
    expect(makeNode('spacer', 'Spacer').settings).toEqual({});
  });

  it('accepts custom settings', () => {
    const node = makeNode('grid', 'Grid', { gridCols: 3, gap: 24 });
    expect(node.settings.gridCols).toBe(3);
    expect(node.settings.gap).toBe(24);
  });

  it('defaults children to []', () => {
    expect(makeNode('container', 'Box').children).toEqual([]);
  });

  it('accepts custom children', () => {
    const child = makeNode('heading', 'H1');
    const parent = makeNode('stack', 'Stack', {}, [child]);
    expect(parent.children).toHaveLength(1);
    expect(parent.children![0]).toBe(child);
  });

  it('does not mutate the input settings object', () => {
    const settings = { h: 48 };
    makeNode('spacer', 'S', settings);
    expect(Object.keys(settings)).toHaveLength(1);
  });
});

// ─── createNodeFromDefinition ─────────────────────────────────────────────────

describe('createNodeFromDefinition', () => {
  it('uses def.type and def.name', () => {
    const node = createNodeFromDefinition(HERO_DEF);
    expect(node.type).toBe('hero');
    expect(node.label).toBe('Hero banner');
  });

  it('generates a fresh id', () => {
    const a = createNodeFromDefinition(HERO_DEF);
    const b = createNodeFromDefinition(HERO_DEF);
    expect(a.id).not.toBe(b.id);
  });

  it('populates settings from schema defaults', () => {
    const node = createNodeFromDefinition(HERO_DEF);
    expect(node.settings.height).toBe('md');
    expect(node.settings.overlayOpacity).toBe(40);
    expect(node.settings.backgroundColor).toBe('#1a1a2e');
  });

  it('omits fields without a default value', () => {
    const node = createNodeFromDefinition(HERO_DEF);
    expect('noDefault' in node.settings).toBe(false);
  });

  it('overrideSettings merge on top of defaults', () => {
    const node = createNodeFromDefinition(HERO_DEF, { height: 'full', custom: true });
    expect(node.settings.height).toBe('full');       // overridden
    expect(node.settings.overlayOpacity).toBe(40);   // default preserved
    expect(node.settings.custom).toBe(true);          // extra key added
  });

  it('converts defaultBlocks to children', () => {
    const node = createNodeFromDefinition(HERO_DEF);
    expect(node.children).toHaveLength(2);
    expect(node.children![0].type).toBe('heading');
    expect(node.children![1].type).toBe('button');
  });

  it('child node ids are unique', () => {
    const node = createNodeFromDefinition(HERO_DEF);
    expect(node.children![0].id).not.toBe(node.children![1].id);
  });

  it('child nodes have id starting with "node-"', () => {
    const node = createNodeFromDefinition(HERO_DEF);
    node.children!.forEach((c) => expect(c.id).toMatch(/^node-/));
  });

  it('child settings include _nx_sortOrder from block.sortOrder', () => {
    const node = createNodeFromDefinition(HERO_DEF);
    expect(node.children![0].settings._nx_sortOrder).toBe(1.0);
    expect(node.children![1].settings._nx_sortOrder).toBe(2.0);
  });

  it('child settings preserve original block settings', () => {
    const node = createNodeFromDefinition(HERO_DEF);
    expect(node.children![0].settings.text).toBe('Browse our latest products');
    expect(node.children![1].settings.label).toBe('Shop all');
  });

  it('child nodes have empty children arrays', () => {
    const node = createNodeFromDefinition(HERO_DEF);
    node.children!.forEach((c) => expect(c.children).toEqual([]));
  });

  it('produces empty children for a def with no defaultBlocks', () => {
    const node = createNodeFromDefinition(NO_BLOCK_DEF);
    expect(node.children).toEqual([]);
  });

  it('respects allowedBlockTypes: [] — no children even if definition had blocks', () => {
    const node = createNodeFromDefinition(NO_BLOCK_DEF);
    expect(node.children).toHaveLength(0);
  });

  it('captures newsletter defaults correctly', () => {
    const node = createNodeFromDefinition(NEWSLETTER_DEF);
    expect(node.settings.placeholder).toBe('Email address');
    expect(node.children).toHaveLength(2);
    expect(node.children![0].type).toBe('heading');
    expect(node.children![1].type).toBe('paragraph');
  });
});

// ─── createNodeFromSeed ───────────────────────────────────────────────────────

describe('createNodeFromSeed', () => {
  it('uses seed type and label', () => {
    const node = createNodeFromSeed(SEED);
    expect(node.type).toBe('featured_collection');
    expect(node.label).toBe('New Arrivals');
  });

  it('copies seed settings verbatim', () => {
    const node = createNodeFromSeed(SEED);
    expect(node.settings.collection).toBe('new-arrivals');
    expect(node.settings.columnsDesktop).toBe('4');
    expect(node.settings.productsToShow).toBe(4);
  });

  it('converts seed blocks to child Nodes', () => {
    const node = createNodeFromSeed(SEED);
    expect(node.children).toHaveLength(2);
    expect(node.children![0].type).toBe('collection_title');
    expect(node.children![1].type).toBe('view_all_button');
  });

  it('assigns _nx_sortOrder starting from 1', () => {
    const node = createNodeFromSeed(SEED);
    expect(node.children![0].settings._nx_sortOrder).toBe(1);
    expect(node.children![1].settings._nx_sortOrder).toBe(2);
  });

  it('preserves block settings', () => {
    const node = createNodeFromSeed(SEED);
    expect(node.children![0].settings.text).toBe('New Arrivals');
    expect(node.children![1].settings.label).toBe('View all');
  });

  it('generates unique ids for each call', () => {
    const a = createNodeFromSeed(SEED);
    const b = createNodeFromSeed(SEED);
    expect(a.id).not.toBe(b.id);
    expect(a.children![0].id).not.toBe(b.children![0].id);
  });

  it('handles seed with no blocks', () => {
    const emptySeed: SectionSeed = { type: 'editorial_banner', label: 'Editorial', settings: {}, blocks: [] };
    const node = createNodeFromSeed(emptySeed);
    expect(node.children).toEqual([]);
  });
});

// ─── Cross-function: IDs never collide ───────────────────────────────────────

describe('ID uniqueness across factory functions', () => {
  it('makeNode, createNodeFromDefinition, createNodeFromSeed all produce unique ids', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      ids.add(makeNode('x', 'X').id);
      ids.add(createNodeFromDefinition(HERO_DEF).id);
      ids.add(createNodeFromSeed(SEED).id);
    }
    expect(ids.size).toBe(60);  // all 60 must be unique
  });
});
