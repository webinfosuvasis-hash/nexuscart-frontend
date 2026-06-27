/**
 * Phase 6 Step 4 — Node save strategy
 *
 * Handles the async save attempt for a ContentNode document, including
 * automatic conflict resolution on 409.
 *
 * Design goals:
 *  - Single responsibility: only the save + conflict-reload logic lives here.
 *  - Testable: accepts no React, no dispatch — returns a plain result union.
 *  - Callers (EditorTopBar.performSave) dispatch state updates and show toasts.
 *
 * Flow:
 *
 *   1. Call savePageDocument(version=N)
 *      ├── Success (200) → { status: 'saved', newVersion: N+1 }
 *      └── 409 Conflict  → reload PageDocument, then:
 *            ├── Reload OK  → { status: 'conflict', freshTree, freshVersion }
 *            └── Reload fail → re-throw DocumentVersionConflictError
 *
 *   Callers handle each status:
 *     'saved'    → dispatch SET_NODE_DOCUMENT_VERSION + MARK_SAVED
 *     'conflict' → dispatch SET_NODE_TREE + SET_NODE_DOCUMENT_VERSION + toast.warning
 */

import { themeEngineService, DocumentVersionConflictError } from '@/services/themeEngineService';
import type { Node } from '@/components/node-renderer/types';

// ─── Result types ─────────────────────────────────────────────────────────────

/** The save succeeded. `newVersion` is the server-assigned version to store in state. */
export interface SavedResult {
  status:     'saved';
  newVersion: number;
}

/**
 * A 409 Conflict was resolved by reloading the latest PageDocument.
 * The caller should replace state.nodeTree and state.nodeDocumentVersion
 * with these fresh values and inform the merchant.
 */
export interface ConflictResult {
  status:       'conflict';
  freshTree:    Record<string, unknown>;
  freshVersion: number;
}

export type NodeSaveResult = SavedResult | ConflictResult;

// ─── handleNodeSave ───────────────────────────────────────────────────────────

/**
 * Attempt to save a ContentNode tree to the PageDocument endpoint.
 *
 * @param storeId  Tenant store ID (from AuthContext user.storeId).
 * @param themeId  Active theme ID (from EditorState.activeTheme).
 * @param pageId   ownerKey / page ID (e.g. 'home', 'product').
 * @param tree     The root ContentNode to persist.
 * @param version  Current client version (from state.nodeDocumentVersion).
 *                 Pass 0 for a first-time save — the backend creates the row.
 *
 * @returns  NodeSaveResult — either a successful save or a resolved conflict.
 * @throws   DocumentVersionConflictError if conflict AND reload also fails.
 * @throws   Any other error from the network / server.
 */
export async function handleNodeSave(
  storeId:  string,
  themeId:  string,
  pageId:   string,
  tree:     Node,
  version:  number,
): Promise<NodeSaveResult> {
  try {
    const saved = await themeEngineService.savePageDocument(
      storeId,
      themeId,
      pageId,
      tree as unknown as Record<string, unknown>,
      version,
    );
    return { status: 'saved', newVersion: saved.version };

  } catch (err) {
    if (!(err instanceof DocumentVersionConflictError)) {
      throw err;   // network error, auth error, etc. — caller handles
    }

    // 409 Conflict: another client (or the merchant on another device) has
    // saved a newer version since the editor last loaded / saved.
    // Attempt to reload the latest PageDocument so the editor stays current.
    const fresh = await themeEngineService
      .loadPageDocument(storeId, themeId, pageId)
      .catch(() => null);

    if (fresh) {
      return {
        status:       'conflict',
        freshTree:    fresh.tree,
        freshVersion: fresh.version,
      };
    }

    // Reload also failed — we cannot resolve the conflict automatically.
    // Re-throw so the caller can show a hard error.
    throw err;
  }
}
