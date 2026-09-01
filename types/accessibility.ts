export type Severity = "high" | "medium" | "low";

export type TaskImpact = "blocking" | "degrading" | "informational";

export type SiteId = "site-a" | "site-b";

export interface AccessibilityViolation {
  id: string;
  rule: string;
  severity: Severity;
  taskImpact: TaskImpact;
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
  | "focus_management"
  | "reduced_motion";

export interface ChangeRecord {
  selector: string;
  change: string;
}

export interface EvidenceStep {
  stage: "before" | "why" | "action" | "after" | "verification";
  detail: string;
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
  evidenceChain: EvidenceStep[];
}

export interface RemediationSnapshot {
  applied: Record<RemediationCategory, boolean>;
}

export interface VerificationCheck {
  id: string;
  title: string;
  pass: boolean;
  violationCount: number;
  /** Whether this audit category is part of the negotiated profile. */
  inScope?: boolean;
}

export interface VerificationResult {
  profile: string;
  /** Negotiation id this verification was scoped to, or null for full-scope. */
  profileId?: string | null;
  generatedAt: string;
  taskAccessibility: "PASS" | "BLOCKED";
  summary: "pass" | "fail";
  checks: VerificationCheck[];
  violations: AccessibilityViolation[];
  /** Blocking/degrading issues outside the negotiated profile (not gating). */
  advisories?: AccessibilityViolation[];
}

export const ALL_NEEDS = [
  "keyboard_only",
  "strong_focus",
  "screen_reader_labels",
  "form_support",
  "high_contrast",
  "reduced_motion",
  "large_targets",
] as const;

export type AccessibilityNeed = (typeof ALL_NEEDS)[number];

export interface UserProfile {
  id: string;
  label: string;
  needs: AccessibilityNeed[];
}

export type CapabilityStatus = "supported" | "partial";

export interface AcceptedCapability {
  need: AccessibilityNeed;
  capability: RemediationCategory;
  status: CapabilityStatus;
  limitation?: string;
  remediationTool: string;
}

export interface RejectedNeed {
  need: AccessibilityNeed;
  reason: string;
}

export interface NegotiatedProfile {
  id: string;
  requestedNeeds: AccessibilityNeed[];
  accepted: AcceptedCapability[];
  rejected: RejectedNeed[];
  generatedAt: string;
}