/**
 * Symbol visual layer — Sprint 9 (UI only, no backend sync yet)
 *
 * Provides:
 *   1. SaveAsSymbolModal  — name + save a section as a reusable symbol
 *   2. useSymbolStore     — lightweight client-side symbol registry (localStorage)
 *   3. SymbolBadge        — ☆ chip shown on symbol instances in the layer tree
 *
 * Symbol backend sync (SymbolDocument, exposedProps, fan-out on publish) ships
 * in Sprint 12 when the full ContentNode model is live. For now, symbols are
 * stored in localStorage and shown visually — no data loss, easy to migrate.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Star, X, Check, AlertCircle } from 'lucide-react';

// ─── Local symbol registry ────────────────────────────────────────────────────

export interface SymbolEntry {
  id:          string;
  handle:      string;      // kebab-case identifier, unique per store
  name:        string;      // display name
  sectionType: string;
  createdAt:   string;
}

const STORAGE_KEY = 'nx-symbols-v1';

function loadSymbols(): SymbolEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}

function saveSymbolsToStorage(symbols: SymbolEntry[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols)); } catch {}
}

let _symbols: SymbolEntry[]                       = loadSymbols();
let _listeners: Set<() => void>                   = new Set();
const notify = () => _listeners.forEach((fn) => fn());

export const symbolStore = {
  getAll:   ()                      => _symbols,
  getByHandle: (handle: string)     => _symbols.find((s) => s.handle === handle),
  add: (entry: SymbolEntry)         => { _symbols = [entry, ..._symbols]; saveSymbolsToStorage(_symbols); notify(); },
  remove: (id: string)              => { _symbols = _symbols.filter((s) => s.id !== id); saveSymbolsToStorage(_symbols); notify(); },
  subscribe: (fn: () => void)       => { _listeners.add(fn); return () => _listeners.delete(fn); },
};

export function useSymbolStore() {
  const [symbols, setSymbols] = useState<SymbolEntry[]>(_symbols);
  useEffect(() => symbolStore.subscribe(() => setSymbols([..._symbols])), []);
  return symbols;
}

// Tracks which sectionIds have been saved as symbols (for the ☆ badge)
const _symbolSectionMap = new Map<string, string>(); // sectionId → symbolHandle
let _symbolSectionListeners: Set<() => void> = new Set();
const notifyMap = () => _symbolSectionListeners.forEach((fn) => fn());

export const symbolSectionMap = {
  set:  (sectionId: string, handle: string) => { _symbolSectionMap.set(sectionId, handle); notifyMap(); },
  get:  (sectionId: string)                 => _symbolSectionMap.get(sectionId),
  subscribe: (fn: () => void)               => { _symbolSectionListeners.add(fn); return () => _symbolSectionListeners.delete(fn); },
};

export function useSymbolHandle(sectionId: string): string | undefined {
  const [handle, setHandle] = useState(() => symbolSectionMap.get(sectionId));
  useEffect(() => symbolSectionMap.subscribe(() => setHandle(symbolSectionMap.get(sectionId))), [sectionId]);
  return handle;
}

// ─── SymbolBadge ──────────────────────────────────────────────────────────────

export const SymbolBadge: React.FC<{ handle: string }> = ({ handle }) => (
  <span
    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0"
    style={{ background: 'rgba(236,72,153,0.12)', color: '#EC4899', border: '1px solid rgba(236,72,153,0.2)' }}
    title={`Symbol: ${handle}`}
  >
    <Star size={8} />
    {handle}
  </span>
);

// ─── Save as Symbol modal ─────────────────────────────────────────────────────

interface SaveAsSymbolModalProps {
  open:        boolean;
  sectionId:   string;
  sectionType: string;
  onClose:     () => void;
}

export const SaveAsSymbolModal: React.FC<SaveAsSymbolModalProps> = ({
  open, sectionId, sectionType, onClose,
}) => {
  const [name,    setName]    = useState('');
  const [handle,  setHandle]  = useState('');
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');
  const symbols = useSymbolStore();

  // Auto-generate handle from name
  useEffect(() => {
    setHandle(name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  }, [name]);

  useEffect(() => {
    if (open) { setName(''); setHandle(''); setSaved(false); setError(''); }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  const handleSave = useCallback(() => {
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!handle)      { setError('Handle is required.'); return; }
    if (symbols.find((s) => s.handle === handle)) {
      setError(`Handle "${handle}" is already in use. Choose a different name.`); return;
    }
    const entry: SymbolEntry = {
      id:          `sym-${Date.now()}`,
      handle,
      name:        name.trim(),
      sectionType,
      createdAt:   new Date().toISOString(),
    };
    symbolStore.add(entry);
    symbolSectionMap.set(sectionId, handle);
    setSaved(true);
    setTimeout(onClose, 1200);
  }, [name, handle, sectionType, sectionId, symbols, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }} />
      <div
        className="relative rounded-2xl shadow-2xl w-full max-w-[380px] p-6"
        style={{ background: 'var(--nx-overlay)', border: '1px solid var(--nx-border-2)',
          fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(236,72,153,0.15)' }}>
            <Star size={18} style={{ color: '#EC4899' }} />
          </div>
          <div className="flex-1">
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--nx-text-900)', marginBottom: 4 }}>
              Save as Symbol
            </h2>
            <p style={{ fontSize: 12, color: 'var(--nx-text-600)', lineHeight: 1.5 }}>
              Reuse this {sectionType.replace(/_/g, ' ')} across all pages.
              Edits to the symbol update everywhere on next publish.
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--nx-text-400)', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        {saved ? (
          /* Success state */
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(236,72,153,0.15)' }}>
              <Check size={22} style={{ color: '#EC4899' }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--nx-text-900)' }}>Symbol saved!</p>
            <p style={{ fontSize: 12, color: 'var(--nx-text-600)' }}>
              "{name}" is now available in the Insert panel under Symbols.
            </p>
          </div>
        ) : (
          /* Form */
          <div className="space-y-4">
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--nx-text-600)',
                display: 'block', marginBottom: 6 }}>
                Symbol name
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                placeholder="e.g. Product Card, Promo Banner"
                className="w-full px-3 py-2.5 rounded-xl focus:outline-none"
                style={{ background: 'var(--nx-raised)', border: '1px solid var(--nx-border-2)',
                  color: 'var(--nx-text-900)', fontSize: 13 }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--nx-text-600)',
                display: 'block', marginBottom: 6 }}>
                Handle (auto-generated)
              </label>
              <input
                value={handle}
                onChange={(e) => { setHandle(e.target.value); setError(''); }}
                className="w-full px-3 py-2.5 rounded-xl focus:outline-none"
                style={{ background: 'var(--nx-raised)', border: '1px solid var(--nx-border-2)',
                  color: 'var(--nx-text-400)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)' }}>
                <AlertCircle size={13} style={{ color: 'var(--nx-error)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--nx-error)' }}>{error}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-colors"
                style={{ border: '1px solid var(--nx-border-2)', color: 'var(--nx-text-600)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                style={{ background: '#EC4899', color: '#fff' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#db2777')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#EC4899')}
              >
                Save Symbol
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
