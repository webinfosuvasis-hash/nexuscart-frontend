export interface RecoveryRunStats {
  recovered: number;
  failed:    number;
  skipped:   number;
  durationMs: number;
}

export const EMPTY_STATS: Readonly<RecoveryRunStats> = {
  recovered:  0,
  failed:     0,
  skipped:    0,
  durationMs: 0,
};
