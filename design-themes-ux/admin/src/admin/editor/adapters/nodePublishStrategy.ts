/**
 * Phase 6 Step 5 — Node publish and discard strategy
 *
 * Pure async functions — no React, no dispatch.
 * Callers (EditorTopBar) dispatch state updates and show toasts.
 *
 * Publish flow:
 *   handleNodePublish(storeId, themeId, pageId)
 *     → POST /content/{storeId}/{themeId}/{pageId}/publish
 *     → Returns { newVersion, publishedAt, snapshotId }
 *     → Caller dispatches SET_NODE_DOCUMENT_VERSION(newVersion)
 *
 * Discard flow:
 *   handleNodeDiscard(storeId, themeId, pageId)
 *     → POST /content/{storeId}/{themeId}/{pageId}/discard
 *     → 404 is handled gracefully (no published version exists — no-op)
 *     → Caller then calls reloadFromApi() which runs the Step 3 load flow
 *
 * Neither function modifies editor state directly.
 */

import { themeEngineService } from '@/services/themeEngineService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NodePublishResult {
  newVersion:  number;
  publishedAt: string;
  snapshotId:  string | null;
}

// ─── handleNodePublish ────────────────────────────────────────────────────────

/**
 * Publish the DRAFT PageDocument to PUBLISHED.
 *
 * This is called alongside themeEngineService.publish() in node mode.
 * Both must succeed for a complete "Go Live" operation.
 *
 * The returned newVersion should be dispatched as SET_NODE_DOCUMENT_VERSION
 * so the editor tracks the correct post-publish version.
 *
 * @throws  Any network / server error — caller shows the error toast.
 */
export async function handleNodePublish(
  storeId: string,
  themeId: string,
  pageId:  string,
): Promise<NodePublishResult> {
  const result = await themeEngineService.publishPageDocument(storeId, themeId, pageId);
  return {
    newVersion:  result.version,
    publishedAt: result.publishedAt,
    snapshotId:  result.snapshotId,
  };
}

// ─── handleNodeDiscard ────────────────────────────────────────────────────────

/**
 * Revert the DRAFT PageDocument to the last PUBLISHED version.
 *
 * This is called alongside themeEngineService.discardDraft() in node mode.
 * Both must be called to fully revert (theme config + page content).
 *
 * A 404 response (no published version exists) is treated as a no-op:
 * discardPageDocument() handles this gracefully internally.
 *
 * After this call, the editor should call reloadFromApi() which will reload
 * the node tree via the Step 3 loadPage() flow (loadPageDocument → SET_NODE_TREE).
 *
 * @throws  Non-404 errors — caller shows the error toast.
 */
export async function handleNodeDiscard(
  storeId: string,
  themeId: string,
  pageId:  string,
): Promise<void> {
  await themeEngineService.discardPageDocument(storeId, themeId, pageId);
}
