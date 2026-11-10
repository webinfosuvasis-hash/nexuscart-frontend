// sanitize-html is a CommonJS module — use require-style import
import sanitizeHtml = require('sanitize-html');

/**
 * Allow-list mirrors `BLOCK_OPTIONS` in
 * modules/theme-engine/sections/block-settings-sanitizer.ts (the page
 * builder's rich-text sanitizer) so product descriptions and page-builder
 * content stay under the same editorial rules. Duplicated rather than
 * imported to avoid a common/catalog → modules/theme-engine dependency;
 * update both together if the allowed tag set changes.
 */
const ALLOWED_SCHEMES = ['http', 'https', 'mailto'];

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

const PRODUCT_DESCRIPTION_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'a', 'span',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3',
  ],
  allowedAttributes:  { a: ['href', 'target', 'rel'], span: ['class'] },
  allowedSchemes:     ALLOWED_SCHEMES,
  disallowedTagsMode: 'discard',
  transformTags:      { a: linkTransformer } as any,
};

/**
 * Sanitizes a product's rich-text `description` (authored via the admin's
 * contentEditable editor, stored as raw innerHTML with no write-time
 * sanitization) before it leaves the storefront API. Plain-text descriptions
 * (no tags) pass through unchanged.
 */
export function sanitizeProductDescription(html: string | null): string | null {
  if (!html) return html;
  const sanitized = sanitizeHtml(html, PRODUCT_DESCRIPTION_OPTIONS).trim();
  return sanitized;
}
