/**
 * Section Editor Framework — shared types.
 *
 * Every Aurus section editor is built on these primitives.
 * The framework is Aurus-specific by design — it matches the exact
 * section structure, workflow, and UI patterns of the Aurus theme.
 */

export type Viewport = 'desktop' | 'tablet' | 'mobile';
export type EditorTab = 'content' | 'display' | 'schedule' | 'history';
export type ValidationErrors = Record<string, string>;

/** React Query key for the homepage — shared across all editors */
export const HOMEPAGE_QUERY_KEY = ['page-builder', 'homepage'] as const;

/**
 * Render props passed to the content tab renderer.
 * Every editor receives these to build its form fields.
 */
export interface ContentRenderProps<T> {
  config: T;
  onChange: (config: T) => void;
  errors: ValidationErrors;
}

/**
 * Render props passed to the preview renderer.
 * The preview shows a CSS representation of the live section.
 */
export interface PreviewRenderProps<T> {
  config: T;
  viewport: Viewport;
}

/**
 * Top-level props for every section editor.
 * The SectionEditor shell consumes these to build the complete UI.
 */
export interface SectionEditorProps<T extends object> {
  sectionId: string;
  /** Display label shown in the editor header — matches Aurus section name */
  sectionLabel: string;
  /** Called when the user clicks "← Overview" */
  onBack: () => void;
  /** Default config used when no saved config exists yet */
  defaultConfig: T;
  /** Parses raw JSON from the API into the typed config */
  parseConfig: (raw: unknown) => T;
  /** Optional validator — returns field-level error messages */
  validate?: (config: T) => ValidationErrors;
  /** Renders the left-pane live preview */
  renderPreview: (config: T, viewport: Viewport) => React.ReactNode;
  /** Renders the Content tab form fields */
  renderContent: (config: T, onChange: (c: T) => void, errors: ValidationErrors) => React.ReactNode;
  /** Renders the Display Settings tab — if omitted, tab is hidden */
  renderDisplay?: (config: T, onChange: (c: T) => void) => React.ReactNode;
}
