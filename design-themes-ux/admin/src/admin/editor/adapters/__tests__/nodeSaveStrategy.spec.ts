/**
 * Unit tests for handleNodeSave() — Phase 6 Step 4.
 *
 * themeEngineService is mocked with vi.importActual so the real
 * DocumentVersionConflictError class is preserved.  Only savePageDocument
 * and loadPageDocument are replaced with vi.fn().
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleNodeSave } from '../nodeSaveStrategy';
import { DocumentVersionConflictError } from '@/services/themeEngineService';

// ─── Mock ─────────────────────────────────────────────────────────────────────
// Keep the real DocumentVersionConflictError (for instanceof checks) but
// replace the network-touching service methods with vi.fn().

vi.mock('@/services/themeEngineService', async () => {
  const actual = await vi.importActual<typeof import('@/services/themeEngineService')>(
    '@/services/themeEngineService',
  );
  return {
    ...actual,
    themeEngineService: {
      ...actual.themeEngineService,
      savePageDocument: vi.fn(),
      loadPageDocument: vi.fn(),
    },
  };
});

import { themeEngineService, type PageDocumentData } from '@/services/themeEngineService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STORE_ID = 'store_abc';
const THEME_ID = 'dawn';
const PAGE_ID  = 'home';

const TREE = {
  id:       'root_home',
  type:     'page_root',
  settings: { pageId: 'home' },
  children: [],
} as any;  // Node type

const SAVED_DOC: PageDocumentData = {
  storeId:       STORE_ID,
  themeId:       THEME_ID,
  scope:         'PAGE',
  ownerKey:      PAGE_ID,
  status:        'DRAFT',
  version:       4,
  schemaVersion: 1,
  tree:          TREE,
};

const FRESH_DOC: PageDocumentData = {
  ...SAVED_DOC,
  version: 7,
  tree: { ...TREE, children: [{ id: 'c1', type: 'hero', settings: {}, children: [] }] },
};

// NOTE: mocks return PageDocumentData directly because savePageDocument() and
// loadPageDocument() in themeEngineService.ts unwrap the HTTP response internally.
// The mock replaces the already-unwrapped service method, not the raw api call.

// ─── Successful save ──────────────────────────────────────────────────────────

describe('handleNodeSave — successful save', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns status saved on 200 response', async () => {
    vi.mocked(themeEngineService.savePageDocument).mockResolvedValueOnce(SAVED_DOC as any);

    const result = await handleNodeSave(STORE_ID, THEME_ID, PAGE_ID, TREE, 3);
    expect(result.status).toBe('saved');
  });

  it('returns the new version from the server response', async () => {
    vi.mocked(themeEngineService.savePageDocument).mockResolvedValueOnce(SAVED_DOC as any);

    const result = await handleNodeSave(STORE_ID, THEME_ID, PAGE_ID, TREE, 3);
    if (result.status === 'saved') {
      expect(result.newVersion).toBe(4);
    }
  });

  it('calls savePageDocument with correct arguments', async () => {
    vi.mocked(themeEngineService.savePageDocument).mockResolvedValueOnce(SAVED_DOC as any);

    await handleNodeSave(STORE_ID, THEME_ID, PAGE_ID, TREE, 3);

    expect(themeEngineService.savePageDocument).toHaveBeenCalledWith(
      STORE_ID, THEME_ID, PAGE_ID, TREE, 3,
    );
  });

  it('does NOT call loadPageDocument on success', async () => {
    vi.mocked(themeEngineService.savePageDocument).mockResolvedValueOnce(SAVED_DOC as any);

    await handleNodeSave(STORE_ID, THEME_ID, PAGE_ID, TREE, 3);

    expect(themeEngineService.loadPageDocument).not.toHaveBeenCalled();
  });
});

// ─── First-time save (version=0) ─────────────────────────────────────────────

describe('handleNodeSave — first-time save (version=0)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns status saved when document is created for the first time', async () => {
    const firstDoc = { ...SAVED_DOC, version: 1 };
    vi.mocked(themeEngineService.savePageDocument).mockResolvedValueOnce(firstDoc as any);

    const result = await handleNodeSave(STORE_ID, THEME_ID, PAGE_ID, TREE, 0);
    expect(result.status).toBe('saved');
    if (result.status === 'saved') {
      expect(result.newVersion).toBe(1);
    }
  });

  it('sends version=0 in the request', async () => {
    const firstDoc = { ...SAVED_DOC, version: 1 };
    vi.mocked(themeEngineService.savePageDocument).mockResolvedValueOnce(firstDoc as any);

    await handleNodeSave(STORE_ID, THEME_ID, PAGE_ID, TREE, 0);

    const [,,,, sentVersion] = vi.mocked(themeEngineService.savePageDocument).mock.calls[0];
    expect(sentVersion).toBe(0);
  });
});

// ─── Version increment ────────────────────────────────────────────────────────

describe('handleNodeSave — version increment chain', () => {
  beforeEach(() => vi.clearAllMocks());

  it('version increments by 1 on each successful save', async () => {
    const versions = [1, 2, 3];
    for (const v of versions) {
      vi.mocked(themeEngineService.savePageDocument).mockResolvedValueOnce(
        { ...SAVED_DOC, version: v } as any,
      );
    }

    const r1 = await handleNodeSave(STORE_ID, THEME_ID, PAGE_ID, TREE, 0);
    const r2 = await handleNodeSave(STORE_ID, THEME_ID, PAGE_ID, TREE, 1);
    const r3 = await handleNodeSave(STORE_ID, THEME_ID, PAGE_ID, TREE, 2);

    expect(r1.status === 'saved' && r1.newVersion).toBe(1);
    expect(r2.status === 'saved' && r2.newVersion).toBe(2);
    expect(r3.status === 'saved' && r3.newVersion).toBe(3);
  });
});

// ─── 409 Conflict — successful reload ────────────────────────────────────────

describe('handleNodeSave — 409 conflict with successful reload', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns status conflict when 409 and reload succeeds', async () => {
    vi.mocked(themeEngineService.savePageDocument).mockRejectedValueOnce(
      new DocumentVersionConflictError(7),
    );
    vi.mocked(themeEngineService.loadPageDocument).mockResolvedValueOnce(FRESH_DOC as any);

    const result = await handleNodeSave(STORE_ID, THEME_ID, PAGE_ID, TREE, 3);
    expect(result.status).toBe('conflict');
  });

  it('returns fresh tree from reload', async () => {
    vi.mocked(themeEngineService.savePageDocument).mockRejectedValueOnce(
      new DocumentVersionConflictError(7),
    );
    vi.mocked(themeEngineService.loadPageDocument).mockResolvedValueOnce(FRESH_DOC as any);

    const result = await handleNodeSave(STORE_ID, THEME_ID, PAGE_ID, TREE, 3);
    if (result.status === 'conflict') {
      expect(result.freshTree).toBe(FRESH_DOC.tree);
    }
  });

  it('returns fresh version from reload', async () => {
    vi.mocked(themeEngineService.savePageDocument).mockRejectedValueOnce(
      new DocumentVersionConflictError(7),
    );
    vi.mocked(themeEngineService.loadPageDocument).mockResolvedValueOnce(FRESH_DOC as any);

    const result = await handleNodeSave(STORE_ID, THEME_ID, PAGE_ID, TREE, 3);
    if (result.status === 'conflict') {
      expect(result.freshVersion).toBe(7);
    }
  });

  it('calls loadPageDocument with same storeId/themeId/pageId on conflict', async () => {
    vi.mocked(themeEngineService.savePageDocument).mockRejectedValueOnce(
      new DocumentVersionConflictError(7),
    );
    vi.mocked(themeEngineService.loadPageDocument).mockResolvedValueOnce(FRESH_DOC as any);

    await handleNodeSave(STORE_ID, THEME_ID, PAGE_ID, TREE, 3);

    expect(themeEngineService.loadPageDocument).toHaveBeenCalledWith(STORE_ID, THEME_ID, PAGE_ID);
  });
});

// ─── 409 Conflict — reload also fails ────────────────────────────────────────

describe('handleNodeSave — 409 conflict AND reload fails', () => {
  beforeEach(() => vi.clearAllMocks());

  it('re-throws DocumentVersionConflictError when reload returns null', async () => {
    vi.mocked(themeEngineService.savePageDocument).mockRejectedValueOnce(
      new DocumentVersionConflictError(5),
    );
    vi.mocked(themeEngineService.loadPageDocument).mockResolvedValueOnce(null as any);

    await expect(
      handleNodeSave(STORE_ID, THEME_ID, PAGE_ID, TREE, 3),
    ).rejects.toBeInstanceOf(DocumentVersionConflictError);
  });

  it('re-throws DocumentVersionConflictError when reload itself throws', async () => {
    vi.mocked(themeEngineService.savePageDocument).mockRejectedValueOnce(
      new DocumentVersionConflictError(5),
    );
    vi.mocked(themeEngineService.loadPageDocument).mockRejectedValueOnce(
      new Error('Network error'),
    );

    await expect(
      handleNodeSave(STORE_ID, THEME_ID, PAGE_ID, TREE, 3),
    ).rejects.toBeInstanceOf(DocumentVersionConflictError);
  });
});

// ─── Non-conflict errors ──────────────────────────────────────────────────────

describe('handleNodeSave — non-conflict errors', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rethrows network errors without calling loadPageDocument', async () => {
    const networkErr = { response: { status: 503 } };
    vi.mocked(themeEngineService.savePageDocument).mockRejectedValueOnce(networkErr);

    await expect(
      handleNodeSave(STORE_ID, THEME_ID, PAGE_ID, TREE, 3),
    ).rejects.toBe(networkErr);

    expect(themeEngineService.loadPageDocument).not.toHaveBeenCalled();
  });

  it('rethrows 401 auth errors', async () => {
    const authErr = { response: { status: 401 } };
    vi.mocked(themeEngineService.savePageDocument).mockRejectedValueOnce(authErr);

    await expect(
      handleNodeSave(STORE_ID, THEME_ID, PAGE_ID, TREE, 3),
    ).rejects.toBe(authErr);
  });

  it('rethrows generic JS errors', async () => {
    const jsErr = new Error('Unexpected error');
    vi.mocked(themeEngineService.savePageDocument).mockRejectedValueOnce(jsErr);

    await expect(
      handleNodeSave(STORE_ID, THEME_ID, PAGE_ID, TREE, 3),
    ).rejects.toBe(jsErr);
  });
});
