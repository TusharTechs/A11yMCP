export type Severity = "high" | "medium" | "low";

export interface AccessibilityViolation {
  id: string;
  rule: string;
  severity: Severity;
  selector: string;
  message: string;
}

export interface AccessibilityNode {
  role: string;
  name?: string;
  nameSource?: string;
  focusable?: boolean;
  selector?: string;
  violations?: AccessibilityViolation[];
  children?: AccessibilityNode[];
}

export interface AuditResult {
  id: string;
  title: string;
  pass: boolean;
  violations: AccessibilityViolation[];
}

export type RemediationCategory =
  | "accessible_names"
  | "keyboard_navigation"
  | "form_association"
  | "focus_management";

export interface ChangeRecord {
  selector: string;
  change: string;
}

export interface RemediationResult {
  success: boolean;
  remediationId: string;
  category: RemediationCategory;
  alreadyApplied?: boolean;
  changes: ChangeRecord[];
  beforeViolations: number;
  afterViolations: number;
  reversible: boolean;
}

export interface RemediationSnapshot {
  applied: Record<RemediationCategory, boolean>;
}

export interface VerificationCheck {
  id: string;
  title: string;
  pass: boolean;
  violationCount: number;
}

export interface VerificationResult {
  profile: string;
  generatedAt: string;
  taskAccessibility: "PASS" | "BLOCKED";
  summary: "pass" | "fail";
  checks: VerificationCheck[];
  violations: AccessibilityViolation[];
}