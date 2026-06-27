/**
 * useSectionEditor — core state management hook for all Aurus section editors.
 *
 * Responsibilities:
 *   - Load section config from the React Query homepage cache
 *   - Sync API data into local state on first load
 *   - Track dirty state (unsaved changes)
 *   - Provide save (draft) and publish mutations
 *   - Expose schedule fields (goLiveAt / expireAt)
 *
 * Usage:
 *   const editor = useSectionEditor({ sectionId, defaultConfig, parseConfig });
 *   // editor.config, editor.updateConfig, editor.publish, editor.saveDraft, ...
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { pageBuilderService } from '@/services/pageBuilderService';
import { HOMEPAGE_QUERY_KEY } from './types';

interface UseSectionEditorOptions<T extends object> {
  sectionId: string;
  defaultConfig: T;
  parseConfig: (raw: unknown) => T;
  validate?: (config: T) => Record<string, string>;
}

export function useSectionEditor<T extends object>({
  sectionId,
  defaultConfig,
  parseConfig,
  validate,
}: UseSectionEditorOptions<T>) {
  const queryClient = useQueryClient();

  // ── Load from React Query cache (populated by the homepage query) ─────────
  const { data: response, isLoading } = useQuery({
    queryKey: HOMEPAGE_QUERY_KEY,
    queryFn:  () => pageBuilderService.getHomepage(),
    staleTime: 30_000,
  });

  const apiSection = response?.data?.sections?.find(s => s.id === sectionId);

  // ── Local editor state ────────────────────────────────────────────────────
  const [config,    setConfig]    = useState<T>(defaultConfig);
  const [isEnabled, setIsEnabled] = useState(true);
  const [goLiveAt,  setGoLiveAt]  = useState('');
  const [expireAt,  setExpireAt]  = useState('');
  const [isDirty,   setIsDirty]   = useState(false);
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  // Sync once when API data resolves
  useEffect(() => {
    if (apiSection) {
      const parsed = parseConfig(apiSection.config);
      setConfig(parsed);
      setIsEnabled(apiSection.isEnabled);
      setGoLiveAt(apiSection.goLiveAt ?? '');
      setExpireAt(apiSection.expireAt ?? '');
      setIsDirty(false);
      setErrors({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiSection?.id, apiSection?.updatedAt]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (status: 'DRAFT' | 'LIVE') =>
      pageBuilderService.updateSection(sectionId, {
        config:   config as unknown as Record<string, unknown>,
        status,
        isEnabled,
        ...(goLiveAt && { goLiveAt }),
        ...(expireAt && { expireAt }),
      }),
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: HOMEPAGE_QUERY_KEY });
      setIsDirty(false);
      toast.success(status === 'LIVE' ? 'Published ✓' : 'Draft saved ✓');
    },
    onError: () => toast.error('Save failed — please try again'),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const markDirty = useCallback(() => setIsDirty(true), []);

  const updateConfig = useCallback((next: T) => {
    setConfig(next);
    setIsDirty(true);
  }, []);

  const updateEnabled = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
    setIsDirty(true);
  }, []);

  const runValidation = useCallback((): boolean => {
    if (!validate) return true;
    const errs = validate(config);
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [validate, config]);

  const saveDraft = useCallback(() => {
    if (runValidation()) saveMutation.mutate('DRAFT');
  }, [runValidation, saveMutation]);

  const publish = useCallback(() => {
    if (runValidation()) saveMutation.mutate('LIVE');
  }, [runValidation, saveMutation]);

  const lastPublishedAt = response?.data?.publishedAt
    ? new Date(response.data.publishedAt).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : 'Not yet published';

  return {
    // Config
    config,
    updateConfig,
    setConfig,        // escape hatch for complex nested updates
    errors,
    // Section metadata
    isEnabled,
    updateEnabled,
    isDirty,
    markDirty,
    // Scheduling
    goLiveAt,
    setGoLiveAt,
    expireAt,
    setExpireAt,
    // API state
    isLoading,
    isSaving: saveMutation.isPending,
    apiSection,
    // Actions
    saveDraft,
    publish,
    // Display
    lastPublishedAt,
  } as const;
}
