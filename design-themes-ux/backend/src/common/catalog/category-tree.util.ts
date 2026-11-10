import { PrismaClient } from '@prisma/client';
import { PerfTimer } from '@/common/perf-timer.util';
import type { CacheService } from '@/shared/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@/shared/cache/cache.constants';

export interface Breadcrumb { label: string; url: string }

/**
 * A store's whole category set, flat. Small enough (dozens–low hundreds of
 * rows for any real catalog) to load in one query and cache as a unit —
 * every per-category-page operation that used to be its own DB round trip
 * (slug resolution, descendant-subtree lookup, breadcrumb parent walk,
 * metadata fetch) is derived from this single array in memory instead.
 */
export interface CategoryTreeNode {
  id:              string;
  name:            string;
  slug:            string;
  parentId:        string | null;
  description:     string | null;
  metaTitle:       string | null;
  metaDescription: string | null;
}

/**
 * Loads every non-deleted category for a store as a flat array, Redis-cached
 * per store (invalidated on any category create/update/delete/move/merge —
 * see CategoriesService). Passing `cache` is optional so callers without a
 * CacheService handy (or in contexts where DI isn't wired) still work,
 * just without the caching benefit.
 */
export async function loadCategoryTree(
  prisma:  PrismaClient,
  storeId: string,
  cache?:  CacheService,
  timer?:  PerfTimer,
): Promise<CategoryTreeNode[]> {
  const cacheKey = CACHE_KEYS.categoryTree(storeId);

  if (cache) {
    const cached = timer
      ? await timer.time('categoryTreeCache', () => cache.get<CategoryTreeNode[]>(cacheKey))
      : await cache.get<CategoryTreeNode[]>(cacheKey);
    if (cached) return cached;
  }

  const fetch = () => prisma.category.findMany({
    where:  { storeId, deletedAt: null },
    select: { id: true, name: true, slug: true, parentId: true, description: true, metaTitle: true, metaDescription: true },
  });
  const tree = timer ? await timer.time('categoryTreeDb', fetch) : await fetch();

  if (cache) await cache.set(cacheKey, tree, CACHE_TTL.CATEGORY_TREE);
  return tree;
}

export function findCategoryInTree(tree: CategoryTreeNode[], slug: string): CategoryTreeNode | null {
  return tree.find((c) => c.slug === slug) ?? null;
}

/**
 * Root id plus every descendant id, breadth-first, capped at depth 5 —
 * same limit as the old DB-walking version, kept for parity/cycle-safety.
 * Pure in-memory now that the whole tree is already loaded.
 */
export function collectDescendantIdsFromTree(tree: CategoryTreeNode[], rootId: string): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const c of tree) {
    if (!c.parentId) continue;
    const list = childrenByParent.get(c.parentId) ?? [];
    list.push(c.id);
    childrenByParent.set(c.parentId, list);
  }

  const ids = [rootId];
  let frontier = [rootId];
  for (let depth = 0; depth < 5 && frontier.length > 0; depth++) {
    const children = frontier.flatMap((id) => childrenByParent.get(id) ?? []);
    if (children.length === 0) break;
    frontier = children;
    ids.push(...frontier);
  }
  return ids;
}

/** Builds a Home → ... → category breadcrumb trail by walking up `parentId` in memory. */
export function buildBreadcrumbTrailFromTree(tree: CategoryTreeNode[], category: CategoryTreeNode): Breadcrumb[] {
  const byId = new Map(tree.map((c) => [c.id, c]));
  const trail: Breadcrumb[] = [{ label: category.name, url: `/category/${category.slug}` }];
  let parentId = category.parentId;
  let depth = 0;
  while (parentId && depth < 5) {
    const parent = byId.get(parentId);
    if (!parent) break;
    trail.unshift({ label: parent.name, url: `/category/${parent.slug}` });
    parentId = parent.parentId;
    depth++;
  }
  return [{ label: 'Home', url: '/' }, ...trail];
}
