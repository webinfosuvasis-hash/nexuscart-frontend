import { useState, useEffect, useCallback } from 'react';
import {
  storefrontService,
  DraftPageData,
  PreviewExpiredError,
  PreviewForbiddenError,
  PreviewInvalidError,
  PreviewNetworkError,
} from '@/services/storefrontService';

type PreviewStatus = 'idle' | 'loading' | 'ready' | 'error';

interface PreviewState {
  status:  PreviewStatus;
  data:    DraftPageData | null;
  error:   string | null;
  /** Call to re-fetch (used by PreviewEditorBridge on EDITOR_REFRESH) */
  refresh: () => void;
}

function classifyError(err: unknown): string {
  if (err instanceof PreviewExpiredError)   return 'expired';
  if (err instanceof PreviewForbiddenError) return 'forbidden';
  if (err instanceof PreviewInvalidError)   return err.message;
  if (err instanceof PreviewNetworkError)   return 'network';
  return 'unknown';
}

/**
 * usePreviewData — Sprint 5
 *
 * Fetches DraftPageData for the preview renderer.
 * The token is never stored in localStorage — it's read from the URL on every call.
 * Refresh is called by PreviewEditorBridge when EDITOR_REFRESH is received.
 */
export function usePreviewData(
  storeId: string | undefined,
  pageId:  string | undefined,
  token:   string | null,
): PreviewState {
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [data,   setData]   = useState<DraftPageData | null>(null);
  const [error,  setError]  = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!storeId || !pageId || !token) {
      setStatus('error');
      setError(!token ? 'no_token' : 'missing_params');
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      const result = await storefrontService.getDraftPageData(storeId, pageId, token);
      setData(result);
      setStatus('ready');
    } catch (err) {
      setError(classifyError(err));
      setStatus('error');
    }
  }, [storeId, pageId, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { status, data, error, refresh: fetchData };
}
