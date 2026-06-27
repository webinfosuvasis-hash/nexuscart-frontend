/**
 * NodeErrorBoundary — Sprint 10, Step 3
 *
 * Per-node subtree isolation boundary.
 *
 * Invariants:
 *   - One broken node never crashes the page (strangler-fig safety net)
 *   - Production: render nothing — store loads, broken subtree is invisible
 *   - Preview:    render a visible red chip with type, message, stack, retry
 *   - onError:    optional callback for Sentry / Datadog / custom tracking
 *   - Recovery:   retry button resets state so merchant can keep working
 *
 * Usage:
 *   // Wrap a node subtree:
 *   <NodeErrorBoundary nodeId={id} nodeType={type} isPreview={true}>
 *     <SomeComponent />
 *   </NodeErrorBoundary>
 *
 *   // Or via the functional HOC (used by renderNode):
 *   withErrorBoundary(nodeId, nodeType, isPreview, element)
 *
 * Extension point (Sprint 15 — observability):
 *   Pass onError={reportToSentry} to route errors to your tracking service.
 */

import React from 'react';

// ─── Error details shape ──────────────────────────────────────────────────────

export interface NodeErrorDetails {
  nodeId:         string;
  nodeType:       string;
  message:        string;
  componentStack: string;
  timestamp:      string;
}

// ─── Props and state ──────────────────────────────────────────────────────────

interface Props {
  nodeId:    string;
  nodeType:  string;
  isPreview: boolean;
  children:  React.ReactNode;
  /** Optional error reporting callback. Called with full error details. */
  onError?:  (details: NodeErrorDetails) => void;
}

interface State {
  hasError:       boolean;
  message:        string;
  componentStack: string;
  errorKey:       number;    // incremented on retry to reset the subtree
}

// ─── Class component ─────────────────────────────────────────────────────────

export class NodeErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '', componentStack: '', errorKey: 0 };
    this.handleRetry = this.handleRetry.bind(this);
  }

  /** Pure function — called before render on error. Testable in isolation. */
  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      message:  error?.message || 'Unknown render error',  // || catches empty string too
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const stack = info?.componentStack ?? '';

    // Store component stack for display in preview
    this.setState({ componentStack: stack });

    // Build error details object
    const details: NodeErrorDetails = {
      nodeId:         this.props.nodeId,
      nodeType:       this.props.nodeType,
      message:        error?.message ?? 'Unknown render error',
      componentStack: stack,
      timestamp:      new Date().toISOString(),
    };

    // Route to custom tracker (Sentry, Datadog, etc.)
    if (this.props.onError) {
      try { this.props.onError(details); } catch { /* never let the reporter crash */ }
    }

    // Dev-only console output
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        `[NodeRenderer] Error in <${this.props.nodeType}> (id: ${this.props.nodeId})\n` +
        `Message: ${error?.message}\n` +
        `Stack:${stack}`,
      );
    }
  }

  /** Reset boundary state so children can re-render (used by retry button). */
  handleRetry(): void {
    this.setState((prev) => ({
      hasError:       false,
      message:        '',
      componentStack: '',
      errorKey:       prev.errorKey + 1,
    }));
  }

  render(): React.ReactNode {
    const { hasError, message, componentStack, errorKey } = this.state;
    const { nodeId, nodeType, isPreview, children } = this.props;

    if (!hasError) {
      // key forces React to remount the subtree on retry
      return (
        <React.Fragment key={errorKey}>
          {children}
        </React.Fragment>
      );
    }

    // Production: invisible — page continues to load without this subtree
    if (!isPreview) return null;

    // Preview: visible diagnostic chip with retry
    return (
      <div
        data-node-error={nodeId}
        data-node-error-type={nodeType}
        role="alert"
        style={{
          padding:      '10px 14px',
          margin:       '4px 0',
          border:       '1.5px dashed #F43F5E',
          borderRadius: 6,
          background:   'rgba(244,63,94,0.06)',
          fontFamily:   'JetBrains Mono, monospace',
          fontSize:     11,
          color:        '#F43F5E',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span>
            <strong>Render error</strong>
            {' · '}
            <span style={{ opacity: 0.85 }}>{nodeType}</span>
            {' · '}
            {message}
          </span>
          <button
            onClick={this.handleRetry}
            title="Retry rendering this node"
            style={{
              cursor:       'pointer',
              border:       '1px solid #F43F5E',
              borderRadius: 4,
              background:   'transparent',
              color:        '#F43F5E',
              fontSize:     10,
              padding:      '2px 8px',
              fontFamily:   'inherit',
              flexShrink:   0,
            }}
          >
            Retry
          </button>
        </div>

        {/* Stack trace (collapsed by default via <details>) */}
        {componentStack && (
          <details style={{ marginTop: 6, opacity: 0.7 }}>
            <summary style={{ cursor: 'pointer', fontSize: 10 }}>
              Component stack
            </summary>
            <pre style={{ margin: '4px 0 0', fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {componentStack.trim()}
            </pre>
          </details>
        )}
      </div>
    );
  }
}

// ─── Functional HOC (used by renderNode) ─────────────────────────────────────

export function withErrorBoundary(
  nodeId:    string,
  nodeType:  string,
  isPreview: boolean,
  children:  React.ReactNode,
  onError?:  (details: NodeErrorDetails) => void,
): React.ReactNode {
  return (
    <NodeErrorBoundary
      nodeId={nodeId}
      nodeType={nodeType}
      isPreview={isPreview}
      onError={onError}
    >
      {children}
    </NodeErrorBoundary>
  );
}

// ─── Settings-error wrapper (invalid settings fallback) ───────────────────────

/**
 * Wraps a settings bag in a try/catch.
 * If accessing settings throws (e.g., a getter or Proxy raises), returns
 * a safe empty object so the renderer proceeds with defaults.
 *
 * In practice settings are plain objects so this never fires —
 * but the guard makes the renderer resilient to future extensions
 * (e.g., settings backed by reactive stores).
 */
export function safeSettings(
  settings: Record<string, unknown>,
  nodeId:   string,
): Record<string, unknown> {
  try {
    // Attempt to serialize — surfaces any getter-level errors
    JSON.stringify(settings);
    return settings;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[NodeRenderer] Invalid settings on node ${nodeId}:`, err);
    }
    return {};
  }
}
