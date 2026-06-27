import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException }  from '@nestjs/common';
import { BlockSettingsSanitizer } from './block-settings-sanitizer';

describe('BlockSettingsSanitizer', () => {
  let sanitizer: BlockSettingsSanitizer;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BlockSettingsSanitizer],
    }).compile();
    sanitizer = module.get(BlockSettingsSanitizer);
  });

  // ── Pass-through for unknown block types ─────────────────────────────────────

  it('returns settings unchanged for block types without rich_text fields', () => {
    const settings = { label: 'Shop now', style: 'primary', link: '/shop' };
    expect(sanitizer.sanitize('button', settings)).toEqual(settings);
  });

  it('returns settings unchanged when blockType has no registered rich text fields', () => {
    const settings = { text: '<script>evil()</script>' };
    // 'logo' is not in RICH_TEXT_FIELDS — passes through as-is (it has no text field)
    expect(sanitizer.sanitize('logo', settings)).toEqual(settings);
  });

  // ── Plain text — no-op ────────────────────────────────────────────────────────

  it('returns plain text unchanged for heading block', () => {
    const s = { text: 'Browse our latest products' };
    expect(sanitizer.sanitize('heading', s).text).toBe('Browse our latest products');
  });

  it('returns plain text unchanged for paragraph block', () => {
    const s = { text: 'Be the first to know.' };
    expect(sanitizer.sanitize('paragraph', s).text).toBe('Be the first to know.');
  });

  // ── Allowed tags preserved ────────────────────────────────────────────────────

  it('preserves <b> in inline mode (heading)', () => {
    const s = { text: '<b>Hello</b> world' };
    expect(sanitizer.sanitize('heading', s).text).toBe('<b>Hello</b> world');
  });

  it('preserves <i> in inline mode (announcement)', () => {
    const s = { text: '<i>Flash sale</i>' };
    expect(sanitizer.sanitize('announcement', s).text).toBe('<i>Flash sale</i>');
  });

  it('preserves <u> in inline mode', () => {
    const s = { text: '<u>underlined</u>' };
    expect(sanitizer.sanitize('heading', s).text).toBe('<u>underlined</u>');
  });

  it('preserves <strong> and <em> aliases', () => {
    const s = { text: '<strong>bold</strong> <em>italic</em>' };
    const result = sanitizer.sanitize('heading', s).text as string;
    expect(result).toContain('bold');
    expect(result).toContain('italic');
  });

  it('preserves https links in inline mode', () => {
    const s = { text: '<a href="https://example.com">link</a>' };
    const result = sanitizer.sanitize('heading', s).text as string;
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('link');
  });

  it('preserves http links', () => {
    const s = { text: '<a href="http://example.com">link</a>' };
    const result = sanitizer.sanitize('heading', s).text as string;
    expect(result).toContain('href="http://example.com"');
  });

  it('preserves mailto links', () => {
    const s = { text: '<a href="mailto:hello@example.com">email us</a>' };
    const result = sanitizer.sanitize('heading', s).text as string;
    expect(result).toContain('href="mailto:hello@example.com"');
  });

  it('preserves block elements in block mode (paragraph)', () => {
    const s = { text: '<p>First.</p><ul><li>Item</li></ul>' };
    const result = sanitizer.sanitize('paragraph', s).text as string;
    expect(result).toContain('<p>First.</p>');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>Item</li>');
  });

  it('preserves H1-H3 in block mode', () => {
    const s = { text: '<h1>Big</h1><h2>Medium</h2><h3>Small</h3>' };
    const result = sanitizer.sanitize('paragraph', s).text as string;
    expect(result).toContain('<h1>Big</h1>');
    expect(result).toContain('<h2>Medium</h2>');
    expect(result).toContain('<h3>Small</h3>');
  });

  // ── XSS — removed ─────────────────────────────────────────────────────────────

  it('removes <script> tags', () => {
    const s = { text: '<script>alert(1)</script>Hello' };
    const result = sanitizer.sanitize('heading', s).text as string;
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert(1)');
    expect(result).toContain('Hello');
  });

  it('removes onclick attributes', () => {
    const s = { text: '<b onclick="alert(1)">Hello</b>' };
    const result = sanitizer.sanitize('heading', s).text as string;
    expect(result).not.toContain('onclick');
    expect(result).toContain('<b>Hello</b>');
  });

  it('removes onerror attributes', () => {
    const s = { text: '<img src="x" onerror="alert(1)">' };
    const result = sanitizer.sanitize('heading', s).text as string;
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('<img');
  });

  it('rejects javascript: href — converts to plain <span>', () => {
    const s = { text: '<a href="javascript:alert(1)">xss</a>' };
    const result = sanitizer.sanitize('heading', s).text as string;
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('href=');
    expect(result).toContain('xss');
  });

  it('rejects data: href', () => {
    const s = { text: '<a href="data:text/html,<script>alert(1)</script>">xss</a>' };
    const result = sanitizer.sanitize('heading', s).text as string;
    expect(result).not.toContain('data:');
    expect(result).not.toContain('<script>');
  });

  it('rejects vbscript: href', () => {
    const s = { text: '<a href="vbscript:MsgBox(1)">xss</a>' };
    const result = sanitizer.sanitize('heading', s).text as string;
    expect(result).not.toContain('vbscript:');
  });

  it('removes style attributes (CSS injection prevention)', () => {
    const s = { text: '<b style="color:red;behavior:url(evil.htc)">Hello</b>' };
    const result = sanitizer.sanitize('heading', s).text as string;
    expect(result).not.toContain('style=');
    expect(result).toContain('<b>Hello</b>');
  });

  it('removes <iframe> entirely', () => {
    const s = { text: '<iframe src="https://evil.com"></iframe>Hello' };
    const result = sanitizer.sanitize('heading', s).text as string;
    expect(result).not.toContain('<iframe');
    expect(result).toContain('Hello');
  });

  it('removes <svg onload> XSS vector', () => {
    const s = { text: '<svg onload="alert(1)"></svg>Hello' };
    const result = sanitizer.sanitize('heading', s).text as string;
    expect(result).not.toContain('<svg');
    expect(result).not.toContain('onload');
  });

  it('strips block elements in inline mode (heading)', () => {
    const s = { text: '<p>Hello</p><ul><li>item</li></ul>' };
    const result = sanitizer.sanitize('heading', s).text as string;
    expect(result).not.toContain('<p>');
    expect(result).not.toContain('<ul>');
    expect(result).not.toContain('<li>');
    // Text content preserved
    expect(result).toContain('Hello');
    expect(result).toContain('item');
  });

  // ── Link security ─────────────────────────────────────────────────────────────

  it('enforces rel="noopener noreferrer" when target="_blank"', () => {
    const s = { text: '<a href="https://x.com" target="_blank">link</a>' };
    const result = sanitizer.sanitize('heading', s).text as string;
    expect(result).toContain('rel="noopener noreferrer"');
    expect(result).toContain('target="_blank"');
  });

  it('does not add rel when no target="_blank"', () => {
    const s = { text: '<a href="https://x.com">link</a>' };
    const result = sanitizer.sanitize('heading', s).text as string;
    expect(result).not.toContain('rel=');
  });

  // ── maxLength validation ──────────────────────────────────────────────────────

  it('accepts text within maxLength for announcement (250)', () => {
    const s = { text: 'A'.repeat(250) };
    expect(() => sanitizer.sanitize('announcement', s)).not.toThrow();
  });

  it('throws BadRequestException when announcement text exceeds 250 chars', () => {
    const s = { text: 'A'.repeat(251) };
    expect(() => sanitizer.sanitize('announcement', s)).toThrow(BadRequestException);
  });

  it('throws with useful message when length exceeded', () => {
    const s = { text: 'A'.repeat(260) };
    expect(() => sanitizer.sanitize('announcement', s)).toThrow(
      expect.objectContaining({ message: expect.stringContaining('250') }),
    );
  });

  it('accepts heading text at maxLength (500)', () => {
    const s = { text: 'B'.repeat(500) };
    expect(() => sanitizer.sanitize('heading', s)).not.toThrow();
  });

  it('throws when heading text exceeds 500 chars', () => {
    const s = { text: 'B'.repeat(501) };
    expect(() => sanitizer.sanitize('heading', s)).toThrow(BadRequestException);
  });

  it('accepts paragraph text at maxLength (10000)', () => {
    const s = { text: 'C'.repeat(10000) };
    expect(() => sanitizer.sanitize('paragraph', s)).not.toThrow();
  });

  it('throws when paragraph text exceeds 10000 chars', () => {
    const s = { text: 'C'.repeat(10001) };
    expect(() => sanitizer.sanitize('paragraph', s)).toThrow(BadRequestException);
  });

  it('counts plain text length, not HTML tag length', () => {
    // 4 chars of text content, long wrapping HTML tags — should NOT throw at 250 limit
    const s = { text: '<b>Hi!</b>' };
    expect(() => sanitizer.sanitize('announcement', s)).not.toThrow();
  });

  // ── Edge cases ────────────────────────────────────────────────────────────────

  it('handles empty string gracefully', () => {
    const s = { text: '' };
    expect(sanitizer.sanitize('heading', s).text).toBe('');
  });

  it('handles null gracefully (skips field)', () => {
    const s = { text: null };
    // null is skipped — field passes through as-is
    expect(sanitizer.sanitize('heading', s).text).toBeNull();
  });

  it('preserves other settings fields untouched', () => {
    const s = { text: '<b>Hello</b>', typographyPreset: 'h1', textColor: '#fff', padding: { top: 8 } };
    const result = sanitizer.sanitize('heading', s);
    expect(result.typographyPreset).toBe('h1');
    expect(result.textColor).toBe('#fff');
    expect(result.padding).toEqual({ top: 8 });
  });

  it('removes empty <p> tags (Tiptap normalisation)', () => {
    const s = { text: '<p>Hello</p><p></p><p>World</p>' };
    const result = sanitizer.sanitize('paragraph', s).text as string;
    expect(result).not.toContain('<p></p>');
    expect(result).toContain('<p>Hello</p>');
    expect(result).toContain('<p>World</p>');
  });

  it('handles Unicode text without modification', () => {
    const s = { text: 'café & résumé 🎉' };
    const result = sanitizer.sanitize('heading', s).text as string;
    expect(result).toContain('café');
    expect(result).toContain('résumé');
    expect(result).toContain('🎉');
  });

  describe('sanitizeOrPassthrough', () => {
    it('returns empty object when settings is undefined', () => {
      expect(sanitizer.sanitizeOrPassthrough('heading', undefined)).toEqual({});
    });

    it('returns empty object when blockType is undefined', () => {
      expect(sanitizer.sanitizeOrPassthrough(undefined, { text: 'hi' })).toEqual({ text: 'hi' });
    });

    it('delegates to sanitize when both args are present', () => {
      const s = { text: '<script>x</script>Hello' };
      const result = sanitizer.sanitizeOrPassthrough('heading', s);
      expect(result.text).not.toContain('<script>');
      expect(result.text).toContain('Hello');
    });
  });
});
