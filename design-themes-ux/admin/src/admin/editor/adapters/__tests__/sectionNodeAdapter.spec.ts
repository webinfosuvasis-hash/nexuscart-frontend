import { describe, it, expect } from 'vitest';
import {
  blockToNode,
  nodeToBlockDoc,
  sectionToNode,
  nodeToSectionDoc,
} from '../sectionNodeAdapter';
import type { BlockDoc, SectionDoc } from '@/admin/editor/types';
import type { Node } from '@/components/node-renderer/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VISIBLE_BLOCK: BlockDoc = {
  id:        'blk_001',
  type:      'heading',
  settings:  { text: 'Hello world', textColor: '#ffffff' },
  isVisible: true,
  isRequired:false,
  sortOrder: 1.0,
};

const INVISIBLE_BLOCK: BlockDoc = {
  id:        'blk_002',
  type:      'paragraph',
  settings:  { text: 'Body copy' },
  isVisible: false,
  sortOrder: 2.0,
};

const REQUIRED_BLOCK: BlockDoc = {
  id:        'blk_003',
  type:      'logo',
  settings:  { width: 120, altText: 'Store logo' },
  isVisible: true,
  isRequired:true,
  sortOrder: 1.0,
};

const BASIC_SECTION: SectionDoc = {
  id:       'sec_001',
  type:     'hero',
  label:    'Hero Banner',
  settings: { backgroundImage: 'https://example.com/bg.jpg', height: 'md' },
  isVisible:true,
  blocks:   [VISIBLE_BLOCK, INVISIBLE_BLOCK],
};

const SYSTEM_SECTION: SectionDoc = {
  id:         'sec_hdr_001',
  type:       'header',
  label:      'Header',
  settings:   { stickyMode: 'scroll_up', logoPosition: 'left' },
  isVisible:  true,
  isSystem:   true,
  groupHandle:'header',
  blocks:     [REQUIRED_BLOCK],
};

const INVISIBLE_SECTION: SectionDoc = {
  id:       'sec_004',
  type:     'newsletter',
  label:    'Newsletter',
  settings: { buttonLabel: 'Subscribe' },
  isVisible:false,
  blocks:   [],
};

// ─── blockToNode ──────────────────────────────────────────────────────────────

describe('blockToNode', () => {
  it('preserves id, type, and public settings', () => {
    const node = blockToNode(VISIBLE_BLOCK);
    expect(node.id).toBe('blk_001');
    expect(node.type).toBe('heading');
    expect(node.settings.text).toBe('Hello world');
    expect(node.settings.textColor).toBe('#ffffff');
  });

  it('encodes sortOrder in _nx_sortOrder', () => {
    const node = blockToNode(VISIBLE_BLOCK);
    expect(node.settings._nx_sortOrder).toBe(1.0);
  });

  it('encodes isRequired: false in _nx_isRequired', () => {
    const node = blockToNode(VISIBLE_BLOCK);
    expect(node.settings._nx_isRequired).toBe(false);
  });

  it('encodes isRequired: true in _nx_isRequired', () => {
    const node = blockToNode(REQUIRED_BLOCK);
    expect(node.settings._nx_isRequired).toBe(true);
  });

  it('omits isRequired when undefined on source block', () => {
    const block: BlockDoc = { id: 'b', type: 't', settings: {}, isVisible: true, sortOrder: 1 };
    const node = blockToNode(block);
    expect('_nx_isRequired' in node.settings).toBe(false);
  });

  it('sets children to empty array', () => {
    expect(blockToNode(VISIBLE_BLOCK).children).toEqual([]);
  });

  it('omits visibility when isVisible is true', () => {
    const node = blockToNode(VISIBLE_BLOCK);
    expect(node.visibility).toBeUndefined();
  });

  it('sets all-false visibility when isVisible is false', () => {
    const node = blockToNode(INVISIBLE_BLOCK);
    expect(node.visibility).toEqual({ desktop: false, tablet: false, mobile: false });
  });
});

// ─── nodeToBlockDoc ───────────────────────────────────────────────────────────

describe('nodeToBlockDoc', () => {
  it('restores id, type, and stripped settings', () => {
    const node = blockToNode(VISIBLE_BLOCK);
    const block = nodeToBlockDoc(node, 99);
    expect(block.id).toBe('blk_001');
    expect(block.type).toBe('heading');
    expect(block.settings.text).toBe('Hello world');
    expect('_nx_sortOrder' in block.settings).toBe(false);
    expect('_nx_isRequired' in block.settings).toBe(false);
  });

  it('restores sortOrder from _nx_sortOrder metadata', () => {
    const block = nodeToBlockDoc(blockToNode(VISIBLE_BLOCK), 99);
    expect(block.sortOrder).toBe(1.0);
  });

  it('uses fallbackSortOrder when _nx_sortOrder is absent', () => {
    const node: Node = { id: 'x', type: 'text', settings: {}, children: [] };
    const block = nodeToBlockDoc(node, 5);
    expect(block.sortOrder).toBe(5);
  });

  it('restores isRequired: false', () => {
    const block = nodeToBlockDoc(blockToNode(VISIBLE_BLOCK), 1);
    expect(block.isRequired).toBe(false);
  });

  it('restores isRequired: true', () => {
    const block = nodeToBlockDoc(blockToNode(REQUIRED_BLOCK), 1);
    expect(block.isRequired).toBe(true);
  });

  it('omits isRequired when not encoded', () => {
    const node: Node = { id: 'x', type: 'text', settings: {}, children: [] };
    const block = nodeToBlockDoc(node, 1);
    expect(block.isRequired).toBeUndefined();
  });

  it('restores isVisible: true when visibility is omitted', () => {
    const block = nodeToBlockDoc(blockToNode(VISIBLE_BLOCK), 1);
    expect(block.isVisible).toBe(true);
  });

  it('restores isVisible: false when visibility is all-false', () => {
    const block = nodeToBlockDoc(blockToNode(INVISIBLE_BLOCK), 1);
    expect(block.isVisible).toBe(false);
  });
});

// ─── blockToNode / nodeToBlockDoc round-trip ─────────────────────────────────

describe('block round-trip (blockToNode → nodeToBlockDoc)', () => {
  const fixtures: BlockDoc[] = [VISIBLE_BLOCK, INVISIBLE_BLOCK, REQUIRED_BLOCK];

  for (const original of fixtures) {
    it(`is lossless for block "${original.id}"`, () => {
      const restored = nodeToBlockDoc(blockToNode(original), original.sortOrder);
      expect(restored).toEqual(original);
    });
  }
});

// ─── sectionToNode ────────────────────────────────────────────────────────────

describe('sectionToNode', () => {
  it('preserves id, type, label, and public settings', () => {
    const node = sectionToNode(BASIC_SECTION);
    expect(node.id).toBe('sec_001');
    expect(node.type).toBe('hero');
    expect(node.label).toBe('Hero Banner');
    expect(node.settings.backgroundImage).toBe('https://example.com/bg.jpg');
    expect(node.settings.height).toBe('md');
  });

  it('converts blocks to children in order', () => {
    const node = sectionToNode(BASIC_SECTION);
    expect(node.children).toHaveLength(2);
    expect(node.children![0].id).toBe('blk_001');
    expect(node.children![1].id).toBe('blk_002');
  });

  it('encodes isSystem: true in _nx_isSystem', () => {
    const node = sectionToNode(SYSTEM_SECTION);
    expect(node.settings._nx_isSystem).toBe(true);
  });

  it('does NOT add _nx_isSystem when isSystem is undefined', () => {
    const node = sectionToNode(BASIC_SECTION);
    expect('_nx_isSystem' in node.settings).toBe(false);
  });

  it('encodes groupHandle in _nx_groupHandle', () => {
    const node = sectionToNode(SYSTEM_SECTION);
    expect(node.settings._nx_groupHandle).toBe('header');
  });

  it('does NOT add _nx_groupHandle when groupHandle is undefined', () => {
    const node = sectionToNode(BASIC_SECTION);
    expect('_nx_groupHandle' in node.settings).toBe(false);
  });

  it('omits visibility when isVisible is true', () => {
    const node = sectionToNode(BASIC_SECTION);
    expect(node.visibility).toBeUndefined();
  });

  it('sets all-false visibility when isVisible is false', () => {
    const node = sectionToNode(INVISIBLE_SECTION);
    expect(node.visibility).toEqual({ desktop: false, tablet: false, mobile: false });
  });

  it('handles section with no blocks', () => {
    const node = sectionToNode(INVISIBLE_SECTION);
    expect(node.children).toEqual([]);
  });
});

// ─── nodeToSectionDoc ─────────────────────────────────────────────────────────

describe('nodeToSectionDoc', () => {
  it('restores id, type, label, and stripped settings', () => {
    const section = nodeToSectionDoc(sectionToNode(BASIC_SECTION));
    expect(section.id).toBe('sec_001');
    expect(section.type).toBe('hero');
    expect(section.label).toBe('Hero Banner');
    expect(section.settings.backgroundImage).toBe('https://example.com/bg.jpg');
    expect('_nx_isSystem' in section.settings).toBe(false);
    expect('_nx_groupHandle' in section.settings).toBe(false);
  });

  it('restores isSystem: true', () => {
    const section = nodeToSectionDoc(sectionToNode(SYSTEM_SECTION));
    expect(section.isSystem).toBe(true);
  });

  it('omits isSystem when not encoded', () => {
    const section = nodeToSectionDoc(sectionToNode(BASIC_SECTION));
    expect(section.isSystem).toBeUndefined();
  });

  it('restores groupHandle', () => {
    const section = nodeToSectionDoc(sectionToNode(SYSTEM_SECTION));
    expect(section.groupHandle).toBe('header');
  });

  it('omits groupHandle when not encoded', () => {
    const section = nodeToSectionDoc(sectionToNode(BASIC_SECTION));
    expect(section.groupHandle).toBeUndefined();
  });

  it('restores isVisible: true', () => {
    expect(nodeToSectionDoc(sectionToNode(BASIC_SECTION)).isVisible).toBe(true);
  });

  it('restores isVisible: false', () => {
    expect(nodeToSectionDoc(sectionToNode(INVISIBLE_SECTION)).isVisible).toBe(false);
  });

  it('restores children as blocks with correct sortOrder', () => {
    const section = nodeToSectionDoc(sectionToNode(BASIC_SECTION));
    expect(section.blocks).toHaveLength(2);
    expect(section.blocks[0].sortOrder).toBe(1.0);
    expect(section.blocks[1].sortOrder).toBe(2.0);
  });

  it('falls back to node.type when label is absent', () => {
    const node: Node = { id: 'x', type: 'brand_story', settings: {}, children: [] };
    expect(nodeToSectionDoc(node).label).toBe('brand_story');
  });
});

// ─── sectionToNode / nodeToSectionDoc round-trip ──────────────────────────────

describe('section round-trip (sectionToNode → nodeToSectionDoc)', () => {
  const fixtures: SectionDoc[] = [BASIC_SECTION, SYSTEM_SECTION, INVISIBLE_SECTION];

  for (const original of fixtures) {
    it(`is lossless for section "${original.id}"`, () => {
      const restored = nodeToSectionDoc(sectionToNode(original));
      expect(restored).toEqual(original);
    });
  }
});
