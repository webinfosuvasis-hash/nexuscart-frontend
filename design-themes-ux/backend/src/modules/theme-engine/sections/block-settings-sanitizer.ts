import { Injectable, BadRequestException, Logger } from '@nestjs/common';
// sanitize-html is a CommonJS module — use require-style import
import sanitizeHtml = require('sanitize-html');

// ─── Allowed link protocols ────────────────────────────────────────────────────

const ALLOWED_SCHEMES = ['http', 'https', 'mailto'];

// ─── sanitize-html link transformer ──────────────────────────────────────────

const linkTransformer: sanitizeHtml.Transformer = (tagName, attribs) => {
  const href = (attribs['href'] ?? '').trim();

  const schemeMatch = href.match(/^([a-zA-Z][a-zA-Z0-9+\-.]*):\/?\/?/);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (!ALLOWED_SCHEMES.includes(scheme)) {
      return { tagName: 'span', attribs: {} };
    }
  } else if (href && !href.startsWith('#') && !href.startsWith('/')) {
    return { tagName: 'span', attribs: {} };
  }

  const newAttribs: sanitizeHtml.Attributes = {};
  if (href) newAttribs['href'] = href;
  if (attribs['target'] === '_blank') {
    newAttribs['target'] = '_blank';
    newAttribs['rel']    = 'noopener noreferrer';
  }
  return { tagName, attribs: newAttribs };
};

// ─── sanitize-html options (HTML string legacy path) ─────────────────────────

const INLINE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags:        ['b', 'strong', 'i', 'em', 'u', 's', 'a', 'br', 'span'],
  allowedAttributes:  { a: ['href', 'target', 'rel'], span: ['class'] },
  allowedSchemes:     ALLOWED_SCHEMES,
  disallowedTagsMode: 'discard',
  transformTags:      { a: linkTransformer } as any,
};

const BLOCK_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'a', 'span',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3',
  ],
  allowedAttributes:  { a: ['href', 'target', 'rel'], span: ['class'] },
  allowedSchemes:     ALLOWED_SCHEMES,
  disallowedTagsMode: 'discard',
  transformTags:      { a: linkTransformer } as any,
};

// ─── JSON doc allowed types per mode ─────────────────────────────────────────

const JSON_ALLOWED_NODES: Record<'inline' | 'block', Set<string>> = {
  inline: new Set(['doc', 'paragraph', 'text', 'hardBreak']),
  block:  new Set(['doc', 'paragraph', 'text', 'hardBreak', 'heading', 'bulletList', 'orderedList', 'listItem']),
};

const JSON_ALLOWED_MARKS: Set<string> = new Set(['bold', 'italic', 'underline', 'strike', 'link']);

// ─── Per-block rich text field configuration ──────────────────────────────────

export interface RichTextField {
  key:       string;
  mode:      'inline' | 'block';
  maxLength: number;
}

export const RICH_TEXT_FIELDS: Record<string, RichTextField[]> = {
  heading:      [{ key: 'text', mode: 'inline', maxLength: 500   }],
  paragraph:    [{ key: 'text', mode: 'block',  maxLength: 10000 }],
  announcement: [{ key: 'text', mode: 'inline', maxLength: 250   }],
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class BlockSettingsSanitizer {
  private readonly logger = new Logger(BlockSettingsSanitizer.name);

  /**
   * Sanitizes all rich_text fields in a block's settings object.
   *
   * Handles two input formats:
   *
   *   1. TiptapDoc (JSON) — { type: 'doc', content: [...] }
   *      Walks the node tree, removes disallowed node/mark types, validates
   *      link hrefs, counts plain-text characters.
   *      Used by new content saved through the JSON document model editor.
   *
   *   2. HTML string — legacy format from Sprint 6.
   *      Sanitized with sanitize-html (the original 41-test path).
   *      Returned as a sanitized HTML string for backward compatibility.
   *      Old blocks that have not yet been re-saved still render correctly.
   */
  sanitize(
    blockType: string,
    settings:  Record<string, unknown>,
  ): Record<string, unknown> {
    const rtFields = RICH_TEXT_FIELDS[blockType];
    if (!rtFields || rtFields.length === 0) return settings;

    const result: Record<string, unknown> = { ...settings };

    for (const field of rtFields) {
      const raw = result[field.key];
      if (raw === null || raw === undefined) continue;

      if (this.isTiptapDoc(raw)) {
        // ── JSON doc path (new content) ──────────────────────────────────────
        result[field.key] = this.sanitizeJsonDoc(
          raw as Record<string, unknown>,
          field.mode,
          field.maxLength,
          blockType,
          field.key,
        );
      } else {
        // ── HTML string path (legacy content) ────────────────────────────────
        const options   = field.mode === 'block' ? BLOCK_OPTIONS : INLINE_OPTIONS;
        let sanitized   = sanitizeHtml(String(raw), options);

        sanitized = sanitized
          .replace(/<p>\s*<\/p>/g, '')
          .replace(/<p><\/p>/g, '')
          .trim();

        const plainText = sanitizeHtml(sanitized, {
          allowedTags:       [],
          allowedAttributes: {},
        });

        if (plainText.length > field.maxLength) {
          throw new BadRequestException(
            `Block field "${field.key}" exceeds the maximum of ` +
            `${field.maxLength} characters for block type "${blockType}". ` +
            `Current content: ${plainText.length} characters.`,
          );
        }

        if (String(raw) !== sanitized) {
          this.logger.warn(
            `Sanitized block settings for type "${blockType}", field "${field.key}". ` +
            `Raw length=${String(raw).length}, sanitized length=${sanitized.length}`,
          );
        }

        result[field.key] = sanitized;
      }
    }

    return result;
  }

  sanitizeOrPassthrough(
    blockType: string | undefined,
    settings:  Record<string, unknown> | undefined,
  ): Record<string, unknown> {
    if (!blockType || !settings) return settings ?? {};
    return this.sanitize(blockType, settings);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private isTiptapDoc(value: unknown): boolean {
    return (
      typeof value === 'object'  &&
      value !== null             &&
      (value as any).type    === 'doc' &&
      Array.isArray((value as any).content)
    );
  }

  /**
   * Walks a ProseMirror JSON document and:
   *   1. Removes any node types not in the allowlist for the mode.
   *   2. Removes any mark types not in the allowlist.
   *   3. Validates link mark href protocols.
   *   4. Counts plain-text characters and enforces maxLength.
   */
  private sanitizeJsonDoc(
    doc:       Record<string, unknown>,
    mode:      'inline' | 'block',
    maxLength: number,
    blockType: string,
    fieldKey:  string,
  ): Record<string, unknown> {
    const allowedNodes = JSON_ALLOWED_NODES[mode];

    const sanitizeNode = (node: any): any | null => {
      if (!node || typeof node !== 'object') return null;

      const nodeType: string = node.type ?? '';

      // Remove unknown node types
      if (!allowedNodes.has(nodeType)) return null;

      // Sanitize marks on text nodes
      let marks = node.marks ?? [];
      if (marks.length > 0) {
        marks = marks
          .filter((m: any) => JSON_ALLOWED_MARKS.has(m.type))
          .map((m: any) => {
            if (m.type !== 'link') return m;
            // Validate link href protocol
            const href = (m.attrs?.href ?? '').trim();
            const schemeMatch = href.match(/^([a-zA-Z][a-zA-Z0-9+\-.]*):\/?\/?/);
            if (schemeMatch && !ALLOWED_SCHEMES.includes(schemeMatch[1].toLowerCase())) {
              return null; // remove the link mark entirely
            }
            // Enforce rel="noopener noreferrer" when target="_blank"
            const attrs: Record<string, string> = { href };
            if (m.attrs?.target === '_blank') {
              attrs.target = '_blank';
              attrs.rel    = 'noopener noreferrer';
            }
            return { type: 'link', attrs };
          })
          .filter(Boolean);
      }

      // Recursively sanitize child content
      let content: any[] | undefined;
      if (Array.isArray(node.content)) {
        content = node.content
          .map(sanitizeNode)
          .filter((n: any) => n !== null);
      }

      const sanitized: any = { type: nodeType };
      if (marks.length > 0)            sanitized.marks   = marks;
      if (content !== undefined)        sanitized.content = content;
      if (node.text !== undefined)      sanitized.text    = String(node.text);
      if (node.attrs !== undefined)     sanitized.attrs   = node.attrs;

      return sanitized;
    };

    const sanitizedDoc = sanitizeNode(doc);

    if (!sanitizedDoc) {
      throw new BadRequestException(
        `Invalid rich text document for field "${fieldKey}" in block type "${blockType}".`,
      );
    }

    // Count plain-text characters
    const plainText = this.extractText(sanitizedDoc);
    if (plainText.length > maxLength) {
      throw new BadRequestException(
        `Block field "${fieldKey}" exceeds the maximum of ` +
        `${maxLength} characters for block type "${blockType}". ` +
        `Current content: ${plainText.length} characters.`,
      );
    }

    return sanitizedDoc;
  }

  /** Walks a ProseMirror JSON node tree and concatenates all text content. */
  private extractText(node: any): string {
    let text = '';
    if (node.type === 'text') text += node.text ?? '';
    if (Array.isArray(node.content)) {
      for (const child of node.content) text += this.extractText(child);
    }
    return text;
  }
}
