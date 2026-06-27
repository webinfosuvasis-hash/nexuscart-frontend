/**
 * richText parity hardening tests — Phase 10B
 *
 * Verifies the critical difference between renderRichText() and toPlainText()
 * that motivated the AnnouncementBlock fix.
 *
 * toPlainText()    → used for text previews (StructurePanel labels)
 *                    strips ALL HTML tags — incorrect for storefront rendering
 *
 * renderRichText() → used for storefront rendering
 *                    preserves HTML formatting (bold, italic, links)
 *                    strips outer <p>…</p> in 'inline' mode
 *
 * Both functions handle the legacy string format (plain HTML strings stored
 * before the Tiptap JSON model was introduced).  The TiptapDoc path is NOT
 * tested here because it invokes @tiptap/html which requires a browser
 * environment for full extension initialisation.
 */

import { describe, it, expect } from 'vitest';
import { renderRichText, toPlainText } from './richText';

// ─── renderRichText — legacy HTML string path ─────────────────────────────────

describe('renderRichText — legacy HTML string input', () => {
  it('returns a plain string unchanged in block mode', () => {
    expect(renderRichText('Hello world')).toBe('Hello world');
  });

  it('preserves bold tags', () => {
    expect(renderRichText('<b>Sale!</b>', 'inline')).toBe('<b>Sale!</b>');
  });

  it('preserves italic tags', () => {
    expect(renderRichText('<em>New</em> arrivals', 'inline')).toBe('<em>New</em> arrivals');
  });

  it('preserves anchor links', () => {
    const input = '<a href="/sale">Shop now</a>';
    expect(renderRichText(input, 'inline')).toBe(input);
  });

  it('preserves mixed formatting', () => {
    const input = 'Free shipping on orders <strong>over ₹1500</strong>!';
    expect(renderRichText(input, 'inline')).toContain('<strong>over ₹1500</strong>');
  });

  it('strips outer <p> wrapper in inline mode', () => {
    expect(renderRichText('<p>Welcome to our store</p>', 'inline')).toBe('Welcome to our store');
  });

  it('strips outer <p> with inner formatting in inline mode', () => {
    const result = renderRichText('<p><b>Sale</b> ends soon</p>', 'inline');
    expect(result).toBe('<b>Sale</b> ends soon');
    expect(result).not.toContain('<p>');
  });

  it('does NOT strip outer <p> in block mode', () => {
    const result = renderRichText('<p>Paragraph</p>', 'block');
    expect(result).toContain('<p>');
  });

  it('returns empty string for null', () => {
    expect(renderRichText(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(renderRichText(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(renderRichText('')).toBe('');
  });
});

// ─── toPlainText — demonstrates why it is WRONG for announcements ─────────────

describe('toPlainText — strips HTML (used for labels, NOT storefront)', () => {
  it('strips bold tags', () => {
    expect(toPlainText('<b>Sale!</b>')).toBe('Sale!');
  });

  it('strips all HTML tags', () => {
    expect(toPlainText('<em>New</em> <b>arrivals</b>')).toBe('New arrivals');
  });

  it('strips links — loses href', () => {
    expect(toPlainText('<a href="/sale">Shop now</a>')).toBe('Shop now');
  });
});

// ─── Parity contract: renderRichText ≠ toPlainText on formatted input ─────────

describe('renderRichText vs toPlainText — parity contract', () => {
  const formattedText = '<b>Summer</b> Sale — 30% off!';

  it('renderRichText preserves HTML structure', () => {
    expect(renderRichText(formattedText, 'inline')).toContain('<b>');
  });

  it('toPlainText loses HTML structure', () => {
    expect(toPlainText(formattedText)).not.toContain('<b>');
  });

  it('the two functions produce DIFFERENT output for formatted text', () => {
    const a = renderRichText(formattedText, 'inline');
    const b = toPlainText(formattedText);
    expect(a).not.toBe(b);
  });

  it('both functions handle plain text identically', () => {
    const plain = 'Welcome to our store';
    expect(renderRichText(plain, 'inline')).toBe(plain);
    expect(toPlainText(plain)).toBe(plain);
  });
});
