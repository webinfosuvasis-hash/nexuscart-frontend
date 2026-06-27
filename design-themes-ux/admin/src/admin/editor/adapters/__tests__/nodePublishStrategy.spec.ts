import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleNodePublish, handleNodeDiscard } from '../nodePublishStrategy';

vi.mock('@/services/themeEngineService', async () => {
  const actual = await vi.importActual<typeof import('@/services/themeEngineService')>(
    '@/services/themeEngineService',
  );
  return {
    ...actual,
    themeEngineService: {
      ...actual.themeEngineService,
      publishPageDocument: vi.fn(),
      discardPageDocument: vi.fn(),
    },
  };
});

import { themeEngineService } from '@/services/themeEngineService';

const S = 'store_abc';
const T = 'dawn';
const P = 'home';

const PUBLISH_RESPONSE = {
  version:     5,
  publishedAt: '2026-06-23T12:00:00.000Z',
  snapshotId:  'snap_xyz',
};

// ─── handleNodePublish ────────────────────────────────────────────────────────

describe('handleNodePublish', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls publishPageDocument with storeId, themeId, pageId', async () => {
    vi.mocked(themeEngineService.publishPageDocument).mockResolvedValueOnce(PUBLISH_RESPONSE);
    await handleNodePublish(S, T, P);
    expect(themeEngineService.publishPageDocument).toHaveBeenCalledWith(S, T, P);
  });

  it('returns newVersion from the response', async () => {
    vi.mocked(themeEngineService.publishPageDocument).mockResolvedValueOnce(PUBLISH_RESPONSE);
    const result = await handleNodePublish(S, T, P);
    expect(result.newVersion).toBe(5);
  });

  it('returns publishedAt from the response', async () => {
    vi.mocked(themeEngineService.publishPageDocument).mockResolvedValueOnce(PUBLISH_RESPONSE);
    const result = await handleNodePublish(S, T, P);
    expect(result.publishedAt).toBe('2026-06-23T12:00:00.000Z');
  });

  it('returns snapshotId from the response', async () => {
    vi.mocked(themeEngineService.publishPageDocument).mockResolvedValueOnce(PUBLISH_RESPONSE);
    const result = await handleNodePublish(S, T, P);
    expect(result.snapshotId).toBe('snap_xyz');
  });

  it('snapshotId can be null', async () => {
    vi.mocked(themeEngineService.publishPageDocument).mockResolvedValueOnce({ ...PUBLISH_RESPONSE, snapshotId: null });
    const result = await handleNodePublish(S, T, P);
    expect(result.snapshotId).toBeNull();
  });

  it('rethrows errors from the service', async () => {
    vi.mocked(themeEngineService.publishPageDocument).mockRejectedValueOnce({ response: { status: 422 } });
    await expect(handleNodePublish(S, T, P)).rejects.toMatchObject({ response: { status: 422 } });
  });

  it('rethrows 500 server errors', async () => {
    const err = new Error('Internal Server Error');
    vi.mocked(themeEngineService.publishPageDocument).mockRejectedValueOnce(err);
    await expect(handleNodePublish(S, T, P)).rejects.toBe(err);
  });

  it('newVersion increments correctly across multiple publishes', async () => {
    vi.mocked(themeEngineService.publishPageDocument)
      .mockResolvedValueOnce({ ...PUBLISH_RESPONSE, version: 3 })
      .mockResolvedValueOnce({ ...PUBLISH_RESPONSE, version: 4 });

    const r1 = await handleNodePublish(S, T, P);
    const r2 = await handleNodePublish(S, T, P);
    expect(r1.newVersion).toBe(3);
    expect(r2.newVersion).toBe(4);
  });
});

// ─── handleNodeDiscard ────────────────────────────────────────────────────────

describe('handleNodeDiscard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls discardPageDocument with storeId, themeId, pageId', async () => {
    vi.mocked(themeEngineService.discardPageDocument).mockResolvedValueOnce(undefined);
    await handleNodeDiscard(S, T, P);
    expect(themeEngineService.discardPageDocument).toHaveBeenCalledWith(S, T, P);
  });

  it('resolves void on success (HTTP 200)', async () => {
    vi.mocked(themeEngineService.discardPageDocument).mockResolvedValueOnce(undefined);
    await expect(handleNodeDiscard(S, T, P)).resolves.toBeUndefined();
  });

  it('resolves void on 404 (no published version — graceful no-op via service)', async () => {
    // discardPageDocument() in themeEngineService handles 404 internally.
    // The mock simulates that behavior by resolving void.
    vi.mocked(themeEngineService.discardPageDocument).mockResolvedValueOnce(undefined);
    await expect(handleNodeDiscard(S, T, P)).resolves.toBeUndefined();
  });

  it('rethrows non-404 errors from the service', async () => {
    vi.mocked(themeEngineService.discardPageDocument).mockRejectedValueOnce({ response: { status: 500 } });
    await expect(handleNodeDiscard(S, T, P)).rejects.toMatchObject({ response: { status: 500 } });
  });

  it('rethrows auth errors', async () => {
    vi.mocked(themeEngineService.discardPageDocument).mockRejectedValueOnce({ response: { status: 401 } });
    await expect(handleNodeDiscard(S, T, P)).rejects.toMatchObject({ response: { status: 401 } });
  });
});

// ─── Publish then discard sequence ────────────────────────────────────────────

describe('publish → discard cycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('publish followed by discard both succeed independently', async () => {
    vi.mocked(themeEngineService.publishPageDocument).mockResolvedValueOnce(PUBLISH_RESPONSE);
    vi.mocked(themeEngineService.discardPageDocument).mockResolvedValueOnce(undefined);

    const publishResult = await handleNodePublish(S, T, P);
    await handleNodeDiscard(S, T, P);

    expect(publishResult.newVersion).toBe(5);
    expect(themeEngineService.discardPageDocument).toHaveBeenCalledTimes(1);
  });
});
