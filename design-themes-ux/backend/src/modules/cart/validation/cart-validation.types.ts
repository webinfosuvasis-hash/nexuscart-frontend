export type ValidationSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'BLOCKER';

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  itemId?: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  hasBlockers: boolean;
  isValid: boolean;
}
