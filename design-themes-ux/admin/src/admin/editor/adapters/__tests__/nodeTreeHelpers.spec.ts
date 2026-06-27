import { describe, it, expect } from 'vitest';
import {
  findNode,
  findParent,
  updateNode,
  removeNodeById,
  insertChildNode,
  reorderChildren,
} from '../nodeTreeHelpers';
import type { Node } from '@/components/node-renderer/types';

// ─── Fixture factory ─────────────────────────────────────────────────────────

function n(id: string, children: Node[] = []): Node {
  return { id, type: 'test', settings: {}, children };
}

/**
 * Flat 3-section tree:
 *   root
 *   └── grp_header  (child 0)
 *   └── grp_body    (child 1)
 *       └── sec_hero     (child 0)
 *           └── blk_h1   (child 0)
 *       └── sec_featured (child 1)
 *   └── grp_footer  (child 2)
 */
const BLK_H1 = n('blk_h1');
const SEC_HERO = n('sec_hero', [BLK_H1]);
const SEC_FEATURED = n('sec_featured');
const GRP_HEADER = n('grp_header');
const GRP_BODY = n('grp_body', [SEC_HERO, SEC_FEATURED]);
const GRP_FOOTER = n('grp_footer');
const ROOT = n('root', [GRP_HEADER, GRP_BODY, GRP_FOOTER]);

// ─── findNode ─────────────────────────────────────────────────────────────────

describe('findNode', () => {
  it('finds the root itself', () => {
    expect(findNode(ROOT, 'root')).toBe(ROOT);
  });

  it('finds a direct child', () => {
    expect(findNode(ROOT, 'grp_body')).toBe(GRP_BODY);
  });

  it('finds a deeply nested node', () => {
    expect(findNode(ROOT, 'blk_h1')).toBe(BLK_H1);
  });

  it('returns null for a missing id', () => {
    expect(findNode(ROOT, 'does_not_exist')).toBeNull();
  });

  it('returns null on a leaf node with no match', () => {
    expect(findNode(BLK_H1, 'other')).toBeNull();
  });

  it('finds across multiple branches', () => {
    const tree = n('r', [n('a', [n('x')]), n('b', [n('y'), n('z')])]);
    expect(findNode(tree, 'z')?.id).toBe('z');
  });
});

// ─── findParent ───────────────────────────────────────────────────────────────

describe('findParent', () => {
  it('returns null when childId is the root', () => {
    expect(findParent(ROOT, 'root')).toBeNull();
  });

  it('returns the root when childId is a direct child', () => {
    expect(findParent(ROOT, 'grp_body')).toBe(ROOT);
  });

  it('returns the intermediate parent for a deeply nested node', () => {
    expect(findParent(ROOT, 'blk_h1')).toBe(SEC_HERO);
  });

  it('returns the body group for a top-level section', () => {
    expect(findParent(ROOT, 'sec_hero')).toBe(GRP_BODY);
  });

  it('returns null for a missing id', () => {
    expect(findParent(ROOT, 'ghost')).toBeNull();
  });

  it('does not return the node itself as its own parent', () => {
    expect(findParent(ROOT, 'grp_header')).toBe(ROOT);
    expect(findParent(ROOT, 'grp_header')?.id).not.toBe('grp_header');
  });
});

// ─── updateNode ──────────────────────────────────────────────────────────────

describe('updateNode', () => {
  it('returns a new root when the target is the root', () => {
    const result = updateNode(ROOT, 'root', (node) => ({
      ...node,
      settings: { updated: true },
    }));
    expect(result).not.toBe(ROOT);
    expect(result.settings.updated).toBe(true);
  });

  it('updates a deeply nested node', () => {
    const result = updateNode(ROOT, 'blk_h1', (node) => ({
      ...node,
      label: 'Updated heading',
    }));
    const found = findNode(result, 'blk_h1');
    expect(found?.label).toBe('Updated heading');
  });

  it('returns the SAME root reference when id is not found', () => {
    const result = updateNode(ROOT, 'nonexistent', (n) => ({ ...n, label: 'x' }));
    expect(result).toBe(ROOT);
  });

  it('does not mutate the original tree', () => {
    const originalLabel = SEC_HERO.label;
    updateNode(ROOT, 'sec_hero', (n) => ({ ...n, label: 'mutated' }));
    expect(SEC_HERO.label).toBe(originalLabel);
  });

  it('preserves references for untouched siblings', () => {
    const result = updateNode(ROOT, 'sec_featured', (n) => ({
      ...n,
      settings: { touched: true },
    }));
    // sec_hero was not touched — its reference must be the same
    expect(findNode(result, 'sec_hero')).toBe(SEC_HERO);
    // grp_header was not touched
    expect(findNode(result, 'grp_header')).toBe(GRP_HEADER);
  });

  it('propagates a new root/path through changed ancestors', () => {
    const result = updateNode(ROOT, 'blk_h1', (n) => ({ ...n, label: 'new' }));
    // blk_h1 changed → sec_hero must be new → grp_body must be new → root must be new
    expect(result).not.toBe(ROOT);
    expect(findNode(result, 'grp_body')).not.toBe(GRP_BODY);
    expect(findNode(result, 'sec_hero')).not.toBe(SEC_HERO);
    // Unchanged branches must be same reference
    expect(findNode(result, 'grp_header')).toBe(GRP_HEADER);
    expect(findNode(result, 'grp_footer')).toBe(GRP_FOOTER);
  });
});

// ─── removeNodeById ───────────────────────────────────────────────────────────

describe('removeNodeById', () => {
  it('removes a direct child of the root', () => {
    const result = removeNodeById(ROOT, 'grp_footer');
    expect(findNode(result, 'grp_footer')).toBeNull();
    expect(result.children).toHaveLength(2);
  });

  it('removes a deeply nested node', () => {
    const result = removeNodeById(ROOT, 'blk_h1');
    expect(findNode(result, 'blk_h1')).toBeNull();
    const hero = findNode(result, 'sec_hero');
    expect(hero?.children).toHaveLength(0);
  });

  it('returns the same root reference when id is not found', () => {
    const result = removeNodeById(ROOT, 'ghost');
    expect(result).toBe(ROOT);
  });

  it('does not remove the root itself (returns root unchanged)', () => {
    const result = removeNodeById(ROOT, 'root');
    expect(result).toBe(ROOT);
  });

  it('preserves sibling references after removal', () => {
    const result = removeNodeById(ROOT, 'sec_featured');
    expect(findNode(result, 'sec_hero')).toBe(SEC_HERO);
    expect(findNode(result, 'grp_header')).toBe(GRP_HEADER);
  });

  it('does not mutate the original tree', () => {
    const originalLen = GRP_BODY.children?.length;
    removeNodeById(ROOT, 'sec_hero');
    expect(GRP_BODY.children?.length).toBe(originalLen);
  });
});

// ─── insertChildNode ─────────────────────────────────────────────────────────

describe('insertChildNode', () => {
  it('appends at end when insertAfter is null', () => {
    const newNode = n('sec_new');
    const result = insertChildNode(ROOT, 'grp_body', newNode, null);
    const body = findNode(result, 'grp_body')!;
    expect(body.children!.at(-1)!.id).toBe('sec_new');
    expect(body.children).toHaveLength(3);
  });

  it('inserts after a specific sibling', () => {
    const newNode = n('sec_between');
    const result = insertChildNode(ROOT, 'grp_body', newNode, 'sec_hero');
    const body = findNode(result, 'grp_body')!;
    expect(body.children![0].id).toBe('sec_hero');
    expect(body.children![1].id).toBe('sec_between');
    expect(body.children![2].id).toBe('sec_featured');
  });

  it('appends at end when insertAfter sibling is not found', () => {
    const newNode = n('sec_fallback');
    const result = insertChildNode(ROOT, 'grp_body', newNode, 'nonexistent_sibling');
    const body = findNode(result, 'grp_body')!;
    expect(body.children!.at(-1)!.id).toBe('sec_fallback');
  });

  it('inserts into a childless parent', () => {
    const newNode = n('first_footer_section');
    const result = insertChildNode(ROOT, 'grp_footer', newNode, null);
    const footer = findNode(result, 'grp_footer')!;
    expect(footer.children).toHaveLength(1);
    expect(footer.children![0].id).toBe('first_footer_section');
  });

  it('throws when parentId is not found', () => {
    expect(() => insertChildNode(ROOT, 'ghost_parent', n('x'), null))
      .toThrow(/parentId/);
  });

  it('does not mutate the original parent', () => {
    const originalLen = GRP_BODY.children?.length ?? 0;
    insertChildNode(ROOT, 'grp_body', n('z'), null);
    expect(GRP_BODY.children?.length).toBe(originalLen);
  });
});

// ─── reorderChildren ─────────────────────────────────────────────────────────

describe('reorderChildren', () => {
  it('reorders direct children of a parent', () => {
    const result = reorderChildren(ROOT, 'grp_body', ['sec_featured', 'sec_hero']);
    const body = findNode(result, 'grp_body')!;
    expect(body.children![0].id).toBe('sec_featured');
    expect(body.children![1].id).toBe('sec_hero');
  });

  it('preserves node references after reorder', () => {
    const result = reorderChildren(ROOT, 'grp_body', ['sec_featured', 'sec_hero']);
    expect(findNode(result, 'sec_hero')).toBe(SEC_HERO);
    expect(findNode(result, 'sec_featured')).toBe(SEC_FEATURED);
  });

  it('returns SAME parent reference when order is unchanged', () => {
    const result = reorderChildren(ROOT, 'grp_body', ['sec_hero', 'sec_featured']);
    expect(findNode(result, 'grp_body')).toBe(GRP_BODY);
    expect(result).toBe(ROOT);
  });

  it('drops children absent from orderedIds', () => {
    const result = reorderChildren(ROOT, 'grp_body', ['sec_hero']);
    const body = findNode(result, 'grp_body')!;
    expect(body.children).toHaveLength(1);
    expect(body.children![0].id).toBe('sec_hero');
  });

  it('ignores ids in orderedIds that do not exist in children', () => {
    const result = reorderChildren(ROOT, 'grp_body', ['sec_featured', 'ghost', 'sec_hero']);
    const body = findNode(result, 'grp_body')!;
    expect(body.children).toHaveLength(2);
    expect(body.children![0].id).toBe('sec_featured');
    expect(body.children![1].id).toBe('sec_hero');
  });

  it('returns root unchanged when parentId is not found', () => {
    const result = reorderChildren(ROOT, 'nonexistent', ['a', 'b']);
    expect(result).toBe(ROOT);
  });

  it('works on deeply nested parents', () => {
    const child1 = n('c1');
    const child2 = n('c2');
    const parent = n('p', [child1, child2]);
    const tree   = n('tree', [parent]);
    const result = reorderChildren(tree, 'p', ['c2', 'c1']);
    const p = findNode(result, 'p')!;
    expect(p.children![0].id).toBe('c2');
    expect(p.children![1].id).toBe('c1');
  });
});
