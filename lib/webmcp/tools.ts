import {
  auditAccessibleNames,
  auditFocusVisibility,
  auditFormAssociations,
  auditKeyboardNavigation,
} from "@/lib/accessibility/audits";
import { SITE_MANIFEST } from "@/lib/accessibility/manifest";
import {
  applyRemediation,
  getRemediationSnapshot,
  rollbackAll,
  totalViolations,
} from "@/lib/accessibility/remediation";
import { buildAccessibilityTree } from "@/lib/accessibility/tree";
import {
  buildVerification,
  runAllAudits,
} from "@/lib/accessibility/verification";
import { registerA11yTool } from "./runtime";
import {
  ApprovalInputSchema,
  EmptyInputSchema,
  approvalInputJsonSchema,
  emptyInputJsonSchema,
} from "./schemas";

export type Phase2EventType =
  | "TOOL_INVOKED"
  | "AUDIT_COMPLETED"
  | "REMEDIATION_APPLIED"
  | "ROLLBACK_APPLIED"
  | "VERIFICATION_COMPLETED";

export interface Phase2EventInput {
  type: Phase2EventType;
  tool: string;
  message: string;
}

export interface Phase2Callbacks {
  logEvent: (event: Phase2EventInput) => void;
  getRoot: () => Element | null;
}

type ApprovalInput = { approval: boolean };

let callbacks: Phase2Callbacks | null = null;
let phase2ToolsRegistered = false;

export function setPhase2Callbacks(cb: Phase2Callbacks): void {
  callbacks = cb;
}

function requireCallbacks(): Phase2Callbacks {
  if (!callbacks) {
    throw new Error("A11yMCP Phase 2 callbacks are not initialized.");
  }
  return callbacks;
}

function requireRoot(): Element {
  const root = requireCallbacks().getRoot();
  if (!root) {
    throw new Error("NOMA fixture is not mounted.");
  }
  return root;
}

function logEvent(
  type: Phase2EventType,
  tool: string,
  message: string
): void {
  requireCallbacks().logEvent({ type, tool, message });
}

export function registerPhase2ToolsOnce(): void {
  if (phase2ToolsRegistered) return;
  phase2ToolsRegistered = true;

  registerA11yTool({
    name: "get_accessibility_capabilities",
    title: "Get accessibility capabilities",
    description:
      "Returns the accessibility capabilities declared by this site's A11yMCP manifest.",
    inputSchema: emptyInputJsonSchema,
    annotations: { readOnlyHint: true },
    schema: EmptyInputSchema,
    run: async () => {
      logEvent(
        "TOOL_INVOKED",
        "get_accessibility_capabilities",
        "Capability discovery requested."
      );
      return {
        protocol: "a11ymcp/0.2",
        site: SITE_MANIFEST.site,
        generatedAt: new Date().toISOString(),
        capabilities: SITE_MANIFEST.capabilities,
        limitations: [
          "Phase 2 covers names, keyboard operability, form association, and focus visibility.",
          "Remediations are site-declared via the manifest; the engine validates and applies them.",
        ],
      };
    },
  });

  registerA11yTool({
    name: "get_accessibility_state",
    title: "Get accessibility state",
    description:
      "Returns applied remediations and the current total violation count for the fixture.",
    inputSchema: emptyInputJsonSchema,
    annotations: { readOnlyHint: true },
    schema: EmptyInputSchema,
    run: async () => {
      const root = requireRoot();
      logEvent(
        "TOOL_INVOKED",
        "get_accessibility_state",
        "Accessibility state requested."
      );
      const applied = getRemediationSnapshot().applied;
      return {
        mode: "phase-2",
        generatedAt: new Date().toISOString(),
        applied,
        totalViolations: totalViolations(root),
        rollbackAvailable: Object.values(applied).some(Boolean),
      };
    },
  });

  registerA11yTool({
    name: "inspect_accessibility_tree",
    title: "Inspect accessibility tree",
    description:
      "Returns a normalized accessibility tree for the fixture with current violations attached.",
    inputSchema: emptyInputJsonSchema,
    annotations: { readOnlyHint: true },
    schema: EmptyInputSchema,
    run: async () => {
      const root = requireRoot();
      logEvent(
        "TOOL_INVOKED",
        "inspect_accessibility_tree",
        "Accessibility tree inspection requested."
      );
      const violations = runAllAudits(root).flatMap((r) => r.violations);
      return buildAccessibilityTree(root, violations);
    },
  });

  registerA11yTool({
    name: "audit_keyboard_navigation",
    title: "Audit keyboard navigation",
    description:
      "Detects interactive elements that are not keyboard focusable and positive tabindex issues.",
    inputSchema: emptyInputJsonSchema,
    annotations: { readOnlyHint: true },
    schema: EmptyInputSchema,
    run: async () => {
      const root = requireRoot();
      const result = auditKeyboardNavigation(root);
      logEvent(
        "AUDIT_COMPLETED",
        "audit_keyboard_navigation",
        `${result.violations.length} violation(s) found.`
      );
      return result;
    },
  });

  registerA11yTool({
    name: "audit_accessible_names",
    title: "Audit accessible names",
    description:
      "Detects interactive controls that have no accessible name.",
    inputSchema: emptyInputJsonSchema,
    annotations: { readOnlyHint: true },
    schema: EmptyInputSchema,
    run: async () => {
      const root = requireRoot();
      const result = auditAccessibleNames(root);
      logEvent(
        "AUDIT_COMPLETED",
        "audit_accessible_names",
        `${result.violations.length} violation(s) found.`
      );
      return result;
    },
  });

  registerA11yTool({
    name: "audit_form_associations",
    title: "Audit form associations",
    description:
      "Detects form fields missing labels, placeholder-only labels, and unassociated error messages.",
    inputSchema: emptyInputJsonSchema,
    annotations: { readOnlyHint: true },
    schema: EmptyInputSchema,
    run: async () => {
      const root = requireRoot();
      const result = auditFormAssociations(root);
      logEvent(
        "AUDIT_COMPLETED",
        "audit_form_associations",
        `${result.violations.length} violation(s) found.`
      );
      return result;
    },
  });

  registerA11yTool({
    name: "audit_focus_visibility",
    title: "Audit focus visibility",
    description:
      "Probes each focusable control and detects missing visible focus indicators.",
    inputSchema: emptyInputJsonSchema,
    annotations: { readOnlyHint: true },
    schema: EmptyInputSchema,
    run: async () => {
      const root = requireRoot();
      const result = auditFocusVisibility(root);
      logEvent(
        "AUDIT_COMPLETED",
        "audit_focus_visibility",
        `${result.violations.length} violation(s) found.`
      );
      return result;
    },
  });

  registerA11yTool({
    name: "repair_accessible_names",
    title: "Repair accessible names",
    description:
      "Applies the site-declared accessible name remediation (reversible). Requires user approval.",
    inputSchema: approvalInputJsonSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    schema: ApprovalInputSchema,
    run: async () => {
      const root = requireRoot();
      logEvent(
        "TOOL_INVOKED",
        "repair_accessible_names",
        "Requested accessible name remediation."
      );
      const result = await applyRemediation("accessible_names", root);
      logEvent(
        "REMEDIATION_APPLIED",
        "repair_accessible_names",
        `Violations ${result.beforeViolations} -> ${result.afterViolations}.`
      );
      return result;
    },
  });

  registerA11yTool({
    name: "repair_keyboard_navigation",
    title: "Repair keyboard navigation",
    description:
      "Applies the site-declared keyboard remediation for the size selector (reversible). Requires user approval.",
    inputSchema: approvalInputJsonSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    schema: ApprovalInputSchema,
    run: async () => {
      const root = requireRoot();
      logEvent(
        "TOOL_INVOKED",
        "repair_keyboard_navigation",
        "Requested keyboard navigation remediation."
      );
      const result = await applyRemediation("keyboard_navigation", root);
      logEvent(
        "REMEDIATION_APPLIED",
        "repair_keyboard_navigation",
        `Violations ${result.beforeViolations} -> ${result.afterViolations}.`
      );
      return result;
    },
  });

  registerA11yTool({
    name: "repair_form_associations",
    title: "Repair form associations",
    description:
      "Applies the site-declared label and error association remediation (reversible). Requires user approval.",
    inputSchema: approvalInputJsonSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    schema: ApprovalInputSchema,
    run: async () => {
      const root = requireRoot();
      logEvent(
        "TOOL_INVOKED",
        "repair_form_associations",
        "Requested form association remediation."
      );
      const result = await applyRemediation("form_association", root);
      logEvent(
        "REMEDIATION_APPLIED",
        "repair_form_associations",
        `Violations ${result.beforeViolations} -> ${result.afterViolations}.`
      );
      return result;
    },
  });

  registerA11yTool({
    name: "repair_focus_management",
    title: "Repair focus management",
    description:
      "Applies the site-declared visible focus remediation (reversible). Requires user approval.",
    inputSchema: approvalInputJsonSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    schema: ApprovalInputSchema,
    run: async () => {
      const root = requireRoot();
      logEvent(
        "TOOL_INVOKED",
        "repair_focus_management",
        "Requested focus management remediation."
      );
      const result = await applyRemediation("focus_management", root);
      logEvent(
        "REMEDIATION_APPLIED",
        "repair_focus_management",
        `Violations ${result.beforeViolations} -> ${result.afterViolations}.`
      );
      return result;
    },
  });

  registerA11yTool({
    name: "verify_accessibility_profile",
    title: "Verify accessibility profile",
    description:
      "Runs all audits and reports whether the task-critical accessibility state passes.",
    inputSchema: emptyInputJsonSchema,
    annotations: { readOnlyHint: true },
    schema: EmptyInputSchema,
    run: async () => {
      const root = requireRoot();
      logEvent(
        "TOOL_INVOKED",
        "verify_accessibility_profile",
        "Verification requested."
      );
      const result = buildVerification(root);
      logEvent(
        "VERIFICATION_COMPLETED",
        "verify_accessibility_profile",
        result.summary === "pass" ? "Verification passed." : "Verification failed."
      );
      return result;
    },
  });

  registerA11yTool({
    name: "rollback_all_remediations",
    title: "Rollback all remediations",
    description:
      "Reverts every applied remediation and returns the fixture to its original state.",
    inputSchema: emptyInputJsonSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    schema: EmptyInputSchema,
    run: async () => {
      const root = requireRoot();
      logEvent(
        "TOOL_INVOKED",
        "rollback_all_remediations",
        "Requested rollback of all remediations."
      );
      const result = await rollbackAll(root);
      logEvent(
        "ROLLBACK_APPLIED",
        "rollback_all_remediations",
        `Rolled back: ${result.rolledBack.join(", ") || "none"}.`
      );
      return result;
    },
  });
}