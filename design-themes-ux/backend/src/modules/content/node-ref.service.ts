import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigStatus, DocScope, RefType } from '@prisma/client';
import type { Node } from './transforms/types';

// ─── Settings keys that hold entity references ────────────────────────────────
// When a node's settings contain these keys, we emit a NodeRef row so the
// reverse-lookup index stays current without scanning JSON at query time.

const COLLECTION_KEYS = ['collectionId', 'collection', 'collectionHandle'];
const PRODUCT_KEYS    = ['productId', 'product'];
const MENU_KEYS       = ['menuHandle', 'menu', 'menuId'];
const PAGE_KEYS       = ['pageHandle', 'pageId', 'link', 'href'];

@Injectable()
export class NodeRefService {
  private readonly logger = new Logger(NodeRefService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomically rebuilds all NodeRef rows for one document.
   * Called inside the same transaction as the document save.
   *
   * Steps:
   *   1. Delete all existing refs for (documentId, status)
   *   2. Walk the node tree, collect all references
   *   3. Bulk-insert the new ref rows
   *
   * This is O(nodes) per save — acceptable because pages have < 500 nodes
   * and saves are merchant-triggered (not high-frequency writes).
   */
  async rebuild(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    opts: {
      storeId:      string;
      documentId:   string;
      documentType: DocScope;
      ownerKey:     string;
      status:       ConfigStatus;
      tree:         Node;
    },
  ): Promise<void> {
    const { storeId, documentId, documentType, ownerKey, status, tree } = opts;

    // 1. Wipe existing refs for this document + status
    await (tx as any).nodeRef.deleteMany({
      where: { documentId, status },
    });

    // 2. Collect refs by walking the tree
    const refs = this.collectRefs(tree, '', storeId, documentId, documentType, ownerKey, status);

    if (refs.length === 0) return;

    // 3. Bulk insert
    await (tx as any).nodeRef.createMany({ data: refs, skipDuplicates: true });

    this.logger.debug(
      `NodeRef rebuilt: ${refs.length} refs for document ${documentId} (${status})`,
    );
  }

  /**
   * Reverse lookup — answers "which documents reference this entity?"
   * Used by: cache invalidation, symbol fan-out on publish, cascade-delete warnings.
   */
  async findDocumentsReferencingEntity(
    storeId: string,
    refType: RefType,
    refId:   string,
  ): Promise<{ documentId: string; ownerKey: string; documentType: DocScope }[]> {
    const refs = await this.prisma.nodeRef.findMany({
      where:  { storeId, refType, refId },
      select: { documentId: true, ownerKey: true, documentType: true },
      distinct: ['documentId'],
    });
    return refs;
  }

  // ── Tree walker ──────────────────────────────────────────────────────────────

  private collectRefs(
    node:         Node,
    path:         string,
    storeId:      string,
    documentId:   string,
    documentType: DocScope,
    ownerKey:     string,
    status:       ConfigStatus,
  ): object[] {
    const rows: object[] = [];
    const currentPath = path ? `${path}/${node.id}` : node.id;

    const makeRef = (refType: RefType, refId: string) => ({
      storeId,
      documentId,
      documentType,
      ownerKey,
      status,
      refType,
      refId,
      nodePath: currentPath,
    });

    // Component type reference — every node references its ComponentDefinition
    rows.push(makeRef('COMPONENT', node.type));

    // Symbol instance
    if (node.symbolRef?.handle) {
      rows.push(makeRef('SYMBOL', node.symbolRef.handle));
    }

    // Binding references
    if (node.binding) {
      if (node.binding.kind === 'list') {
        const b = node.binding;
        if (b.source === 'collection' && b.ref.mode === 'fixed') {
          rows.push(makeRef('COLLECTION', b.ref.id));
        } else if (b.source === 'products' && b.ref.mode === 'fixed') {
          rows.push(makeRef('PRODUCT', b.ref.id));
        } else if (b.source === 'menu' && b.ref.mode === 'fixed') {
          rows.push(makeRef('MENU', b.ref.id));
        }
      }
    }

    // Settings-level entity references (for current ThemePageSection model
    // where bindings live in settings rather than a typed binding field)
    const s = node.settings;
    if (s && typeof s === 'object') {
      for (const key of COLLECTION_KEYS) {
        if (s[key] && typeof s[key] === 'string') {
          rows.push(makeRef('COLLECTION', s[key] as string));
        }
      }
      for (const key of PRODUCT_KEYS) {
        if (s[key] && typeof s[key] === 'string') {
          rows.push(makeRef('PRODUCT', s[key] as string));
        }
      }
      for (const key of MENU_KEYS) {
        if (s[key] && typeof s[key] === 'string') {
          rows.push(makeRef('MENU', s[key] as string));
        }
      }
      for (const key of PAGE_KEYS) {
        const v = s[key];
        if (v && typeof v === 'string' && v.startsWith('/pages/')) {
          rows.push(makeRef('PAGE', v));
        }
      }
    }

    // Recurse into children
    for (const child of node.children ?? []) {
      rows.push(...this.collectRefs(child, currentPath, storeId, documentId, documentType, ownerKey, status));
    }

    return rows;
  }
}
