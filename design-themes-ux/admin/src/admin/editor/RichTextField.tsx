/**
 * RichTextField — Sprint 6 + JSON document model upgrade
 *
 * Document model: ProseMirror JSON (Tiptap's native format).
 *   - Editor reads/writes TiptapDoc objects, never raw HTML strings.
 *   - INLINE_EXTENSIONS / BLOCK_EXTENSIONS imported from @/utils/richText so
 *     the editor and the storefront renderer always agree on allowed nodes/marks.
 *
 * onChange emits a TiptapDoc object, which is stored in settings.text.
 * parseRichTextInput() accepts both TiptapDoc and legacy HTML strings,
 * so blocks saved before the JSON model still load without errors.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { Extension }  from '@tiptap/core';
import {
  Bold as BoldIcon, Italic as ItalicIcon,
  Underline as UnderlineIcon, Link as LinkIcon, Unlink,
  List, ListOrdered, Heading1, Heading2, Heading3,
  Undo2, Redo2,
} from 'lucide-react';

// Import shared extension sets and helpers from the central rich text utility.
// These must match what @/utils/richText uses for generateHTML() so the stored
// JSON always round-trips cleanly through the editor.
import {
  INLINE_EXTENSIONS,
  BLOCK_EXTENSIONS,
  parseRichTextInput,
  isTiptapDoc,
  type TiptapDoc,
} from '@/utils/richText';

// ─── Max lengths (must match backend RICH_TEXT_FIELDS) ───────────────────────

const MAX_LENGTHS: Record<string, number> = {
  heading:      500,
  paragraph:    10000,
  announcement: 250,
};

// ─── Inline mode: prevent Enter from creating new paragraphs ─────────────────

const PreventNewLine = Extension.create({
  name: 'preventNewLine',
  addKeyboardShortcuts() {
    return {
      'Enter':       () => true,
      'Shift-Enter': () => true,
    };
  },
});

// ─── Toolbar button ───────────────────────────────────────────────────────────

const ToolbarBtn: React.FC<{
  active?:   boolean;
  disabled?: boolean;
  title:     string;
  onClick:   () => void;
  children:  React.ReactNode;
}> = ({ active, disabled, title, onClick, children }) => (
  <button
    type="button"
    title={title}
    disabled={disabled}
    onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    className={`
      w-7 h-7 flex items-center justify-center rounded-md transition-all
      ${active
        ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900'
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200'
      }
      disabled:opacity-30 disabled:pointer-events-none
    `}
  >
    {children}
  </button>
);

// ─── Link input overlay ───────────────────────────────────────────────────────

const LinkInput: React.FC<{ editor: Editor; onClose: () => void }> = ({ editor, onClose }) => {
  const [url, setUrl] = useState(editor.getAttributes('link').href ?? '');
  const inputRef      = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const apply = useCallback(() => {
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().unsetLink().run();
    } else {
      const href = /^(https?:|mailto:)/i.test(trimmed) ? trimmed : `https://${trimmed}`;
      editor.chain().focus().setLink({ href }).run();
    }
    onClose();
  }, [editor, url, onClose]);

  const remove = useCallback(() => {
    editor.chain().focus().unsetLink().run();
    onClose();
  }, [editor, onClose]);

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
      <input
        ref={inputRef} type="url" value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } if (e.key === 'Escape') onClose(); }}
        placeholder="https://... or mailto:..."
        className="flex-1 text-[12px] px-2 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      <button type="button" onMouseDown={(e) => { e.preventDefault(); apply(); }}
        className="text-[11px] font-semibold px-2.5 py-1 rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-700 transition-colors">
        Apply
      </button>
      {editor.isActive('link') && (
        <button type="button" onMouseDown={(e) => { e.preventDefault(); remove(); }}
          className="text-[11px] font-medium px-2 py-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
          Remove
        </button>
      )}
      <button type="button" onMouseDown={(e) => { e.preventDefault(); onClose(); }}
        className="text-[11px] text-slate-400 hover:text-slate-600 px-1">✕</button>
    </div>
  );
};

// ─── Character counter ────────────────────────────────────────────────────────

const CharCount: React.FC<{ editor: Editor; maxLen?: number }> = ({ editor, maxLen }) => {
  const len = editor.getText().length;
  if (!maxLen) return null;

  const pct     = len / maxLen;
  const isWarn  = pct >= 0.9;
  const isError = pct >= 1.0;

  return (
    <div className={`text-right text-[10px] font-mono px-2 pb-1 select-none ${
      isError ? 'text-red-500' : isWarn ? 'text-amber-500' : 'text-slate-400'
    }`}>
      {len.toLocaleString()} / {maxLen.toLocaleString()}
    </div>
  );
};

// ─── Shared props for both editor variants ────────────────────────────────────

interface RichFieldProps {
  /** Accepts TiptapDoc (JSON) or legacy HTML string — both load correctly. */
  value:        unknown;
  /** Emits a TiptapDoc object (ProseMirror JSON). */
  onChange:     (doc: TiptapDoc) => void;
  placeholder?: string;
  blockType?:   string;
}

// ─── Inline Rich Editor ───────────────────────────────────────────────────────

export const InlineRichEditor: React.FC<RichFieldProps> = ({ value, onChange, blockType }) => {
  const [showLink, setShowLink] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxLen      = blockType ? MAX_LENGTHS[blockType] : undefined;

  const editor = useEditor({
    extensions: [
      // Use the shared extension set — matches the renderer's INLINE_EXTENSIONS
      ...INLINE_EXTENSIONS,
      PreventNewLine,
    ],
    content: parseRichTextInput(value),
    onUpdate: ({ editor: e }) => {
      // Emit the ProseMirror JSON document directly.
      // Rendering (HTML generation + <p> stripping) happens in renderRichText().
      const doc = e.getJSON() as TiptapDoc;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onChange(doc), 200);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none px-3 py-2 text-[13px] text-slate-900 dark:text-white focus:outline-none min-h-[36px]',
      },
    },
  });

  // Sync when the value prop changes externally (e.g., undo in EditorContext,
  // section load from API, or discard-draft). Skip if the doc is unchanged to
  // avoid resetting cursor position on every keystroke.
  useEffect(() => {
    if (!editor) return;
    const incoming = parseRichTextInput(value);
    const currentJson = JSON.stringify(editor.getJSON());
    const incomingJson = typeof incoming === 'object'
      ? JSON.stringify(incoming)
      : JSON.stringify(editor.parseHTML ? incoming : incoming);
    if (currentJson !== incomingJson) {
      editor.commands.setContent(incoming, false);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-400 transition-all">
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <ToolbarBtn active={editor.isActive('bold')}      title="Bold (Ctrl+B)"      onClick={() => editor.chain().focus().toggleBold().run()}><BoldIcon size={12} /></ToolbarBtn>
        <ToolbarBtn active={editor.isActive('italic')}    title="Italic (Ctrl+I)"    onClick={() => editor.chain().focus().toggleItalic().run()}><ItalicIcon size={12} /></ToolbarBtn>
        <ToolbarBtn active={editor.isActive('underline')} title="Underline (Ctrl+U)" onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={12} /></ToolbarBtn>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-0.5" />
        <ToolbarBtn active={editor.isActive('link')} title="Link"
          onClick={() => { if (editor.isActive('link')) { editor.chain().focus().unsetLink().run(); setShowLink(false); } else { setShowLink((v) => !v); } }}>
          {editor.isActive('link') ? <Unlink size={12} /> : <LinkIcon size={12} />}
        </ToolbarBtn>
        <div className="flex-1" />
        <ToolbarBtn title="Undo (Ctrl+Z)"       disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={11} /></ToolbarBtn>
        <ToolbarBtn title="Redo (Ctrl+Shift+Z)" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={11} /></ToolbarBtn>
      </div>

      {showLink && <LinkInput editor={editor} onClose={() => setShowLink(false)} />}
      <EditorContent editor={editor} />
      <CharCount editor={editor} maxLen={maxLen} />
    </div>
  );
};

// ─── Block Rich Editor ────────────────────────────────────────────────────────

export const BlockRichEditor: React.FC<RichFieldProps> = ({ value, onChange, blockType }) => {
  const [showLink, setShowLink] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxLen      = blockType ? MAX_LENGTHS[blockType] : undefined;

  const editor = useEditor({
    extensions: BLOCK_EXTENSIONS,
    content: parseRichTextInput(value),
    onUpdate: ({ editor: e }) => {
      const doc = e.getJSON() as TiptapDoc;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onChange(doc), 200);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none px-3 py-2 text-[13px] text-slate-900 dark:text-white focus:outline-none min-h-[80px]',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const incoming    = parseRichTextInput(value);
    const currentJson = JSON.stringify(editor.getJSON());
    const incomingJson = typeof incoming === 'object'
      ? JSON.stringify(incoming)
      : currentJson; // string → let Tiptap parse; skip re-set to avoid cursor jump on HTML strings
    if (typeof incoming === 'object' && currentJson !== incomingJson) {
      editor.commands.setContent(incoming, false);
    } else if (typeof incoming === 'string' && incoming !== '') {
      // Only re-set HTML strings when the editor is empty (initial load)
      if (editor.isEmpty) editor.commands.setContent(incoming, false);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-400 transition-all">
      <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <ToolbarBtn active={editor.isActive('bold')}      title="Bold (Ctrl+B)"      onClick={() => editor.chain().focus().toggleBold().run()}><BoldIcon size={12} /></ToolbarBtn>
        <ToolbarBtn active={editor.isActive('italic')}    title="Italic (Ctrl+I)"    onClick={() => editor.chain().focus().toggleItalic().run()}><ItalicIcon size={12} /></ToolbarBtn>
        <ToolbarBtn active={editor.isActive('underline')} title="Underline (Ctrl+U)" onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={12} /></ToolbarBtn>
        <ToolbarBtn active={editor.isActive('link')} title="Link"
          onClick={() => { if (editor.isActive('link')) { editor.chain().focus().unsetLink().run(); setShowLink(false); } else { setShowLink((v) => !v); } }}>
          {editor.isActive('link') ? <Unlink size={12} /> : <LinkIcon size={12} />}
        </ToolbarBtn>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-0.5" />
        <ToolbarBtn active={editor.isActive('heading', { level: 1 })} title="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={12} /></ToolbarBtn>
        <ToolbarBtn active={editor.isActive('heading', { level: 2 })} title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={12} /></ToolbarBtn>
        <ToolbarBtn active={editor.isActive('heading', { level: 3 })} title="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={12} /></ToolbarBtn>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-0.5" />
        <ToolbarBtn active={editor.isActive('bulletList')}  title="Bullet list"  onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={12} /></ToolbarBtn>
        <ToolbarBtn active={editor.isActive('orderedList')} title="Ordered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={12} /></ToolbarBtn>
        <div className="flex-1" />
        <ToolbarBtn title="Undo (Ctrl+Z)"       disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={11} /></ToolbarBtn>
        <ToolbarBtn title="Redo (Ctrl+Shift+Z)" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={11} /></ToolbarBtn>
      </div>

      {showLink && <LinkInput editor={editor} onClose={() => setShowLink(false)} />}
      <EditorContent editor={editor} />
      <CharCount editor={editor} maxLen={maxLen} />
    </div>
  );
};

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export interface RichTextFieldProps {
  field:     { richTextMode?: 'inline' | 'block'; placeholder?: string; maxLength?: number };
  value:     unknown;            // TiptapDoc | string | null | undefined
  onChange:  (v: unknown) => void;
  blockType?: string;
}

/**
 * Dispatches to InlineRichEditor or BlockRichEditor based on field.richTextMode.
 * Passes value through unchanged — never coerces to String() which would break
 * TiptapDoc objects.
 */
const RichTextField: React.FC<RichTextFieldProps> = ({ field, value, onChange, blockType }) => {
  const mode = field.richTextMode ?? 'inline';

  if (mode === 'block') {
    return (
      <BlockRichEditor
        value={value}
        onChange={onChange as (doc: TiptapDoc) => void}
        placeholder={field.placeholder}
        blockType={blockType}
      />
    );
  }

  return (
    <InlineRichEditor
      value={value}
      onChange={onChange as (doc: TiptapDoc) => void}
      placeholder={field.placeholder}
      blockType={blockType}
    />
  );
};

export default RichTextField;
