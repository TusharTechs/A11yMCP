import type { AccessibilityViolation, AuditResult } from "@/types/accessibility";
import {
  computeName,
  computeRole,
  getSelector,
  isFocusable,
  isVisible,
} from "./tree";

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
      violations.push({
        id: `interactive-not-focusable:${selector}`,
        rule: "interactive-not-focusable",
        severity: "high",
        selector,
        message: `Element with role "${role}" is not keyboard focusable.`,
      });
    }

    const tabindex = el.getAttribute("tabindex");
    if (tabindex !== null && Number.parseInt(tabindex, 10) > 0) {
      violations.push({
        id: `positive-tabindex:${selector}`,
        rule: "positive-tabindex",
        severity: "medium",
        selector,
        message: "Positive tabindex creates a confusing tab order.",
      });
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
      const selector = getSelector(el);
      violations.push({
        id: `missing-accessible-name:${selector}`,
        rule: "missing-accessible-name",
        severity: "high",
        selector,
        message: `Control with role "${computeRole(el)}" has no accessible name.`,
      });
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
      violations.push({
        id: `input-missing-label:${selector}`,
        rule: "input-missing-label",
        severity: "high",
        selector,
        message: "Form field has no associated label.",
      });

      if (placeholder) {
        violations.push({
          id: `placeholder-as-label:${selector}`,
          rule: "placeholder-as-label",
          severity: "medium",
          selector,
          message: "Placeholder is being used as the only visible label.",
        });
      }
    }

    if (el.id) {
      const errorEl = root.querySelector(`#${el.id}-error`);
      const describedby = el.getAttribute("aria-describedby") ?? "";

      if (
        errorEl &&
        !describedby.split(/\s+/).includes(`${el.id}-error`)
      ) {
        violations.push({
          id: `error-not-associated:${selector}`,
          rule: "error-not-associated",
          severity: "medium",
          selector,
          message: "Error message exists but is not associated with the field.",
        });
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

export function auditFocusVisibility(root: Element): AuditResult {
  const violations: AccessibilityViolation[] = [];
  const focusables = Array.from(root.querySelectorAll("*")).filter(isFocusable);
  const active = document.activeElement;

  for (const el of focusables) {
    (el as HTMLElement).focus({ preventScroll: true });
    const style = window.getComputedStyle(el);
    const outlineVisible =
      style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
    const shadowVisible = style.boxShadow !== "none";

    if (!outlineVisible && !shadowVisible) {
      const selector = getSelector(el);
      violations.push({
        id: `focus-not-visible:${selector}`,
        rule: "focus-not-visible",
        severity: "high",
        selector,
        message: "Focus indicator is not visible on this control.",
      });
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