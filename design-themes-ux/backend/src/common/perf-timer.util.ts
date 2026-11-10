/**
 * Lightweight per-request step timer used to diagnose slow read endpoints.
 * Wraps individual async operations (usually a single DB round trip) and
 * records how long each took, plus an overall total. Cheap enough
 * (performance.now() deltas only) to leave wired in permanently; verbose
 * output is gated by the caller behind an env flag so it stays silent by
 * default in production.
 */
export interface PerfStep {
  name: string;
  ms:   number;
}

export class PerfTimer {
  private readonly startedAt = performance.now();
  private readonly steps: PerfStep[] = [];

  /** Times an async operation and records it under `name`. Returns the operation's own result. */
  async time<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const t0 = performance.now();
    try {
      return await fn();
    } finally {
      this.steps.push({ name, ms: round(performance.now() - t0) });
    }
  }

  /** Records a step whose duration was measured externally (e.g. two branches of a Promise.all). */
  mark(name: string, ms: number): void {
    this.steps.push({ name, ms: round(ms) });
  }

  summary(): { totalMs: number; steps: PerfStep[] } {
    return { totalMs: round(performance.now() - this.startedAt), steps: this.steps };
  }
}

function round(ms: number): number {
  return Math.round(ms * 100) / 100;
}
