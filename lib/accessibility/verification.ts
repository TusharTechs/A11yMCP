import type {
  AuditResult,
  NegotiatedProfile,
  RemediationCategory,
  VerificationResult,
} from "@/types/accessibility";
import {
  auditAccessibleNames,
  auditFocusVisibility,
  auditFormAssociations,
  auditKeyboardNavigation,
} from "./audits";
import { getNegotiationSnapshot } from "./negotiation";

export function runAllAudits(root: Element): AuditResult[] {
  return [
    auditKeyboardNavigation(root),
    auditAccessibleNames(root),
    auditFormAssociations(root),
    auditFocusVisibility(root),
  ];
}

/** Audit result id → the capability category it belongs to. */
const AUDIT_TO_CATEGORY: Record<string, RemediationCategory> = {
  keyboard_navigation: "keyboard_navigation",
  accessible_names: "accessible_names",
  form_association: "form_association",
  focus_visibility: "focus_management",
};

interface VerificationOptions {
  /**
   * The negotiated profile to verify against. Defaults to the last
   * negotiation recorded this session. Pass `null` explicitly to verify
   * every audit category (full-scope check).
   */
  profile?: NegotiatedProfile | null;
}

/**
 * Verifies the page against the *negotiated profile*, not against every
 * possible audit. A keyboard-only user who negotiated keyboard + focus
 * support is not "BLOCKED" because an unrelated icon button elsewhere on
 * the page lacks a name — that is reported as an advisory instead. This is
 * the contract model: the site adapts what it agreed to adapt, and
 * verification confirms exactly that.
 */
export function buildVerification(
  root: Element,
  options?: VerificationOptions
): VerificationResult {
  const profile =
    options && "profile" in options
      ? options.profile
      : getNegotiationSnapshot().lastNegotiation;

  const results = runAllAudits(root);

  const scopeCategories: Set<RemediationCategory> | null = profile
    ? new Set(profile.accepted.map((item) => item.capability))
    : null;

  const isInScope = (auditId: string): boolean => {
    if (!scopeCategories) return true;
    const category = AUDIT_TO_CATEGORY[auditId];
    return category ? scopeCategories.has(category) : false;
  };

  const checks = results.map((result) => {
    const inScope = isInScope(result.id);
    const blocking = result.violations.filter(
      (violation) => violation.taskImpact === "blocking"
    );
    return {
      id: result.id,
      title: result.title,
      inScope,
      pass: inScope ? blocking.length === 0 : result.pass,
      violationCount: result.violations.length,
    };
  });

  // A negotiation that accepted nothing means the site cannot satisfy any of
  // this person's needs. Reporting PASS there — because an empty scope has
  // nothing in it left to fail — tells them the opposite of the truth. It is
  // BLOCKED: there is no profile under which this task is accessible.
  const nothingAccepted = Boolean(profile) && profile!.accepted.length === 0;

  const blockedInScope =
    nothingAccepted || checks.some((check) => check.inScope && !check.pass);

  const advisories = results
    .filter((result) => !isInScope(result.id))
    .flatMap((result) => result.violations);

  return {
    profile: profile ? profile.id : "full-scope",
    profileId: profile ? profile.id : null,
    generatedAt: new Date().toISOString(),
    taskAccessibility: blockedInScope ? "BLOCKED" : "PASS",
    summary: blockedInScope ? "fail" : "pass",
    checks,
    violations: results.flatMap((result) => result.violations),
    advisories,
  };
}
