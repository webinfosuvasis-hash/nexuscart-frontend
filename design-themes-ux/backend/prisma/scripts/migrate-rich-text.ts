/**
 * migrate-rich-text.ts — One-time migration: HTML strings → TiptapDoc JSON
 *
 * STRATEGY (lazy migration is the default — this script is optional):
 *   New content is stored as TiptapDoc JSON from the editor automatically.
 *   Old content (HTML strings) continues to render correctly via the legacy
 *   path in renderRichText(). Each block auto-upgrades to JSON the next time
 *   a merchant opens and saves it in the Theme Editor.
 *
 *   Run this script ONLY if you want to proactively upgrade ALL existing
 *   HTML string content to JSON documents in one batch.
 *
 * HOW IT WORKS:
 *   Tiptap's generateJSON() (from @tiptap/html) parses an HTML string
 *   back into a ProseMirror JSON document using the same extension sets
 *   defined in the shared richText utility. The resulting JSON is then
 *   written back to ThemePageBlock.settings.
 *
 * DOM REQUIREMENT:
 *   generateJSON() uses a DOMParser internally. In Node.js this requires
 *   the `jsdom` package as a DOM polyfill:
 *
 *     npm install --save-dev jsdom @types/jsdom
 *
 *   Without jsdom, the script will fail with "DOMParser is not defined".
 *   Install jsdom ONLY in devDependencies — it is not needed at runtime.
 *
 * USAGE:
 *   npx ts-node --project tsconfig.json prisma/scripts/migrate-rich-text.ts
 *
 *   Add --dry-run to preview changes without writing:
 *   npx ts-node ... migrate-rich-text.ts --dry-run
 *
 * SAFETY:
 *   - Idempotent: blocks whose settings.text is already a TiptapDoc are skipped.
 *   - Fails loudly: any parse error aborts the block and logs the block ID.
 *   - Does NOT delete original data — backs up to settings._legacyHtmlText.
 */

import { PrismaClient } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { JSDOM } = require('jsdom') as typeof import('jsdom');

// ─── DOM polyfill (required by @tiptap/html in Node.js) ──────────────────────
// Must be installed before importing @tiptap packages.
const dom = new JSDOM('');
(global as any).window        = dom.window;
(global as any).document      = dom.window.document;
(global as any).DOMParser     = dom.window.DOMParser;
(global as any).Node          = dom.window.Node;
(global as any).HTMLElement   = dom.window.HTMLElement;
(global as any).Element       = dom.window.Element;

// ─── Import Tiptap AFTER DOM polyfill is set ─────────────────────────────────
import { generateJSON } from '@tiptap/html';
import StarterKit       from '@tiptap/starter-kit';
import Underline        from '@tiptap/extension-underline';
import Link             from '@tiptap/extension-link';
import type { Extensions } from '@tiptap/core';

// ─── Extension sets (must match richText.ts and RichTextField.tsx) ───────────

const INLINE_EXTENSIONS: Extensions = [
  StarterKit.configure({
    heading: false, bulletList: false, orderedList: false,
    listItem: false, blockquote: false, code: false,
    codeBlock: false, horizontalRule: false,
  }),
  Underline,
  Link.configure({ openOnClick: false, protocols: ['http', 'https', 'mailto'] }),
];

const BLOCK_EXTENSIONS: Extensions = [
  StarterKit.configure({
    code: false, codeBlock: false, blockquote: false,
    horizontalRule: false, heading: { levels: [1, 2, 3] },
  }),
  Underline,
  Link.configure({ openOnClick: false, protocols: ['http', 'https', 'mailto'] }),
];

// ─── Rich text field definitions (mirrors RICH_TEXT_FIELDS in sanitizer) ──────

const RICH_TEXT_FIELDS: Record<string, { key: string; mode: 'inline' | 'block' }[]> = {
  heading:      [{ key: 'text', mode: 'inline' }],
  paragraph:    [{ key: 'text', mode: 'block'  }],
  announcement: [{ key: 'text', mode: 'inline' }],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isTiptapDoc(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as any).type === 'doc' &&
    Array.isArray((value as any).content)
  );
}

function htmlToDoc(html: string, mode: 'inline' | 'block'): object {
  const exts = mode === 'inline' ? INLINE_EXTENSIONS : BLOCK_EXTENSIONS;
  return generateJSON(html, exts);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const prisma  = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n🔄 Rich text migration — ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE RUN'}\n`);

  const blockTypes = Object.keys(RICH_TEXT_FIELDS);

  // Fetch all blocks that have a rich text field type
  const blocks = await (prisma as any).themePageBlock.findMany({
    where: { type: { in: blockTypes } },
    select: { id: true, type: true, settings: true, storeId: true },
  });

  console.log(`Found ${blocks.length} rich-text blocks across ${blockTypes.join(', ')}\n`);

  let migrated = 0;
  let skipped  = 0;
  let errored  = 0;

  for (const block of blocks) {
    const fields = RICH_TEXT_FIELDS[block.type];
    const settings = block.settings as Record<string, any>;
    let changed = false;
    const newSettings: Record<string, any> = { ...settings };

    for (const field of fields) {
      const value = settings[field.key];

      if (value === null || value === undefined || value === '') {
        continue;
      }

      if (isTiptapDoc(value)) {
        skipped++;
        console.log(`  ⏭  [${block.id}] ${block.type}.${field.key} — already JSON doc`);
        continue;
      }

      if (typeof value !== 'string') {
        console.warn(`  ⚠️  [${block.id}] ${block.type}.${field.key} — unexpected value type: ${typeof value}`);
        errored++;
        continue;
      }

      // Convert HTML string → TiptapDoc
      try {
        const doc = htmlToDoc(value, field.mode);
        newSettings[field.key]                 = doc;
        newSettings[`_legacyHtmlText_${field.key}`] = value; // backup
        changed = true;
        console.log(`  ✓  [${block.id}] ${block.type}.${field.key} — converted ${value.length} chars`);
      } catch (err: any) {
        console.error(`  ✗  [${block.id}] ${block.type}.${field.key} — parse error: ${err.message}`);
        errored++;
      }
    }

    if (changed && !DRY_RUN) {
      await (prisma as any).themePageBlock.update({
        where: { id: block.id },
        data:  { settings: newSettings },
      });
      migrated++;
    } else if (changed) {
      migrated++;
    }
  }

  console.log(`
Migration complete:
  ✓ Migrated:  ${migrated}
  ⏭ Skipped:   ${skipped}
  ✗ Errors:    ${errored}
${DRY_RUN ? '\n  (Dry run — no changes written to database)' : ''}
`);

  if (errored > 0) process.exit(1);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
