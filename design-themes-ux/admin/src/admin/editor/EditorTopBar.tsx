import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Monitor, Tablet, Smartphone,
  Check, Loader2, ChevronDown, RotateCcw, RotateCw,
  ExternalLink, AlertTriangle, Eye, Zap, Store,
} from 'lucide-react';
import { useEditor } from './EditorContext';
import { AVAILABLE_PAGES } from './editor-mock-data';
import type { PreviewMode } from './types';
import { themeEngineService } from '@/services/themeEngineService';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { handleNodeSave } from './adapters/nodeSaveStrategy';
import { handleNodePublish, handleNodeDiscard } from './adapters/nodePublishStrategy';
import { writeSectionShadow }        from './adapters/nodeShadowStrategy';
import { writeHeaderFooterShadow }   from './adapters/extractHeaderFooter';
import type { Node } from '@/components/node-renderer/types';

// ─── Shared styles ────────────────────────────────────────────────────────────

const S = {
  text: { color: 'var(--nx-text-900)', fontFamily: "'Plus Jakarta Sans', sans-serif" } as React.CSSProperties,
  muted: { color: 'var(--nx-text-400)' } as React.CSSProperties,
  border: { borderColor: 'var(--nx-border-2)' } as React.CSSProperties,
};

// ─── Modal primitive ──────────────────────────────────────────────────────────

const Modal: React.FC<{ open: boolean; onClose: () => void; children: React.ReactNode }> = ({ open, onClose, children }) => {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />
      <div
        className="relative rounded-2xl shadow-2xl max-w-[400px] w-full p-6"
        style={{ background: 'var(--nx-overlay)', border: '1px solid var(--nx-border-2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

// ─── Go Live confirm modal ────────────────────────────────────────────────────

const GoLiveModal: React.FC<{
  open:        boolean;
  isPublishing:boolean;
  isDirty:     boolean;
  onConfirm:   () => void;
  onCancel:    () => void;
}> = ({ open, isPublishing, isDirty, onConfirm, onCancel }) => (
  <Modal open={open} onClose={onCancel}>
    <div className="flex items-start gap-3 mb-5">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'rgba(124,58,237,0.2)' }}>
        <Zap size={18} style={{ color: 'var(--nx-violet-400)' }} />
      </div>
      <div>
        <h2 className="mb-1" style={{ fontSize: 15, fontWeight: 700, ...S.text }}>Publish to live store?</h2>
        <p style={{ fontSize: 13, color: 'var(--nx-text-600)', lineHeight: 1.6 }}>
          This replaces the live version of this page. A snapshot is saved automatically for rollback.
        </p>
        {isDirty && (
          <div className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <AlertTriangle size={12} style={{ color: 'var(--nx-warn)' }} />
            <span style={{ fontSize: 12, color: 'var(--nx-warn)' }}>Save your changes first</span>
          </div>
        )}
      </div>
    </div>
    <div className="flex gap-2">
      <button
        onClick={onCancel}
        className="flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-colors"
        style={{ border: '1px solid var(--nx-border-2)', color: 'var(--nx-text-600)' }}
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={isPublishing || isDirty}
        className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
        style={{ background: 'var(--nx-violet-600)', color: '#fff' }}
      >
        {isPublishing ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
        {isPublishing ? 'Publishing…' : 'Go Live Now'}
      </button>
    </div>
  </Modal>
);

// ─── Discard modal ────────────────────────────────────────────────────────────

const DiscardModal: React.FC<{
  open:      boolean;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel:  () => void;
}> = ({ open, isLoading, onConfirm, onCancel }) => (
  <Modal open={open} onClose={onCancel}>
    <div className="flex items-start gap-3 mb-5">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'rgba(244,63,94,0.15)' }}>
        <AlertTriangle size={18} style={{ color: 'var(--nx-error)' }} />
      </div>
      <div>
        <h2 className="mb-1" style={{ fontSize: 15, fontWeight: 700, ...S.text }}>Discard all changes?</h2>
        <p style={{ fontSize: 13, color: 'var(--nx-text-600)', lineHeight: 1.6 }}>
          Restores the last published version. This cannot be undone.
        </p>
      </div>
    </div>
    <div className="flex gap-2">
      <button
        onClick={onCancel}
        className="flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-colors"
        style={{ border: '1px solid var(--nx-border-2)', color: 'var(--nx-text-600)' }}
      >
        Keep editing
      </button>
      <button
        onClick={onConfirm}
        disabled={isLoading}
        className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
        style={{ background: 'var(--nx-error)', color: '#fff' }}
      >
        {isLoading && <Loader2 size={13} className="animate-spin" />}
        {isLoading ? 'Discarding…' : 'Discard'}
      </button>
    </div>
  </Modal>
);

// ─── Unsaved + Preview modal ──────────────────────────────────────────────────

const SavePreviewModal: React.FC<{
  open:             boolean;
  isSaving:         boolean;
  onSaveAndPreview: () => void;
  onOpenSaved:      () => void;
  onCancel:         () => void;
}> = ({ open, isSaving, onSaveAndPreview, onOpenSaved, onCancel }) => (
  <Modal open={open} onClose={onCancel}>
    <div className="flex items-start gap-3 mb-5">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'rgba(251,191,36,0.15)' }}>
        <AlertTriangle size={18} style={{ color: 'var(--nx-warn)' }} />
      </div>
      <div>
        <h2 className="mb-1" style={{ fontSize: 15, fontWeight: 700, ...S.text }}>Unsaved changes</h2>
        <p style={{ fontSize: 13, color: 'var(--nx-text-600)', lineHeight: 1.6 }}>
          Save your draft to see your latest edits in preview, or open the last saved version.
        </p>
      </div>
    </div>
    <div className="flex flex-col gap-2">
      <button
        onClick={onSaveAndPreview}
        disabled={isSaving}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-50"
        style={{ background: 'var(--nx-violet-600)', color: '#fff' }}
      >
        {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
        {isSaving ? 'Saving…' : 'Save & Preview'}
      </button>
      <button
        onClick={onOpenSaved}
        className="w-full py-2.5 rounded-xl text-[13px] font-medium transition-colors"
        style={{ border: '1px solid var(--nx-border-2)', color: 'var(--nx-text-600)' }}
      >
        Preview last saved version
      </button>
      <button onClick={onCancel} style={{ fontSize: 13, color: 'var(--nx-text-400)' }} className="py-2">
        Cancel
      </button>
    </div>
  </Modal>
);

// ─── Device pills ─────────────────────────────────────────────────────────────

const DevicePills: React.FC = () => {
  const { state, dispatch } = useEditor();
  const devices: { mode: PreviewMode; icon: React.ElementType; label: string }[] = [
    { mode: 'desktop', icon: Monitor,    label: 'Desktop' },
    { mode: 'tablet',  icon: Tablet,     label: 'Tablet'  },
    { mode: 'mobile',  icon: Smartphone, label: 'Mobile'  },
  ];
  return (
    <div className="flex items-center rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--nx-border-2)', background: 'var(--nx-raised)' }}>
      {devices.map(({ mode, icon: Icon, label }, i) => (
        <button
          key={mode}
          title={label}
          onClick={() => dispatch({ type: 'SET_PREVIEW_MODE', mode })}
          className="flex items-center justify-center w-8 h-7 transition-all"
          style={{
            borderLeft: i > 0 ? '1px solid var(--nx-border-2)' : 'none',
            background: state.previewMode === mode ? 'var(--nx-violet-bg)' : 'transparent',
            color: state.previewMode === mode ? 'var(--nx-violet-400)' : 'var(--nx-text-400)',
          }}
        >
          <Icon size={13} />
        </button>
      ))}
    </div>
  );
};

// ─── Page selector ────────────────────────────────────────────────────────────

const PageSelector: React.FC = () => {
  const { state, dispatch } = useEditor();
  const [open, setOpen]     = useState(false);
  const ref                 = useRef<HTMLDivElement>(null);
  const current = AVAILABLE_PAGES.find((p) => p.id === state.activePage) ?? AVAILABLE_PAGES[0];
  const isLoading = state.activePage !== (state.pageDoc?.pageId ?? state.activePage);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const handlePageSelect = useCallback((pageId: string) => {
    if (pageId === state.activePage) { setOpen(false); return; }

    // Guard: warn before discarding unsaved changes on the current page.
    if (state.isDirty) {
      const confirmed = window.confirm(
        `You have unsaved changes on "${current.title}".\n\nLeave without saving?`,
      );
      if (!confirmed) { setOpen(false); return; }
    }

    dispatch({ type: 'SET_ACTIVE_PAGE', pageId });
    setOpen(false);
  }, [state.activePage, state.isDirty, current.title, dispatch]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors"
        style={{ color: 'var(--nx-text-900)' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--nx-raised)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {isLoading
          ? <Loader2 size={13} className="animate-spin" style={{ color: 'var(--nx-text-400)' }} />
          : null
        }
        <span style={{ fontSize: 14, fontWeight: 600 }}>{current.title}</span>
        <ChevronDown size={12} style={{ color: 'var(--nx-text-400)' }} />
      </button>

      {open && (
        <div
          className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 w-52 rounded-xl shadow-2xl overflow-hidden z-50 py-1"
          style={{ background: 'var(--nx-float)', border: '1px solid var(--nx-border-2)' }}
        >
          <div className="px-3 pt-2 pb-1.5">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-text-400)' }}>
              Switch page
            </p>
          </div>
          {AVAILABLE_PAGES.map((page) => (
            <button
              key={page.id}
              onClick={() => handlePageSelect(page.id)}
              className="w-full flex items-center justify-between px-3 py-2 transition-colors"
              style={{ color: state.activePage === page.id ? 'var(--nx-violet-400)' : 'var(--nx-text-600)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--nx-overlay)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 13, fontWeight: state.activePage === page.id ? 600 : 400 }}>{page.title}</span>
              {state.activePage === page.id && <Check size={13} style={{ color: 'var(--nx-violet-400)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Save indicator ───────────────────────────────────────────────────────────

const SaveIndicator: React.FC<{ onSave: () => Promise<void> }> = ({ onSave }) => {
  const { state } = useEditor();
  const { isDirty, isSaving } = state;

  if (isSaving) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ color: 'var(--nx-text-400)', fontSize: 13 }}>
        <Loader2 size={12} className="animate-spin" />
        <span>Saving…</span>
      </div>
    );
  }
  if (!isDirty) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ color: 'var(--nx-text-400)', fontSize: 13 }}>
        <Check size={12} style={{ color: 'var(--nx-live)' }} />
        <span>Saved</span>
      </div>
    );
  }
  return (
    <button
      onClick={onSave}
      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.97]"
      style={{ background: 'var(--nx-raised)', border: '1px solid var(--nx-border-2)', color: 'var(--nx-text-900)' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--nx-border-3)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--nx-border-2)')}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--nx-warn)' }} />
      Save
    </button>
  );
};

// ─── Top bar ──────────────────────────────────────────────────────────────────

interface EditorTopBarProps { onClose: () => void; }

const EditorTopBar: React.FC<EditorTopBarProps> = ({ onClose }) => {
  const { state, dispatch, reloadFromApi } = useEditor();
  const { user } = useAuth();

  const [showGoLiveModal,    setShowGoLiveModal]    = useState(false);
  const [showDiscardModal,   setShowDiscardModal]   = useState(false);
  const [showPreviewModal,   setShowPreviewModal]   = useState(false);
  const [isPublishing,       setIsPublishing]       = useState(false);
  const [isDiscarding,       setIsDiscarding]       = useState(false);
  const [isSavingForPreview, setIsSavingForPreview] = useState(false);

  // ── Save ─────────────────────────────────────────────────────────────────────

  const performSave = useCallback(async (): Promise<boolean> => {
    dispatch({ type: 'SET_SAVING', value: true });
    try {
      const {
        pageDoc, activePage, activeTheme,
        nodeMode, nodeTree, nodeDocumentVersion,
      } = state;

      // ── Node mode save ──────────────────────────────────────────────────────
      // This branch runs instead of the legacy SectionDoc path when the store
      // has CONTENT_NODE_ENABLED=true.
      if (nodeMode && nodeTree) {
        const storeId = user?.storeId ?? '';

        if (!storeId) {
          toast.error('Cannot save: store ID is not available. Please reload the page.');
          dispatch({ type: 'SET_SAVING', value: false });
          return false;
        }

        const result = await handleNodeSave(
          storeId,
          activeTheme,
          activePage,
          nodeTree as Node,
          nodeDocumentVersion,
        );

        if (result.status === 'saved') {
          dispatch({ type: 'SET_NODE_DOCUMENT_VERSION', version: result.newVersion });

          // ── Compatibility shadows ─────────────────────────────────────────
          // Write ThemePageSection + HeaderConfig + FooterConfig rows so the
          // legacy path stays current if CONTENT_NODE_ENABLED is rolled back.
          // All three are best-effort: failure must NOT block the primary save.
          writeSectionShadow(activePage, nodeTree as Node, activeTheme || undefined)
            .catch((err) => console.warn('[EditorTopBar] Section shadow sync failed:', err));

          writeHeaderFooterShadow(nodeTree as Node, activeTheme || undefined)
            .catch((err) => console.warn('[EditorTopBar] Header/Footer shadow sync failed:', err));

          dispatch({ type: 'MARK_SAVED' });
          return true;
        }

        // Conflict: another client saved a newer version.
        // The fresh tree and version have been loaded automatically.
        // Reload state so the editor reflects the server's latest content.
        dispatch({ type: 'SET_NODE_TREE',             tree:    result.freshTree as unknown as Node });
        dispatch({ type: 'SET_NODE_DOCUMENT_VERSION', version: result.freshVersion });
        dispatch({ type: 'SET_SAVING', value: false });
        toast.warning(
          'Save conflict — your document was updated externally. ' +
          'The editor has been refreshed with the latest version. ' +
          'Please review your changes and save again.',
          { duration: 7000 },
        );
        return false;
      }

      // ── Legacy SectionDoc path (unchanged below this line) ─────────────────
      if (!pageDoc) { dispatch({ type: 'MARK_SAVED' }); return true; }

      await themeEngineService.savePageSections(
        activePage,
        pageDoc.sections.map((s) => ({
          type: s.type, label: s.label, settings: s.settings,
          isVisible: s.isVisible, sortOrder: s.sortOrder,
          blocks: s.blocks.map((b) => ({
            type: b.type, settings: b.settings,
            isVisible: b.isVisible, sortOrder: b.sortOrder,
          })),
        })),
        activeTheme || undefined,
      );

      if (pageDoc.groups.header) {
        const headerSections = pageDoc.groups.header.sections;
        const annSection = headerSections.find((s) => s.type === 'announcement_bar');
        const hdrSection = headerSections.find((s) => s.type === 'header');
        const zones: any[] = [];

        if (annSection) {
          const annBlock = annSection.blocks.find((b) => b.type === 'announcement');
          zones.push({
            id: 'zone1',
            background:   annSection.settings.background ?? '#4f46e5',
            textColor:    annSection.settings.textColor  ?? '#ffffff',
            visibility:   annSection.isVisible ? 'all' : 'hidden',
            showOnMobile: annSection.settings.showOnMobile !== false,
            paddingTop:   annSection.settings.paddingVertical ?? 6,
            paddingBottom:annSection.settings.paddingVertical ?? 6,
            borderBottom: 'none',
            components:   annBlock ? [{ id: annBlock.id, type: 'announcement', settings: annBlock.settings }] : [],
          });
        }
        if (hdrSection) {
          const logoBlock   = hdrSection.blocks.find((b) => b.type === 'logo');
          const menuBlock   = hdrSection.blocks.find((b) => b.type === 'menu');
          const searchBlock = hdrSection.blocks.find((b) => b.type === 'search');
          const cartBlock   = hdrSection.blocks.find((b) => b.type === 'cart');
          const acctBlock   = hdrSection.blocks.find((b) => b.type === 'account');
          const spacerBlock = hdrSection.blocks.find((b) => b.type === 'spacer');
          const zone2components = [
            logoBlock   && { id: logoBlock.id,   type: 'logo',       settings: logoBlock.settings },
            menuBlock   && { id: menuBlock.id,   type: 'navigation', settings: menuBlock.settings },
            spacerBlock && { id: spacerBlock.id, type: 'spacer',     settings: spacerBlock.settings },
            searchBlock && { id: searchBlock.id, type: 'search',     settings: searchBlock.settings },
            cartBlock   && { id: cartBlock.id,   type: 'cart',       settings: cartBlock.settings },
            acctBlock   && { id: acctBlock.id,   type: 'account',    settings: acctBlock.settings },
          ].filter(Boolean);
          zones.push({
            id: 'zone2', background: hdrSection.settings.background ?? '#ffffff', visibility: 'all',
            paddingTop: hdrSection.settings.paddingTop ?? 12, paddingBottom: hdrSection.settings.paddingBottom ?? 12,
            borderBottom: '1px', borderColor: '#e5e7eb', components: zone2components,
          });
          zones.push({ id: 'zone3', background: '#f9fafb', visibility: 'desktop_only', paddingTop: 8, paddingBottom: 8, borderBottom: '1px', borderColor: '#e5e7eb', components: [] });
          await themeEngineService.updateHeaderDraft({
            zones,
            behavior: {
              stickyMode: hdrSection.settings.stickyMode ?? 'scroll_up',
              transparentOnHero: hdrSection.settings.transparentOnHero ?? false,
              mobileBreakpoint: hdrSection.settings.mobileBreakpoint ?? 'md',
              mobileDrawerStyle: hdrSection.settings.mobileDrawerStyle ?? 'slide_left',
              zIndex: hdrSection.settings.zIndex ?? 50,
              headerFont: hdrSection.settings.headerFont ?? 'heading',
              headerFontSize: hdrSection.settings.headerFontSize ?? 14,
              showSearchIcon: hdrSection.settings.showSearchIcon !== false,
              searchPosition: hdrSection.settings.searchPosition ?? 'right',
              logoPosition: hdrSection.settings.logoPosition ?? 'left',
              menuPosition: hdrSection.settings.menuPosition ?? 'left',
              menuRow: hdrSection.settings.menuRow ?? 'bottom',
            },
          });
        } else if (zones.length > 0) {
          await themeEngineService.updateHeaderDraft({ zones });
        }
      }

      if (pageDoc.groups.footer) {
        const footerSection = pageDoc.groups.footer.sections.find((s) => s.type === 'footer');
        if (footerSection) {
          const copyrightBlock = footerSection.blocks.find((b) => b.type === 'copyright');
          await themeEngineService.updateFooterDraft({
            settings: {
              topBackground: footerSection.settings.background ?? '#111827',
              topBorder: footerSection.settings.topBorder !== false,
              divider: footerSection.settings.divider ?? true,
              dividerColor: footerSection.settings.dividerColor ?? '#374151',
              paddingTop: footerSection.settings.paddingTop ?? 48,
              paddingBottom: footerSection.settings.paddingBottom ?? 48,
              showBottomBar: footerSection.settings.showBottomBar ?? true,
              bottomBarBg: footerSection.settings.bottomBarBg ?? '#0f172a',
            },
            ...(copyrightBlock ? {
              bottomBar: {
                backgroundColor: footerSection.settings.bottomBarBg ?? '#0f172a',
                components: [
                  { id: copyrightBlock.id, type: 'copyright', settings: copyrightBlock.settings },
                  { id: 'payments-1',      type: 'payment_badges', settings: { set: 'generic' } },
                  { id: 'legal-links-1',   type: 'legal_links',    settings: {} },
                ],
              },
            } : {}),
          });
        }
      }

      dispatch({ type: 'MARK_SAVED' });
      return true;
    } catch (err: any) {
      toast.error('Save failed — ' + (err?.message ?? 'check console'));
      console.error('[EditorTopBar] save error:', err);
      dispatch({ type: 'SET_SAVING', value: false });
      return false;
    }
  }, [state, dispatch, user]);

  // ── Preview ───────────────────────────────────────────────────────────────────

  const openPreviewTab = useCallback(async () => {
    try {
      const result = await themeEngineService.generatePreviewLink(state.activePage, state.activeTheme || undefined);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error('Preview failed — ' + (err?.message ?? ''));
    }
  }, [state.activePage, state.activeTheme]);

  const handlePreview = useCallback(() => {
    if (state.isDirty) setShowPreviewModal(true);
    else openPreviewTab();
  }, [state.isDirty, openPreviewTab]);

  const handleSaveAndPreview = useCallback(async () => {
    setIsSavingForPreview(true);
    const saved = await performSave();
    setIsSavingForPreview(false);
    if (saved) { setShowPreviewModal(false); toast.success('Draft saved'); await openPreviewTab(); }
  }, [performSave, openPreviewTab]);

  // ── Publish ───────────────────────────────────────────────────────────────────

  const handleGoLive = useCallback(async () => {
    if (state.isDirty) {
      toast.warning('Save your changes before publishing.', { duration: 4000 });
      return;
    }
    setIsPublishing(true);
    try {
      // 1. Publish theme config (both modes — handles colors, fonts, layout)
      const configResult = await themeEngineService.publish(state.activeTheme || undefined);

      // 2. Node mode: also publish the PageDocument (ContentNode tree)
      if (state.nodeMode) {
        const storeId = user?.storeId ?? '';
        if (storeId) {
          const docResult = await handleNodePublish(storeId, state.activeTheme, state.activePage);
          // Track the post-publish version so the next save uses the correct token
          dispatch({ type: 'SET_NODE_DOCUMENT_VERSION', version: docResult.newVersion });
        }
      }

      toast.success(`Published! Version ${configResult.version} is now live.`);
      setShowGoLiveModal(false);
      await reloadFromApi();
    } catch (err: any) {
      toast.error(err?.message ?? 'Publish failed. Try again.');
    } finally {
      setIsPublishing(false);
    }
  }, [state.isDirty, state.nodeMode, state.activeTheme, state.activePage, dispatch, user, reloadFromApi]);

  // ── Discard ───────────────────────────────────────────────────────────────────

  const handleDiscard = useCallback(async () => {
    setIsDiscarding(true);
    try {
      // 1. Discard theme config draft (both modes — handles colors, fonts, layout)
      await themeEngineService.discardDraft(state.activeTheme || undefined);

      // 2. Node mode: also discard the PageDocument draft.
      //    discardPageDocument() handles 404 gracefully (new page never published).
      //    After this, reloadFromApi() runs the Step 3 load flow which will call
      //    loadPageDocument() to fetch the published tree (or fall back to legacy).
      if (state.nodeMode && user?.storeId) {
        await handleNodeDiscard(user.storeId, state.activeTheme, state.activePage);
      }

      setShowDiscardModal(false);
      toast.info('Changes discarded — restored to last published version.');
      await reloadFromApi();
    } catch (err: any) {
      toast.error('Discard failed — ' + (err?.message ?? ''));
    } finally {
      setIsDiscarding(false);
    }
  }, [state.activeTheme, state.nodeMode, state.activePage, user, reloadFromApi]);

  // ── Back ──────────────────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    if (state.isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Leave without saving?');
      if (!confirmed) return;
    }
    onClose();
  }, [state.isDirty, onClose]);

  // ── Ctrl/Cmd+S ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (state.isDirty && !state.isSaving) performSave();
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [state.isDirty, state.isSaving, performSave]);

  return (
    <>
      {/* Modals */}
      <GoLiveModal
        open={showGoLiveModal}
        isPublishing={isPublishing}
        isDirty={state.isDirty}
        onConfirm={handleGoLive}
        onCancel={() => setShowGoLiveModal(false)}
      />
      <DiscardModal
        open={showDiscardModal}
        isLoading={isDiscarding}
        onConfirm={handleDiscard}
        onCancel={() => setShowDiscardModal(false)}
      />
      <SavePreviewModal
        open={showPreviewModal}
        isSaving={isSavingForPreview}
        onSaveAndPreview={handleSaveAndPreview}
        onOpenSaved={() => { setShowPreviewModal(false); openPreviewTab(); }}
        onCancel={() => setShowPreviewModal(false)}
      />

      {/* Command bar — bottom border tints amber (mobile) or sky (tablet) */}
      <header
        className="shrink-0 flex items-center px-3 gap-2 z-30 relative"
        style={{
          height: 48,
          background: 'var(--nx-base)',
          borderBottom: state.previewMode === 'mobile'
            ? '2px solid #FBBF24'
            : state.previewMode === 'tablet'
            ? '2px solid #38BDF8'
            : '1px solid var(--nx-border-1)',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        {/* ── LEFT: brand + back ───────────────── */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Back button */}
          <button
            onClick={handleBack}
            title="Back to admin"
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--nx-text-400)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--nx-raised)'; e.currentTarget.style.color = 'var(--nx-text-900)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--nx-text-400)'; }}
          >
            <ArrowLeft size={15} />
          </button>

          <div style={{ width: 1, height: 16, background: 'var(--nx-border-2)' }} />

          {/* NexusCart wordmark */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--nx-violet-600), var(--nx-violet-400))' }}>
              <Store size={13} style={{ color: '#fff' }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--nx-text-900)' }}>NexusCart</span>
          </div>

          <div style={{ width: 1, height: 16, background: 'var(--nx-border-2)' }} />

          {/* Store badge */}
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--nx-text-600)' }}>
              {state.activeTheme || 'My Store'}
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
              style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--nx-live)' }}>
              <span className="w-1 h-1 rounded-full" style={{ background: 'var(--nx-live)' }} />
              Active
            </span>
          </div>
        </div>

        {/* ── CENTER: page + device ────────────── */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          {/* Undo / Redo */}
          <button title="Undo (⌘Z)" disabled={!state.isDirty}
            className="w-7 h-7 flex items-center justify-center rounded-md transition-colors disabled:opacity-25"
            style={{ color: 'var(--nx-text-400)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--nx-raised)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <RotateCcw size={13} />
          </button>
          <button title="Redo (⌘⇧Z)" disabled
            className="w-7 h-7 flex items-center justify-center rounded-md disabled:opacity-25"
            style={{ color: 'var(--nx-text-400)' }}>
            <RotateCw size={13} />
          </button>

          <div style={{ width: 1, height: 16, background: 'var(--nx-border-2)' }} />

          {/* Page selector */}
          <PageSelector />

          <div style={{ width: 1, height: 16, background: 'var(--nx-border-2)' }} />

          {/* Device pills */}
          <DevicePills />
        </div>

        {/* ── RIGHT: save + preview + go live ─── */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {/* Unsaved dot */}
          {state.isDirty && !state.isSaving && (
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--nx-warn)' }} title="Unsaved changes" />
          )}

          {/* Save indicator */}
          <SaveIndicator onSave={performSave} />

          <div style={{ width: 1, height: 16, background: 'var(--nx-border-2)' }} />

          {/* Preview */}
          <button
            onClick={handlePreview}
            title={state.isDirty ? 'Save before previewing' : 'Open preview in new tab'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors"
            style={{ color: 'var(--nx-text-600)', border: '1px solid var(--nx-border-2)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--nx-raised)'; e.currentTarget.style.color = 'var(--nx-text-900)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--nx-text-600)'; }}
          >
            <ExternalLink size={13} />
            Preview
          </button>

          {/* Discard (subtle, text-only) */}
          <button
            onClick={() => setShowDiscardModal(true)}
            className="px-2.5 py-1.5 rounded-lg text-[12px] transition-colors"
            style={{ color: 'var(--nx-text-400)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--nx-error)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--nx-text-400)')}
          >
            Discard
          </button>

          {/* ⚡ Go Live — always visible, always prominent */}
          <button
            onClick={() => setShowGoLiveModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.97]"
            style={{ background: 'var(--nx-violet-600)', color: '#fff', boxShadow: '0 0 0 1px rgba(139,92,246,0.3), 0 4px 12px rgba(124,58,237,0.25)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--nx-violet-500)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--nx-violet-600)')}
          >
            <Zap size={14} />
            Go Live
          </button>
        </div>
      </header>
    </>
  );
};

export default EditorTopBar;
