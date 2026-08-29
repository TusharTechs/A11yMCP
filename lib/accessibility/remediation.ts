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
} from "./audits";
import { SITE_MANIFEST } from "./manifest";

let snapshot: RemediationSnapshot = {
  applied: {
    accessible_names: false,
    keyboard_navigation: false,
    form_association: false,
    focus_management: false,
  },
};

const listeners = new Set<() => void>();
let remediationCounter = 0;

export function subscribeRemediation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRemediationSnapshot(): RemediationSnapshot {
  return snapshot;
}

export function isApplied(category: RemediationCategory): boolean {
  return snapshot.applied[category];
}

function setApplied(category: RemediationCategory, value: boolean): void {
  snapshot = { applied: { ...snapshot.applied, [category]: value } };
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
  const before = auditForCategory(category, root).violations.length;

  if (snapshot.applied[category]) {
    return {
      success: true,
      remediationId: `rem-${category}-existing`,
      category,
      alreadyApplied: true,
      changes: SITE_MANIFEST.directives[category],
      beforeViolations: before,
      afterViolations: before,
      reversible: true,
    };
  }

  setApplied(category, true);
  await afterRender();

  remediationCounter += 1;
  const after = auditForCategory(category, root).violations.length;

  return {
    success: true,
    remediationId: `rem-${category}-${remediationCounter}`,
    category,
    changes: SITE_MANIFEST.directives[category],
    beforeViolations: before,
    afterViolations: after,
    reversible: true,
  };
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