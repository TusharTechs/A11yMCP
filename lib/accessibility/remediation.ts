import type {
  AuditResult,
  RemediationCategory,
  RemediationResult,
  RemediationSnapshot,
} from "@/types/accessibility";
import {
  auditAccessibleNames,
  auditFocusVisibility,
  auditFormAssociations,
  auditKeyboardNavigation,
  auditReducedMotion,
} from "./audits";
import { getCurrentManifest } from "./manifest";
import { buildVerification } from "./verification";

interface ExtendedSnapshot extends RemediationSnapshot {
  history: RemediationResult[];
}

let snapshot: ExtendedSnapshot = {
  applied: {
    accessible_names: false,
    keyboard_navigation: false,
    form_association: false,
    focus_management: false,
    reduced_motion: false,
  },
  history: [],
};

/**
 * Cached public snapshot. useSyncExternalStore compares snapshots with
 * Object.is, so getRemediationSnapshot() must return the SAME object
 * between state changes. Never return a fresh object per call.
 */
let publicSnapshot: RemediationSnapshot = { applied: snapshot.applied };

const listeners = new Set<() => void>();
let remediationCounter = 0;

export function subscribeRemediation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRemediationSnapshot(): RemediationSnapshot {
  return publicSnapshot;
}

export function getRemediationHistory(): RemediationResult[] {
  return snapshot.history;
}

export function isApplied(category: RemediationCategory): boolean {
  return snapshot.applied[category];
}

function setApplied(category: RemediationCategory, value: boolean): void {
  snapshot = {
    ...snapshot,
    applied: { ...snapshot.applied, [category]: value },
  };
  publicSnapshot = { applied: snapshot.applied };
  listeners.forEach((listener) => listener());
}

function pushHistory(result: RemediationResult): void {
  snapshot = { ...snapshot, history: [...snapshot.history, result].slice(-50) };
  listeners.forEach((listener) => listener());
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function afterRender(): Promise<void> {
  await nextFrame();
  await nextFrame();
}

export function auditForCategory(
  category: RemediationCategory,
  root: Element
): AuditResult {
  switch (category) {
    case "accessible_names":
      return auditAccessibleNames(root);
    case "keyboard_navigation":
      return auditKeyboardNavigation(root);
    case "form_association":
      return auditFormAssociations(root);
    case "focus_management":
      return auditFocusVisibility(root);
    case "reduced_motion":
      return auditReducedMotion(root);
  }
}

export function totalViolations(root: Element): number {
  return [
    auditKeyboardNavigation(root),
    auditAccessibleNames(root),
    auditFormAssociations(root),
    auditFocusVisibility(root),
  ].reduce((sum, result) => sum + result.violations.length, 0);
}

export async function applyRemediation(
  category: RemediationCategory,
  root: Element
): Promise<RemediationResult> {
  const manifest = getCurrentManifest();
  const capability = manifest.capabilities.find((c) => c.id === category);
  const before = auditForCategory(category, root).violations.length;

  if (!capability) {
    return {
      success: false,
      remediationId: `rem-${category}-unsupported`,
      category,
      changes: [],
      beforeViolations: before,
      afterViolations: before,
      reversible: false,
      evidenceChain: [
        {
          stage: "why",
          detail: `Site "${manifest.site}" does not declare capability "${category}". Remediation refused.`,
        },
      ],
    };
  }

  if (snapshot.applied[category]) {
    return {
      success: true,
      remediationId: `rem-${category}-existing`,
      category,
      alreadyApplied: true,
      changes: manifest.directives[category],
      beforeViolations: before,
      afterViolations: before,
      reversible: true,
      evidenceChain: [
        { stage: "before", detail: `${before} violation(s).` },
        { stage: "action", detail: "Already applied; no-op." },
        { stage: "after", detail: `${before} violation(s).` },
      ],
    };
  }

  setApplied(category, true);
  await afterRender();

  remediationCounter += 1;
  const after = auditForCategory(category, root).violations.length;
  const verification = buildVerification(root);

  const result: RemediationResult = {
    success: true,
    remediationId: `rem-${category}-${remediationCounter}`,
    category,
    changes: manifest.directives[category],
    beforeViolations: before,
    afterViolations: after,
    reversible: true,
    evidenceChain: [
      { stage: "before", detail: `${before} violation(s) in ${category} audit.` },
      {
        stage: "why",
        detail: capability.limitation
          ? `Capability "${category}" accepted (${capability.status}): ${capability.limitation}`
          : `Capability "${category}" accepted for the negotiated profile.`,
      },
      {
        stage: "action",
        detail: `${capability.repairTool} applied ${manifest.directives[category].length} site-declared directive(s).`,
      },
      { stage: "after", detail: `${after} violation(s) in ${category} audit.` },
      {
        stage: "verification",
        detail: `Task accessibility: ${verification.taskAccessibility}.`,
      },
    ],
  };

  pushHistory(result);
  return result;
}

export async function rollbackAll(
  root: Element
): Promise<{
  success: boolean;
  rolledBack: RemediationCategory[];
  beforeViolations: number;
  afterViolations: number;
}> {
  const before = totalViolations(root);
  const rolledBack = (
    Object.keys(snapshot.applied) as RemediationCategory[]
  ).filter((category) => snapshot.applied[category]);

  if (rolledBack.length === 0) {
    return {
      success: true,
      rolledBack: [],
      beforeViolations: before,
      afterViolations: before,
    };
  }

  for (const category of rolledBack) {
    setApplied(category, false);
  }

  await afterRender();

  return {
    success: true,
    rolledBack,
    beforeViolations: before,
    afterViolations: totalViolations(root),
  };
}