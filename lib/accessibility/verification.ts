import type { AuditResult, VerificationResult } from "@/types/accessibility";
import {
  auditAccessibleNames,
  auditFocusVisibility,
  auditFormAssociations,
  auditKeyboardNavigation,
} from "./audits";

export function runAllAudits(root: Element): AuditResult[] {
  return [
    auditKeyboardNavigation(root),
    auditAccessibleNames(root),
    auditFormAssociations(root),
    auditFocusVisibility(root),
  ];
}

export function buildVerification(root: Element): VerificationResult {
  const results = runAllAudits(root);
  const pass = results.every((result) => result.pass);

  return {
    profile: "phase2-keyboard-checkout",
    generatedAt: new Date().toISOString(),
    taskAccessibility: pass ? "PASS" : "BLOCKED",
    summary: pass ? "pass" : "fail",
    checks: results.map((result) => ({
      id: result.id,
      title: result.title,
      pass: result.pass,
      violationCount: result.violations.length,
    })),
    violations: results.flatMap((result) => result.violations),
  };
}