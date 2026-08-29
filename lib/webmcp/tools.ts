import { registerA11yTool } from "./runtime";
import {
  EmptyInputSchema,
  RepairFocusInputSchema,
  emptyInputJsonSchema,
  repairFocusInputJsonSchema,
} from "./schemas";

export type Phase1EventType =
  | "TOOL_INVOKED"
  | "REMEDIATION_APPLIED"
  | "ROLLBACK_APPLIED"
  | "VERIFICATION_COMPLETED";

export interface Phase1EventInput {
  type: Phase1EventType;
  tool: string;
  message: string;
}

export interface Phase1Callbacks {
  logEvent: (event: Phase1EventInput) => void;
  getFocusEnabled: () => boolean;
  setFocusEnabled: (value: boolean) => void;
}

interface LastRemediation {
  id: string;
  target: string;
  appliedAt: string;
}

type RepairFocusInput = {
  scope: "page" | "preview";
  approval: boolean;
};

let callbacks: Phase1Callbacks | null = null;
let phase1ToolsRegistered = false;
let lastRemediation: LastRemediation | null = null;

export function setPhase1Callbacks(cb: Phase1Callbacks): void {
  callbacks = cb;
}

function requireCallbacks(): Phase1Callbacks {
  if (!callbacks) {
    throw new Error("A11yMCP Phase 1 callbacks are not initialized.");
  }

  return callbacks;
}

function logEvent(
  type: Phase1EventType,
  tool: string,
  message: string
): void {
  requireCallbacks().logEvent({
    type,
    tool,
    message,
  });
}

function getFocusEnabled(): boolean {
  return requireCallbacks().getFocusEnabled();
}

function getCapabilities() {
  return {
    version: "0.1.0",
    generatedAt: new Date().toISOString(),
    supportedCapabilities: [
      {
        id: "focus_management",
        title: "Focus management",
        status: "supported",
        actions: ["repair_focus_management", "rollback_focus_management"],
        verification: ["verify_accessibility_profile"],
      },
      {
        id: "task_verification",
        title: "Task verification",
        status: "supported",
        actions: ["verify_accessibility_profile"],
        verification: ["verify_accessibility_profile"],
      },
    ],
    limitations: [
      "Phase 1 demonstrates focus visibility only.",
      "This is a controlled proof-of-life environment.",
    ],
  };
}

function getState() {
  const focusEnabled = getFocusEnabled();

  return {
    mode: "phase-1",
    generatedAt: new Date().toISOString(),
    focusRingEnabled: focusEnabled,
    rollbackAvailable: focusEnabled,
    activeRemediation: lastRemediation,
    negotiatedProfile: focusEnabled
      ? {
          id: "phase1-focus-management",
          acceptedCapabilities: ["focus_management"],
        }
      : null,
  };
}

function getTree() {
  const focusEnabled = getFocusEnabled();

  return {
    role: "document",
    name: "A11yMCP Phase 1",
    generatedAt: new Date().toISOString(),
    children: [
      {
        role: "main",
        children: [
          {
            role: "button",
            name: "Keyboard preview control",
            focusable: true,
            selector: "#preview-button",
            violations: focusEnabled
              ? []
              : [
                  {
                    id: "focus-visible",
                    severity: "high",
                    message: "Focus indicator is suppressed.",
                  },
                ],
          },
        ],
      },
    ],
  };
}

function getVerification() {
  const focusEnabled = getFocusEnabled();

  return {
    profile: "phase1-focus-management",
    task: "preview_focus_visibility",
    generatedAt: new Date().toISOString(),
    taskAccessibility: focusEnabled ? "PASS" : "BLOCKED",
    summary: focusEnabled ? "pass" : "fail",
    checks: [
      {
        id: "focus_visible",
        title: "Visible focus indicator",
        pass: focusEnabled,
        evidence: focusEnabled
          ? "Preview control has a visible focus ring."
          : "Focus indicator is suppressed.",
      },
    ],
  };
}

export function registerPhase1ToolsOnce(): void {
  if (phase1ToolsRegistered) {
    return;
  }

  phase1ToolsRegistered = true;

  registerA11yTool({
    name: "get_accessibility_capabilities",
    title: "Get accessibility capabilities",
    description:
      "Returns the structured accessibility capabilities exposed by this A11yMCP Phase 1 demo.",
    inputSchema: emptyInputJsonSchema,
    annotations: {
      readOnlyHint: true,
    },
    schema: EmptyInputSchema,
    run: async () => {
      logEvent(
        "TOOL_INVOKED",
        "get_accessibility_capabilities",
        "Capability discovery requested."
      );

      return getCapabilities();
    },
  });

  registerA11yTool({
    name: "get_accessibility_state",
    title: "Get accessibility state",
    description:
      "Returns the current Phase 1 accessibility state, including whether the focus repair is active.",
    inputSchema: emptyInputJsonSchema,
    annotations: {
      readOnlyHint: true,
    },
    schema: EmptyInputSchema,
    run: async () => {
      logEvent(
        "TOOL_INVOKED",
        "get_accessibility_state",
        "Accessibility state requested."
      );

      return getState();
    },
  });

  registerA11yTool({
    name: "inspect_accessibility_tree",
    title: "Inspect accessibility tree",
    description:
      "Returns a small normalized accessibility tree for the Phase 1 preview area.",
    inputSchema: emptyInputJsonSchema,
    annotations: {
      readOnlyHint: true,
    },
    schema: EmptyInputSchema,
    run: async () => {
      logEvent(
        "TOOL_INVOKED",
        "inspect_accessibility_tree",
        "Accessibility tree inspection requested."
      );

      return getTree();
    },
  });

  registerA11yTool({
    name: "repair_focus_management",
    title: "Repair focus management",
    description:
      "Applies a reversible Phase 1 remediation that enables a visible focus ring on the preview control.",
    inputSchema: repairFocusInputJsonSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    schema: RepairFocusInputSchema,
    run: async (input: RepairFocusInput) => {
      const cb = requireCallbacks();
      const before = cb.getFocusEnabled();

      logEvent(
        "TOOL_INVOKED",
        "repair_focus_management",
        `Requested focus repair for scope=${input.scope}.`
      );

      if (before) {
        return {
          success: true,
          alreadyApplied: true,
          reversible: true,
          target: "preview-control",
          before: {
            focusRingEnabled: true,
          },
          after: {
            focusRingEnabled: true,
          },
        };
      }

      cb.setFocusEnabled(true);

      lastRemediation = {
        id: "repair_focus_management",
        target: "preview-control",
        appliedAt: new Date().toISOString(),
      };

      logEvent(
        "REMEDIATION_APPLIED",
        "repair_focus_management",
        "Enabled visible focus ring for preview control."
      );

      return {
        success: true,
        alreadyApplied: false,
        reversible: true,
        remediationId: lastRemediation.id,
        target: "preview-control",
        before: {
          focusRingEnabled: false,
        },
        after: {
          focusRingEnabled: true,
        },
      };
    },
  });

  registerA11yTool({
    name: "rollback_focus_management",
    title: "Rollback focus management",
    description:
      "Reverts the Phase 1 focus remediation and returns the preview control to its original suppressed-focus state.",
    inputSchema: emptyInputJsonSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    schema: EmptyInputSchema,
    run: async () => {
      const cb = requireCallbacks();
      const before = cb.getFocusEnabled();

      logEvent(
        "TOOL_INVOKED",
        "rollback_focus_management",
        "Requested rollback of focus repair."
      );

      if (!before) {
        return {
          success: true,
          alreadyRolledBack: true,
          target: "preview-control",
          before: {
            focusRingEnabled: false,
          },
          after: {
            focusRingEnabled: false,
          },
        };
      }

      cb.setFocusEnabled(false);
      lastRemediation = null;

      logEvent(
        "ROLLBACK_APPLIED",
        "rollback_focus_management",
        "Rolled back visible focus ring."
      );

      return {
        success: true,
        alreadyRolledBack: false,
        target: "preview-control",
        before: {
          focusRingEnabled: true,
        },
        after: {
          focusRingEnabled: false,
        },
      };
    },
  });

  registerA11yTool({
    name: "verify_accessibility_profile",
    title: "Verify accessibility profile",
    description:
      "Verifies whether the Phase 1 focus management profile is currently satisfied.",
    inputSchema: emptyInputJsonSchema,
    annotations: {
      readOnlyHint: true,
    },
    schema: EmptyInputSchema,
    run: async () => {
      logEvent(
        "TOOL_INVOKED",
        "verify_accessibility_profile",
        "Verification requested."
      );

      const result = getVerification();

      logEvent(
        "VERIFICATION_COMPLETED",
        "verify_accessibility_profile",
        result.summary === "pass"
          ? "Verification passed."
          : "Verification failed."
      );

      return result;
    },
  });
}