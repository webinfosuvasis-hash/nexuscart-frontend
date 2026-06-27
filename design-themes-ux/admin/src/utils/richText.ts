/**
 * richText.ts — Single source of truth for the NexusCart rich text system.
 *
 * Document model: ProseMirror JSON (Tiptap's native format).
 *   { type: "doc", content: [ { type: "paragraph", content: [...] } ] }
 *
 * Two rendering modes:
 *   "inline" — heading / announcement blocks
 *              Only inline marks allowed (bold, italic, underline, link).
 *              The outer <p> wrapper is stripped so content can live inside
 *              a <h1>, <span>, etc.
 *
 *   "block"  — paragraph blocks
 *              Full block structure: paragraphs, headings H1-H3, lists.
 *
 * Backward compatibility:
 *   If the stored value is a plain string (legacy HTML from Sprint 6),
 *   renderRichText() returns it unchanged after the inline <p> strip.
 *   Old blocks render correctly; they upgrade to JSON on next save.
 */

import { generateHTML } from '@tiptap/html';
import StarterKit        from '@tiptap/starter-kit';
import Underline         from '@tiptap/extension-underline';
import Link              from '@tiptap/extension-link';
import type { Extensions } from '@tiptap/core';

// ─── Extension sets ───────────────────────────────────────────────────────────
//
// These MUST match the extensions used in InlineRichEditor / BlockRichEditor
// in RichTextField.tsx. Centralised here so there's one authority for what
// nodes and marks the document model supports.

export const INLINE_EXTENSIONS: Extensions = [
  StarterKit.configure({
    heading:        false,
    bulletList:     false,
    orderedList:    false,
    listItem:       false,
    blockquote:     false,
    code:           false,
    codeBlock:      false,
    horizontalRule: false,
    // Keep: bold, italic, strike, hardBreak, history
  }),
  Underline,
  Link.configure({ openOnClick: false, protocols: ['http', 'https', 'mailto'] }),
];

export const BLOCK_EXTENSIONS: Extensions = [
  StarterKit.configure({
    code:           false,
    codeBlock:      false,
    blockquote:     false,
    horizontalRule: false,
    heading:        { levels: [1, 2, 3] },
    // Keep: bold, italic, strike, bulletList, orderedList, listItem, hardBreak, history
  }),
  Underline,
  Link.configure({ openOnClick: false, protocols: ['http', 'https', 'mailto'] }),
];

// ─── Type guard ───────────────────────────────────────────────────────────────

export interface TiptapDoc {
  type:    'doc';
  content: unknown[];
}

export function isTiptapDoc(value: unknown): value is TiptapDoc {
  return (
    typeof value === 'object'          &&
    value !== null                     &&
    (value as any).type    === 'doc'   &&
    Array.isArray((value as any).content)
  );
}

// ─── renderRichText ───────────────────────────────────────────────────────────

/**
 * Converts a rich text value to an HTML string for storefront rendering.
 *
 * Accepts two input formats:
 *   1. TiptapDoc  — new JSON document model (primary path)
 *   2. string     — legacy HTML from Sprint 6 (backward-compat path)
 *
 * For inline mode, strips the outer <p>…</p> wrapper produced by the
 * paragraph node so the content renders correctly inside heading/span tags.
 */
export function renderRichText(
  value: unknown,
  mode:  'inline' | 'block' = 'block',
): string {
  if (value === null || value === undefined || value === '') return '';

  let html: string;

  if (isTiptapDoc(value)) {
    // ── JSON path (new content) ──────────────────────────────────────────────
    const extensions = mode === 'inline' ? INLINE_EXTENSIONS : BLOCK_EXTENSIONS;
    try {
      html = generateHTML(value as any, extensions);
    } catch (err) {
      // Malformed doc — return empty rather than crashing the storefront
      console.warn('[richText] generateHTML failed:', err);
      return '';
    }
  } else if (typeof value === 'string') {
    // ── Legacy HTML path (Sprint 6 era, before JSON model) ──────────────────
    html = value;
  } else {
    return '';
  }

  if (mode === 'inline') {
    // Strip single wrapping <p>…</p> added by the paragraph node.
    // Content will be placed inside <h1>/<h2>/<span> by the caller.
    html = html
      .replace(/^<p>/, '')
      .replace(/<\/p>$/, '')
      .trim();
  }

  return html;
}

// ─── parseRichTextInput ───────────────────────────────────────────────────────

/**
 * Converts a raw settings value into content that Tiptap's setContent() accepts.
 *
 *   TiptapDoc  → returned as-is (Tiptap accepts ProseMirror JSON natively)
 *   string     → returned as-is (Tiptap parses the HTML string via its DOMParser)
 *   anything else → ''
 *
 * Used in RichTextField.tsx for initial content and external-sync effects.
 */
export function parseRichTextInput(value: unknown): TiptapDoc | string {
  if (isTiptapDoc(value)) return value;
  if (typeof value === 'string') return value;
  return '';
}

// ─── extractPlainText ─────────────────────────────────────────────────────────

/**
 * Walks a TiptapDoc tree and concatenates all text node content.
 * Used for client-side character counting when the editor has a stored JSON doc.
 */
export function extractPlainText(doc: TiptapDoc): string {
  let text = '';
  function walk(node: any): void {
    if (node.type === 'text') text += node.text ?? '';
    if (Array.isArray(node.content)) node.content.forEach(walk);
  }
  walk(doc);
  return text;
}

// ─── toPlainText ──────────────────────────────────────────────────────────────

/**
 * Converts any rich text value to a plain string — safe to call on values that
 * might be a TiptapDoc, a legacy HTML string, or undefined.
 *
 * Used anywhere the code needs to display a text preview (e.g., StructurePanel
 * block labels, SimulatedCanvas inline previews) without invoking the full HTML
 * rendering pipeline.
 */
export function toPlainText(value: unknown): string {
  if (!value) return '';
  if (isTiptapDoc(value)) return extractPlainText(value);
  if (typeof value === 'string') {
    // Strip HTML tags from legacy HTML strings
    return value.replace(/<[^>]*>/g, '').trim();
  }
  return '';
}
