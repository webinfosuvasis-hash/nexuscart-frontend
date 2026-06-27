/**
 * Unit tests for the four PageDocument service methods (Phase 6 Step 2).
 *
 * api is mocked so these tests run without a live backend.
 * Each test verifies:
 *   1. The correct URL is called.
 *   2. The correct HTTP method is used.
 *   3. The request payload matches the expected shape.
 *   4. The response is unwrapped and returned correctly.
 *   5. Error cases are handled as documented.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  themeEngineService,
  DocumentVersionConflictError,
  type PageDocumentData,
} from '../themeEngineService';

// ─── Mock api module ──────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  default: {
    get:   vi.fn(),
    patch: vi.fn(),
    post:  vi.fn(),
    put:   vi.fn(),
  },
}));

import api from '@/lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wrap a value the same way NestJS TransformInterceptor does */
const wrap = (data: unknown) => ({ success: true, data, timestamp: '2026-01-01T00:00:00.000Z' });

const STORE_ID = 'store_abc123';
const THEME_ID = 'dawn';
const PAGE_ID  = 'home';

const MOCK_DOC: PageDocumentData = {
  id:            'doc_001',
  storeId:       STORE_ID,
  themeId:       THEME_ID,
  scope:         'PAGE',
  ownerKey:      PAGE_ID,
  status:        'DRAFT',
  version:       3,
  schemaVersion: 1,
  tree:          { id: 'root_home', type: 'page_root', settings: {}, children: [] },
};

const MOCK_TREE = { id: 'root_home', type: 'page_root', settings: {}, children: [] };

// ─── DocumentVersionConflictError ────────────────────────────────────────────

describe('DocumentVersionConflictError', () => {
  it('is an instance of Error', () => {
    const err = new DocumentVersionConflictError(5);
    expect(err).toBeInstanceOf(Error);
  });

  it('has name DocumentVersionConflictError', () => {
    expect(new DocumentVersionConflictError(5).name).toBe('DocumentVersionConflictError');
  });

  it('exposes serverVersion', () => {
    expect(new DocumentVersionConflictError(7).serverVersion).toBe(7);
  });

  it('message mentions the server version', () => {
    expect(new DocumentVersionConflictError(4).message).toContain('4');
  });

  it('serverVersion -1 when unknown', () => {
    expect(new DocumentVersionConflictError(-1).serverVersion).toBe(-1);
  });
});

// ─── loadPageDocument ─────────────────────────────────────────────────────────

describe('loadPageDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls GET /content/{storeId}/{themeId}/{pageId}?status=DRAFT', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(wrap(MOCK_DOC));

    await themeEngineService.loadPageDocument(STORE_ID, THEME_ID, PAGE_ID);

    expect(api.get).toHaveBeenCalledWith(
      `/content/${STORE_ID}/${THEME_ID}/${PAGE_ID}?status=DRAFT`,
    );
  });

  it('returns PageDocumentData from unwrapped response', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(wrap(MOCK_DOC));

    const result = await themeEngineService.loadPageDocument(STORE_ID, THEME_ID, PAGE_ID);

    expect(result).toEqual(MOCK_DOC);
    expect(result?.version).toBe(3);
    expect(result?.tree).toEqual(MOCK_TREE);
  });

  it('returns null when response data is null', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(wrap(null));

    const result = await themeEngineService.loadPageDocument(STORE_ID, THEME_ID, PAGE_ID);
    expect(result).toBeNull();
  });

  it('returns null on HTTP 404 (page never saved in node mode)', async () => {
    vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 404 } });

    const result = await themeEngineService.loadPageDocument(STORE_ID, THEME_ID, PAGE_ID);
    expect(result).toBeNull();
  });

  it('rethrows non-404 errors', async () => {
    vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 500 } });

    await expect(
      themeEngineService.loadPageDocument(STORE_ID, THEME_ID, PAGE_ID),
    ).rejects.toMatchObject({ response: { status: 500 } });
  });

  it('URL-encodes storeId, themeId, pageId', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(wrap(MOCK_DOC));

    await themeEngineService.loadPageDocument('store/with slash', 'theme&id', 'cms:about');

    const calledUrl = vi.mocked(api.get).mock.calls[0][0] as string;
    expect(calledUrl).toContain(encodeURIComponent('store/with slash'));
    expect(calledUrl).toContain(encodeURIComponent('theme&id'));
    expect(calledUrl).toContain(encodeURIComponent('cms:about'));
  });

  it('handles unwrapped response (no TransformInterceptor wrapper)', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(MOCK_DOC);   // raw, not wrapped

    const result = await themeEngineService.loadPageDocument(STORE_ID, THEME_ID, PAGE_ID);
    expect(result).toEqual(MOCK_DOC);
  });
});

// ─── savePageDocument ─────────────────────────────────────────────────────────

describe('savePageDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls PATCH /content/{storeId}/{themeId}/{pageId}', async () => {
    const saved = { ...MOCK_DOC, version: 4 };
    vi.mocked(api.patch).mockResolvedValueOnce(wrap(saved));

    await themeEngineService.savePageDocument(STORE_ID, THEME_ID, PAGE_ID, MOCK_TREE, 3);

    expect(api.patch).toHaveBeenCalledWith(
      `/content/${STORE_ID}/${THEME_ID}/${PAGE_ID}`,
      { tree: MOCK_TREE, version: 3 },
    );
  });

  it('returns PageDocumentData with updated version', async () => {
    const saved = { ...MOCK_DOC, version: 4 };
    vi.mocked(api.patch).mockResolvedValueOnce(wrap(saved));

    const result = await themeEngineService.savePageDocument(STORE_ID, THEME_ID, PAGE_ID, MOCK_TREE, 3);

    expect(result.version).toBe(4);
  });

  it('sends version=0 for first-time save', async () => {
    const saved = { ...MOCK_DOC, version: 1 };
    vi.mocked(api.patch).mockResolvedValueOnce(wrap(saved));

    await themeEngineService.savePageDocument(STORE_ID, THEME_ID, PAGE_ID, MOCK_TREE, 0);

    const body = vi.mocked(api.patch).mock.calls[0][1] as any;
    expect(body.version).toBe(0);
  });

  it('throws DocumentVersionConflictError on HTTP 409', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce({
      response: { status: 409, data: { serverVersion: 5 } },
    });

    await expect(
      themeEngineService.savePageDocument(STORE_ID, THEME_ID, PAGE_ID, MOCK_TREE, 3),
    ).rejects.toThrow(DocumentVersionConflictError);
  });

  it('DocumentVersionConflictError carries the server version from response body', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce({
      response: { status: 409, data: { serverVersion: 7 } },
    });

    let caught: DocumentVersionConflictError | undefined;
    try {
      await themeEngineService.savePageDocument(STORE_ID, THEME_ID, PAGE_ID, MOCK_TREE, 3);
    } catch (e) {
      caught = e as DocumentVersionConflictError;
    }

    expect(caught).toBeInstanceOf(DocumentVersionConflictError);
    expect(caught?.serverVersion).toBe(7);
  });

  it('uses serverVersion=-1 when 409 body has no version', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce({
      response: { status: 409, data: {} },
    });

    let caught: DocumentVersionConflictError | undefined;
    try {
      await themeEngineService.savePageDocument(STORE_ID, THEME_ID, PAGE_ID, MOCK_TREE, 3);
    } catch (e) {
      caught = e as DocumentVersionConflictError;
    }

    expect(caught?.serverVersion).toBe(-1);
  });

  it('rethrows non-409 errors', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce({ response: { status: 503 } });

    await expect(
      themeEngineService.savePageDocument(STORE_ID, THEME_ID, PAGE_ID, MOCK_TREE, 3),
    ).rejects.not.toBeInstanceOf(DocumentVersionConflictError);
  });

  it('includes full tree in request body', async () => {
    const deepTree = { ...MOCK_TREE, children: [{ id: 'c1', type: 'hero', settings: {}, children: [] }] };
    vi.mocked(api.patch).mockResolvedValueOnce(wrap({ ...MOCK_DOC, version: 2 }));

    await themeEngineService.savePageDocument(STORE_ID, THEME_ID, PAGE_ID, deepTree, 1);

    const body = vi.mocked(api.patch).mock.calls[0][1] as any;
    expect(body.tree).toEqual(deepTree);
  });
});

// ─── discardPageDocument ──────────────────────────────────────────────────────

describe('discardPageDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls POST /content/{storeId}/{themeId}/{pageId}/discard', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(undefined);

    await themeEngineService.discardPageDocument(STORE_ID, THEME_ID, PAGE_ID);

    expect(api.post).toHaveBeenCalledWith(
      `/content/${STORE_ID}/${THEME_ID}/${PAGE_ID}/discard`,
      {},
    );
  });

  it('resolves void on success (HTTP 200)', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(undefined);

    await expect(
      themeEngineService.discardPageDocument(STORE_ID, THEME_ID, PAGE_ID),
    ).resolves.toBeUndefined();
  });

  it('resolves void on HTTP 404 (page never published — graceful no-op)', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 404 } });

    await expect(
      themeEngineService.discardPageDocument(STORE_ID, THEME_ID, PAGE_ID),
    ).resolves.toBeUndefined();
  });

  it('rethrows non-404 errors', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 500 } });

    await expect(
      themeEngineService.discardPageDocument(STORE_ID, THEME_ID, PAGE_ID),
    ).rejects.toMatchObject({ response: { status: 500 } });
  });
});

// ─── publishPageDocument ──────────────────────────────────────────────────────

describe('publishPageDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  const PUBLISH_RESULT = {
    version:     4,
    publishedAt: '2026-06-23T10:00:00.000Z',
    snapshotId:  'snap_abc',
  };

  it('calls POST /content/{storeId}/{themeId}/{pageId}/publish', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(wrap(PUBLISH_RESULT));

    await themeEngineService.publishPageDocument(STORE_ID, THEME_ID, PAGE_ID);

    expect(api.post).toHaveBeenCalledWith(
      `/content/${STORE_ID}/${THEME_ID}/${PAGE_ID}/publish`,
      {},
    );
  });

  it('returns version, publishedAt, snapshotId', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(wrap(PUBLISH_RESULT));

    const result = await themeEngineService.publishPageDocument(STORE_ID, THEME_ID, PAGE_ID);

    expect(result.version).toBe(4);
    expect(result.publishedAt).toBe('2026-06-23T10:00:00.000Z');
    expect(result.snapshotId).toBe('snap_abc');
  });

  it('snapshotId can be null', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(wrap({ ...PUBLISH_RESULT, snapshotId: null }));

    const result = await themeEngineService.publishPageDocument(STORE_ID, THEME_ID, PAGE_ID);
    expect(result.snapshotId).toBeNull();
  });

  it('rethrows errors', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 422 } });

    await expect(
      themeEngineService.publishPageDocument(STORE_ID, THEME_ID, PAGE_ID),
    ).rejects.toMatchObject({ response: { status: 422 } });
  });
});

// ─── Version flow integration ─────────────────────────────────────────────────
// Simulates the real version lifecycle:
//   load → version=3   save(v=3) → version=4   save(v=4) → version=5

describe('version lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('load → save → save version chain is consistent', async () => {
    // Load: server returns version=3
    vi.mocked(api.get).mockResolvedValueOnce(wrap({ ...MOCK_DOC, version: 3 }));
    const loaded = await themeEngineService.loadPageDocument(STORE_ID, THEME_ID, PAGE_ID);
    expect(loaded?.version).toBe(3);

    // First save with version=3 → server returns version=4
    vi.mocked(api.patch).mockResolvedValueOnce(wrap({ ...MOCK_DOC, version: 4 }));
    const saved1 = await themeEngineService.savePageDocument(STORE_ID, THEME_ID, PAGE_ID, MOCK_TREE, 3);
    expect(saved1.version).toBe(4);

    // Second save with version=4 → server returns version=5
    vi.mocked(api.patch).mockResolvedValueOnce(wrap({ ...MOCK_DOC, version: 5 }));
    const saved2 = await themeEngineService.savePageDocument(STORE_ID, THEME_ID, PAGE_ID, MOCK_TREE, 4);
    expect(saved2.version).toBe(5);
  });

  it('sending stale version triggers DocumentVersionConflictError', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce({
      response: { status: 409, data: { serverVersion: 4 } },
    });

    let caught: DocumentVersionConflictError | undefined;
    try {
      // Sending version=2 but server is at version=4
      await themeEngineService.savePageDocument(STORE_ID, THEME_ID, PAGE_ID, MOCK_TREE, 2);
    } catch (e) {
      caught = e as DocumentVersionConflictError;
    }

    expect(caught).toBeInstanceOf(DocumentVersionConflictError);
    expect(caught?.serverVersion).toBe(4);
  });
});
