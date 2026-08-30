import type {
  AccessibilityViolation,
  AuditResult,
  Severity,
  TaskImpact,
} from "@/types/accessibility";
import {
  computeName,
  computeRole,
  getSelector,
  isFocusable,
  isVisible,
} from "./tree";

const SEVERITY_BY_RULE: Record<string, Severity> = {
  "interactive-not-focusable": "high",
  "focus-not-visible": "high",
  "input-missing-label": "high",
  "error-not-associated": "medium",
  "placeholder-as-label": "medium",
  "missing-accessible-name": "medium",
  "positive-tabindex": "medium",
  "motion-not-reduced": "low",
  aborted: "low",
};

/**
 * Task-scoped prioritization for the keyboard-checkout task.
 * Classifications are defensible: focusability and form association block
 * the task; naming and tab-order issues degrade it; motion is informational
 * for this task.
 */
const IMPACT_BY_RULE: Record<string, TaskImpact> = {
  "interactive-not-focusable": "blocking",
  "focus-not-visible": "blocking",
  "input-missing-label": "blocking",
  "error-not-associated": "blocking",
  "placeholder-as-label": "degrading",
  "missing-accessible-name": "degrading",
  "positive-tabindex": "degrading",
  "motion-not-reduced": "informational",
  aborted: "informational",
};

function violation(
  rule: string,
  selector: string,
  message: string
): AccessibilityViolation {
  return {
    id: `${rule}:${selector}`,
    rule,
    severity: SEVERITY_BY_RULE[rule] ?? "medium",
    taskImpact: IMPACT_BY_RULE[rule] ?? "informational",
    selector,
    message,
  };
}

const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "radio",
  "checkbox",
  "switch",
  "tab",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "combobox",
  "textbox",
  "slider",
  "spinbutton",
]);

function isNativelyInteractive(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "button" || tag === "select" || tag === "textarea") return true;
  if (tag === "a") return el.hasAttribute("href");
  if (tag === "input") return (el as HTMLInputElement).type !== "hidden";
  return false;
}

function interactiveElements(root: Element): Element[] {
  return Array.from(root.querySelectorAll("*")).filter((el) => {
    const role = computeRole(el);
    return INTERACTIVE_ROLES.has(role) || isNativelyInteractive(el);
  });
}

export function auditKeyboardNavigation(root: Element): AuditResult {
  const violations: AccessibilityViolation[] = [];

  for (const el of interactiveElements(root)) {
    if (!isVisible(el)) continue;
    const selector = getSelector(el);
    const role = computeRole(el);

    if (!isFocusable(el)) {
      violations.push(
        violation(
          "interactive-not-focusable",
          selector,
          `Element with role "${role}" is not keyboard focusable.`
        )
      );
    }

    const tabindex = el.getAttribute("tabindex");
    if (tabindex !== null && Number.parseInt(tabindex, 10) > 0) {
      violations.push(
        violation(
          "positive-tabindex",
          selector,
          "Positive tabindex creates a confusing tab order."
        )
      );
    }
  }

  return {
    id: "keyboard_navigation",
    title: "Keyboard navigation",
    pass: violations.length === 0,
    violations,
  };
}

export function auditAccessibleNames(root: Element): AuditResult {
  const violations: AccessibilityViolation[] = [];

  for (const el of interactiveElements(root)) {
    if (!isVisible(el)) continue;
    const info = computeName(el);

    if (!info.name) {
      violations.push(
        violation(
          "missing-accessible-name",
          getSelector(el),
          `Control with role "${computeRole(el)}" has no accessible name.`
        )
      );
    }
  }

  return {
    id: "accessible_names",
    title: "Accessible names",
    pass: violations.length === 0,
    violations,
  };
}

export function auditFormAssociations(root: Element): AuditResult {
  const violations: AccessibilityViolation[] = [];

  const fields = Array.from(
    root.querySelectorAll("input, select, textarea")
  ).filter((el) => {
    const type = (el as HTMLInputElement).type;
    return type !== "button" && type !== "submit" && type !== "hidden";
  });

  for (const el of fields) {
    const selector = getSelector(el);

    const hasLabel =
      Boolean(el.id && document.querySelector(`label[for="${el.id}"]`)) ||
      el.closest("label") !== null ||
      el.hasAttribute("aria-labelledby") ||
      el.hasAttribute("aria-label");

    const placeholder = el.getAttribute("placeholder");

    if (!hasLabel) {
      violations.push(
        violation(
          "input-missing-label",
          selector,
          "Form field has no associated label."
        )
      );

      if (placeholder) {
        violations.push(
          violation(
            "placeholder-as-label",
            selector,
            "Placeholder is being used as the only visible label."
          )
        );
      }
    }

    if (el.id) {
      const errorEl = root.querySelector(`#${el.id}-error`);
      const describedby = el.getAttribute("aria-describedby") ?? "";

      if (errorEl && !describedby.split(/\s+/).includes(`${el.id}-error`)) {
        violations.push(
          violation(
            "error-not-associated",
            selector,
            "Error message exists but is not associated with the field."
          )
        );
      }
    }
  }

  return {
    id: "form_association",
    title: "Form associations",
    pass: violations.length === 0,
    violations,
  };
}

export function auditFocusVisibility(
  root: Element,
  signal?: AbortSignal
): AuditResult {
  const violations: AccessibilityViolation[] = [];
  const focusables = Array.from(root.querySelectorAll("*")).filter(isFocusable);
  const active = document.activeElement;

  for (const el of focusables) {
    if (signal?.aborted) {
      violations.push(
        violation(
          "aborted",
          getSelector(el),
          "Audit aborted by AbortSignal."
        )
      );
      return {
        id: "focus_visibility",
        title: "Focus visibility",
        pass: false,
        violations,
      };
    }

    (el as HTMLElement).focus({ preventScroll: true });
    const style = window.getComputedStyle(el);
    const outlineVisible =
      style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
    const shadowVisible = style.boxShadow !== "none";

    if (!outlineVisible && !shadowVisible) {
      violations.push(
        violation(
          "focus-not-visible",
          getSelector(el),
          "Focus indicator is not visible on this control."
        )
      );
    }
  }

  if (active instanceof HTMLElement) {
    active.focus({ preventScroll: true });
  }

  return {
    id: "focus_visibility",
    title: "Focus visibility",
    pass: violations.length === 0,
    violations,
  };
}

export function auditReducedMotion(root: Element): AuditResult {
  const reduced = root.getAttribute("data-motion") === "reduced";
  return {
    id: "reduced_motion",
    title: "Reduced motion",
    pass: reduced,
    violations: reduced
      ? []
      : [
          violation(
            "motion-not-reduced",
            getSelector(root),
            "Motion reduction is not applied."
          ),
        ],
  };
}