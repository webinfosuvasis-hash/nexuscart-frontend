import { sanitizeProductDescription } from './product-html-sanitizer';

describe('sanitizeProductDescription', () => {
  // ── Pass-through ─────────────────────────────────────────────────────────────

  it('returns null unchanged', () => {
    expect(sanitizeProductDescription(null)).toBeNull();
  });

  it('returns empty string unchanged', () => {
    expect(sanitizeProductDescription('')).toBe('');
  });

  it('leaves plain text (pre-rich-text legacy descriptions) unchanged', () => {
    const plain = 'A handcrafted silk saree with gold zari border.';
    expect(sanitizeProductDescription(plain)).toBe(plain);
  });

  // ── Allowed formatting preserved (matches the admin RichTextEditor toolbar) ────

  it('preserves bold/italic/underline', () => {
    const html = '<p><b>Bold</b> <i>italic</i> <u>underline</u></p>';
    expect(sanitizeProductDescription(html)).toBe(html);
  });

  it('preserves headings and bullet lists', () => {
    const html = '<h2>Materials</h2><ul><li>Silk</li><li>Zari</li></ul>';
    expect(sanitizeProductDescription(html)).toBe(html);
  });

  it('preserves blockquote-adjacent formatting produced by the editor (p, h3, ol)', () => {
    const html = '<h3>Care</h3><ol><li>Dry clean only</li></ol><p>Store flat.</p>';
    expect(sanitizeProductDescription(html)).toBe(html);
  });

  // ── XSS vectors neutralized ──────────────────────────────────────────────────

  it('strips <script> tags entirely', () => {
    const html = '<p>Great product</p><script>alert(document.cookie)</script>';
    const out = sanitizeProductDescription(html);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(');
    expect(out).toBe('<p>Great product</p>');
  });

  it('strips inline event-handler attributes (onerror, onload, etc.)', () => {
    const html = '<p onclick="alert(1)">Click me</p><img src=x onerror="alert(1)">';
    const out = sanitizeProductDescription(html)!;
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('<img'); // img is not in the allow-list at all
  });

  it('strips javascript: URLs from links', () => {
    const html = '<a href="javascript:alert(1)">click</a>';
    const out = sanitizeProductDescription(html)!;
    expect(out).not.toContain('javascript:');
  });

  it('keeps http(s)/mailto links and forces rel=noopener on target=_blank', () => {
    const html = '<a href="https://example.com" target="_blank">Learn more</a>';
    const out = sanitizeProductDescription(html)!;
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('discards disallowed tags (iframe, style, svg) while keeping their safe text', () => {
    const html = '<p>Safe</p><iframe src="//evil.example"></iframe><style>body{display:none}</style>';
    const out = sanitizeProductDescription(html)!;
    expect(out).not.toContain('<iframe');
    expect(out).not.toContain('<style');
    expect(out).toContain('<p>Safe</p>');
  });

  it('neutralizes a JSON-LD-breakout attempt (</script> inside content)', () => {
    // ProductJsonLd embeds product.description inside a <script type="application/ld+json">
    // tag; an unsanitized "</script><script>..." payload would previously have been able
    // to break out of that JSON context. Confirms the shared sanitized field closes this too.
    const html = '<p>Nice</p></script><script>alert(1)</script>';
    const out = sanitizeProductDescription(html)!;
    expect(out).not.toContain('<script');
  });
});
