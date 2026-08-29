import type {
  AccessibilityNode,
  AccessibilityViolation,
} from "@/types/accessibility";

export interface NameInfo {
  name: string;
  source:
    | "aria-labelledby"
    | "aria-label"
    | "label"
    | "text"
    | "alt"
    | "title"
    | "placeholder"
    | "none";
  weak: boolean;
}

const NATIVE_ROLE_BY_TAG: Record<string, string> = {
  button: "button",
  a: "link",
  input: "textbox",
  select: "combobox",
  textarea: "textbox",
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  h5: "heading",
  h6: "heading",
  nav: "navigation",
  main: "main",
  header: "banner",
  footer: "contentinfo",
  form: "form",
  section: "region",
  ul: "list",
  li: "listitem",
  img: "img",
};

export function computeRole(el: Element): string {
  const explicit = el.getAttribute("role");
  if (explicit) return explicit;

  const tag = el.tagName.toLowerCase();

  if (tag === "input") {
    const type = (el as HTMLInputElement).type;
    if (type === "checkbox") return "checkbox";
    if (type === "radio") return "radio";
    if (type === "button" || type === "submit") return "button";
    return "textbox";
  }

  if (tag === "a") return el.hasAttribute("href") ? "link" : "generic";

  return NATIVE_ROLE_BY_TAG[tag] ?? "generic";
}

export function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.getClientRects().length === 0) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
}

export function isNativelyFocusable(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "button" || tag === "select" || tag === "textarea") return true;
  if (tag === "a") return el.hasAttribute("href");
  if (tag === "input") return (el as HTMLInputElement).type !== "hidden";
  return false;
}

export function isFocusable(el: Element): boolean {
  if (!isVisible(el)) return false;
  if (el.hasAttribute("disabled")) return false;
  if (isNativelyFocusable(el)) return true;
  const tabindex = el.getAttribute("tabindex");
  return tabindex !== null && Number.parseInt(tabindex, 10) >= 0;
}

export function getSelector(el: Element): string {
  if (el.id) return `#${el.id}`;

  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.documentElement) {
    const node: Element = current;

    if (node.id) {
      parts.unshift(`#${node.id}`);
      break;
    }

    let part: string = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;

    if (parent) {
      const sameTag: Element[] = Array.from(parent.children).filter(
        (child: Element) => child.tagName === node.tagName
      );
      if (sameTag.length > 1) {
        part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
      }
    }

    parts.unshift(part);
    current = parent;
  }

  return parts.join(" > ") || el.tagName.toLowerCase();
}

export function computeName(el: Element): NameInfo {
  const labelledby = el.getAttribute("aria-labelledby");
  if (labelledby) {
    const text = labelledby
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
      .filter(Boolean)
      .join(" ");
    if (text) return { name: text, source: "aria-labelledby", weak: false };
  }

  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel?.trim()) {
    return { name: ariaLabel.trim(), source: "aria-label", weak: false };
  }

  const tag = el.tagName.toLowerCase();
  const isFormControl =
    tag === "input" || tag === "select" || tag === "textarea";

  if (isFormControl && el.id) {
    const label: Element | null = document.querySelector(
      `label[for="${el.id}"]`
    );
    if (label?.textContent?.trim()) {
      return { name: label.textContent.trim(), source: "label", weak: false };
    }
  }

  if (isFormControl) {
    const wrapping = el.closest("label");
    if (wrapping?.textContent?.trim()) {
      return {
        name: wrapping.textContent.trim(),
        source: "label",
        weak: false,
      };
    }
  }

  if (tag === "img") {
    const alt = el.getAttribute("alt");
    if (alt?.trim()) return { name: alt.trim(), source: "alt", weak: false };
  }

  if (tag === "button" || tag === "a" || el.hasAttribute("role")) {
    const text = el.textContent?.trim() ?? "";
    if (text) return { name: text, source: "text", weak: false };
  }

  const title = el.getAttribute("title");
  if (title?.trim()) {
    return { name: title.trim(), source: "title", weak: false };
  }

  const placeholder = el.getAttribute("placeholder");
  if (placeholder?.trim()) {
    return { name: placeholder.trim(), source: "placeholder", weak: true };
  }

  return { name: "", source: "none", weak: false };
}

export function buildAccessibilityTree(
  root: Element,
  violations: AccessibilityViolation[]
): AccessibilityNode {
  const bySelector = new Map<string, AccessibilityViolation[]>();
  for (const violation of violations) {
    const list: AccessibilityViolation[] =
      bySelector.get(violation.selector) ?? [];
    list.push(violation);
    bySelector.set(violation.selector, list);
  }

  function walk(el: Element): AccessibilityNode | null {
    const role = computeRole(el);
    const children: AccessibilityNode[] = [];

    for (const child of Array.from(el.children)) {
      const childNode = walk(child);
      if (childNode) children.push(childNode);
    }

    const meaningful =
      role !== "generic" ||
      el.hasAttribute("role") ||
      isFocusable(el) ||
      children.length > 0;

    if (!meaningful) return null;

    const nameInfo = computeName(el);
    const selector = getSelector(el);
    const node: AccessibilityNode = { role, selector };

    if (nameInfo.name) {
      node.name = nameInfo.name;
      node.nameSource = nameInfo.source;
    }

    node.focusable = isFocusable(el);

    const nodeViolations = bySelector.get(selector);
    if (nodeViolations?.length) node.violations = nodeViolations;
    if (children.length) node.children = children;

    return node;
  }

  return walk(root) ?? { role: "generic", selector: getSelector(root) };
}