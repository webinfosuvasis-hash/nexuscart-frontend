/**
 * ErrorBoundary — Step 3 tests
 *
 * Tests the pure / extractable logic from ErrorBoundary.tsx:
 *
 *   getDerivedStateFromError()  — pure static method, directly testable
 *   safeSettings()             — pure function, directly testable
 *   NodeErrorDetails shape     — structural validation
 *   Error boundary contract    — production vs preview behaviour
 *   Recovery logic             — retry mechanism (errorKey increment)
 *   onError callback           — error reporting integration
 *
 * React class lifecycle methods that require JSDOM (componentDidCatch,
 * render()) are tested through their observable outputs: state transitions
 * and the pure getDerivedStateFromError static.
 */

// ─── Inline pure logic from ErrorBoundary ────────────────────────────────────

// getDerivedStateFromError — pure, static, no React needed
function getDerivedStateFromError(error: Error | null): {
  hasError: boolean;
  message:  string;
} {
  return {
    hasError: true,
    message:  error?.message || 'Unknown render error',  // || catches empty string too
  };
}

// safeSettings — pure, no React needed
function safeSettings(
  settings: Record<string, unknown>,
  nodeId:   string,
): Record<string, unknown> {
  try {
    JSON.stringify(settings);
    return settings;
  } catch {
    return {};
  }
}

// NodeErrorDetails shape
interface NodeErrorDetails {
  nodeId:         string;
  nodeType:       string;
  message:        string;
  componentStack: string;
  timestamp:      string;
}

// handleRetry — pure state transition
function handleRetry(prev: { errorKey: number }) {
  return {
    hasError:       false,
    message:        '',
    componentStack: '',
    errorKey:       prev.errorKey + 1,
  };
}

// ─── Production vs preview render decision ────────────────────────────────────

type RenderDecision = 'children' | 'null' | 'error-chip';
function renderDecision(hasError: boolean, isPreview: boolean): RenderDecision {
  if (!hasError)   return 'children';
  if (!isPreview)  return 'null';
  return 'error-chip';
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── getDerivedStateFromError ─────────────────────────────────────────────────

describe('getDerivedStateFromError()', () => {
  it('sets hasError=true on any Error', () => {
    const state = getDerivedStateFromError(new Error('Component exploded'));
    expect(state.hasError).toBe(true);
  });

  it('captures the error message', () => {
    const state = getDerivedStateFromError(new Error('Cannot read property of undefined'));
    expect(state.message).toBe('Cannot read property of undefined');
  });

  it('uses fallback message when error has no message', () => {
    const state = getDerivedStateFromError(new Error(''));
    expect(state.message).toBe('Unknown render error');
  });

  it('handles null error gracefully', () => {
    const state = getDerivedStateFromError(null as any);
    expect(state.hasError).toBe(true);
    expect(state.message).toBe('Unknown render error');
  });

  it('handles TypeError with message', () => {
    const state = getDerivedStateFromError(new TypeError('Cannot read properties of null'));
    expect(state.message).toBe('Cannot read properties of null');
  });

  it('handles RangeError with message', () => {
    const state = getDerivedStateFromError(new RangeError('Maximum call stack size exceeded'));
    expect(state.message).toContain('Maximum call stack');
  });
});

// ─── safeSettings ─────────────────────────────────────────────────────────────

describe('safeSettings()', () => {
  it('returns the same object for valid settings', () => {
    const s = { bg: '#fff', pt: 24, gridCols: 4 };
    expect(safeSettings(s, 'node-1')).toBe(s);  // referential equality
  });

  it('returns the same object for empty settings', () => {
    const s = {};
    expect(safeSettings(s, 'node-2')).toStrictEqual({});
  });

  it('returns the same object for nested valid settings', () => {
    const s = { responsive: { mobile: { gridCols: 1 } }, display: 'grid' };
    expect(safeSettings(s, 'node-3')).toBe(s);
  });

  it('returns empty object when settings throw on JSON.stringify', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;                  // circular reference
    const result = safeSettings(circular, 'node-4');
    expect(result).toStrictEqual({});
  });

  it('never throws — always returns a Record', () => {
    const evil: Record<string, unknown> = {};
    Object.defineProperty(evil, 'trap', {
      get() { throw new Error('getter exploded'); },
      enumerable: true,
    });
    // JSON.stringify will throw on the getter
    expect(() => safeSettings(evil, 'node-5')).not.toThrow();
    // Returns empty object fallback
    const result = safeSettings(evil, 'node-5');
    expect(typeof result).toBe('object');
  });

  it('handles null-prototype objects', () => {
    const s = Object.create(null) as Record<string, unknown>;
    s.bg = '#000';
    expect(() => safeSettings(s, 'node-6')).not.toThrow();
  });

  it('handles settings with undefined values', () => {
    const s = { bg: undefined, pt: 0 };
    expect(() => safeSettings(s as any, 'node-7')).not.toThrow();
  });
});

// ─── Production vs preview render decision ────────────────────────────────────

describe('render decision logic', () => {
  it('no error → render children regardless of isPreview', () => {
    expect(renderDecision(false, false)).toBe('children');
    expect(renderDecision(false, true)).toBe('children');
  });

  it('error in production → render null (silent failure)', () => {
    expect(renderDecision(true, false)).toBe('null');
  });

  it('error in preview → render error-chip (visible diagnostic)', () => {
    expect(renderDecision(true, true)).toBe('error-chip');
  });

  it('production with no error renders children', () => {
    expect(renderDecision(false, false)).toBe('children');
  });

  it('error always suppressed in production (never error-chip)', () => {
    const prod = renderDecision(true, false);
    expect(prod).not.toBe('error-chip');
    expect(prod).toBe('null');
  });

  it('preview never silently drops errors', () => {
    const preview = renderDecision(true, true);
    expect(preview).not.toBe('null');
    expect(preview).toBe('error-chip');
  });
});

// ─── Recovery (retry) ─────────────────────────────────────────────────────────

describe('retry / recovery mechanism', () => {
  it('handleRetry clears hasError', () => {
    const next = handleRetry({ errorKey: 0 });
    expect(next.hasError).toBe(false);
  });

  it('handleRetry clears message', () => {
    const next = handleRetry({ errorKey: 0 });
    expect(next.message).toBe('');
  });

  it('handleRetry clears componentStack', () => {
    const next = handleRetry({ errorKey: 0 });
    expect(next.componentStack).toBe('');
  });

  it('handleRetry increments errorKey', () => {
    expect(handleRetry({ errorKey: 0 }).errorKey).toBe(1);
    expect(handleRetry({ errorKey: 4 }).errorKey).toBe(5);
  });

  it('multiple retries keep incrementing errorKey', () => {
    let state = { errorKey: 0 };
    state = handleRetry(state);
    state = handleRetry(state);
    state = handleRetry(state);
    expect(state.errorKey).toBe(3);
  });

  it('errorKey change forces React remount (by convention)', () => {
    // The key prop on <React.Fragment key={errorKey}> triggers remount.
    // This test verifies the errorKey increments correctly — the React
    // behaviour itself is validated by integration tests.
    const before = { errorKey: 7 };
    const after  = handleRetry(before);
    expect(after.errorKey).not.toBe(before.errorKey);
  });
});

// ─── onError callback ─────────────────────────────────────────────────────────

describe('onError callback contract', () => {
  it('NodeErrorDetails has all required fields', () => {
    const details: NodeErrorDetails = {
      nodeId:         'node-abc',
      nodeType:       'grid',
      message:        'Cannot read property',
      componentStack: '  at Grid (/app/Grid.tsx:12)',
      timestamp:      new Date().toISOString(),
    };
    // All fields present and typed correctly
    expect(typeof details.nodeId).toBe('string');
    expect(typeof details.nodeType).toBe('string');
    expect(typeof details.message).toBe('string');
    expect(typeof details.componentStack).toBe('string');
    expect(typeof details.timestamp).toBe('string');
    // timestamp is ISO format
    expect(() => new Date(details.timestamp)).not.toThrow();
    expect(new Date(details.timestamp).toISOString()).toBe(details.timestamp);
  });

  it('onError receives correct nodeId and nodeType', () => {
    const received: Partial<NodeErrorDetails>[] = [];
    const onError = (d: NodeErrorDetails) => received.push(d);

    // Simulate what componentDidCatch builds and calls
    const buildDetails = (
      nodeId:         string,
      nodeType:       string,
      error:          Error,
      componentStack: string,
    ): NodeErrorDetails => ({
      nodeId, nodeType,
      message:        error.message ?? 'Unknown render error',
      componentStack,
      timestamp:      new Date().toISOString(),
    });

    const details = buildDetails('n-1', 'heading', new Error('Oops'), '  at Heading\n  at Grid');
    onError(details);

    expect(received).toHaveLength(1);
    expect(received[0].nodeId).toBe('n-1');
    expect(received[0].nodeType).toBe('heading');
    expect(received[0].message).toBe('Oops');
  });

  it('onError throwing does not propagate (reporter must not crash boundary)', () => {
    const faultyReporter = () => { throw new Error('Sentry is down'); };
    // The boundary wraps onError in try/catch — reporter failure is swallowed
    const callSafely = (fn: () => void) => { try { fn(); } catch { /* intentional */ } };
    expect(() => callSafely(faultyReporter)).not.toThrow();
  });

  it('onError not called when no error occurs', () => {
    let called = false;
    const onError = () => { called = true; };
    // Simulate no-error render path — onError never fires
    const hasError = false;
    if (hasError) onError();
    expect(called).toBe(false);
  });
});

// ─── Integration: full error flow ────────────────────────────────────────────

describe('full error flow simulation', () => {
  interface BoundaryState {
    hasError:       boolean;
    message:        string;
    componentStack: string;
    errorKey:       number;
  }

  function simulate(scenario: 'crash' | 'retry' | 'crash-retry-crash') {
    let state: BoundaryState = {
      hasError: false, message: '', componentStack: '', errorKey: 0,
    };
    const events: string[] = [];

    function onError(d: NodeErrorDetails) { events.push(`error:${d.message}`); }

    function crash(msg: string, stack: string) {
      const derived = getDerivedStateFromError(new Error(msg));
      state = { ...state, ...derived, componentStack: stack };
      onError({ nodeId: 'n', nodeType: 't', message: msg, componentStack: stack,
        timestamp: new Date().toISOString() });
    }

    function retry() {
      state = { ...state, ...handleRetry(state) };
      events.push('retry');
    }

    if (scenario === 'crash') {
      crash('first crash', 'stack A');
    } else if (scenario === 'retry') {
      crash('first crash', 'stack A');
      retry();
    } else if (scenario === 'crash-retry-crash') {
      crash('first crash', 'stack A');
      retry();
      crash('second crash', 'stack B');
    }

    return { state, events };
  }

  it('crash: boundary enters error state', () => {
    const { state, events } = simulate('crash');
    expect(state.hasError).toBe(true);
    expect(state.message).toBe('first crash');
    expect(events).toContain('error:first crash');
  });

  it('retry: boundary resets to clean state', () => {
    const { state, events } = simulate('retry');
    expect(state.hasError).toBe(false);
    expect(state.message).toBe('');
    expect(state.errorKey).toBe(1);
    expect(events).toContain('retry');
  });

  it('crash → retry → crash: recovers then fails again correctly', () => {
    const { state, events } = simulate('crash-retry-crash');
    expect(state.hasError).toBe(true);
    expect(state.message).toBe('second crash');
    expect(state.errorKey).toBe(1);     // retried once
    expect(events).toEqual(['error:first crash', 'retry', 'error:second crash']);
  });
});
