// ─── ContentNode tree types ───────────────────────────────────────────────────
// These live in the PageDocument.tree / SymbolDocument.tree JSON column.

export interface Node {
  id:          string;
  type:        string;                       // ComponentDefinition.id
  label?:      string;                       // merchant-editable display name
  settings:    Record<string, unknown>;      // base (desktop) settings
  responsive?: {
    tablet?: Partial<Record<string, unknown>>;
    mobile?: Partial<Record<string, unknown>>;
  };
  visibility?: {
    desktop?: boolean;
    tablet?:  boolean;
    mobile?:  boolean;
  };
  binding?:    CompiledBinding;
  symbolRef?:  SymbolRef;
  children?:   Node[];
}

export type CompiledBinding =
  | {
      kind:    'list';
      source:  'collection' | 'products' | 'menu' | 'recommendations' | 'context';
      ref:     { mode: 'fixed'; id: string } | { mode: 'context' };
      sort?:   string;
      filters?: { field: string; operator: string; value: unknown }[];
      limit:   number;
      contextProvides: string;
    }
  | { kind: 'field'; path: string[] };

export interface SymbolRef {
  handle:    string;
  overrides: Record<string, unknown>;
}

// ─── Document shapes ──────────────────────────────────────────────────────────

export interface PageDocumentData {
  id?:           string;
  storeId:       string;
  themeId:       string;
  scope:         'PAGE' | 'SYMBOL' | 'HEADER' | 'FOOTER' | 'ANNOUNCEMENT';
  ownerKey:      string;
  status:        'DRAFT' | 'PUBLISHED';
  version:       number;
  schemaVersion: number;
  tree:          Node;
  seo?:          Record<string, unknown> | null;
  settings?:     Record<string, unknown> | null;
}

// ─── Source shape (from Prisma — ThemePageSection + ThemePageBlock) ───────────

export interface RawBlock {
  id:        string;
  type:      string;
  settings:  Record<string, unknown>;
  sortOrder: number | string;
  isVisible: boolean;
}

export interface RawSection {
  id:          string;
  sectionDefId:string;
  label:       string | null;
  settings:    Record<string, unknown>;
  sortOrder:   number | string;
  isVisible:   boolean;
  isDraft:     boolean;
  blocks:      RawBlock[];
}
