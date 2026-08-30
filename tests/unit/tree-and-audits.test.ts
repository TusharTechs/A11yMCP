// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  auditAccessibleNames,
  auditFormAssociations,
  auditKeyboardNavigation,
} from "@/lib/accessibility/audits";
import { computeName, isFocusable } from "@/lib/accessibility/tree";

function mount(html: string): HTMLElement {
  const root = document.createElement("div");
  root.id = "test-root";
  root.innerHTML = html;
  document.body.innerHTML = "";
  document.body.appendChild(root);
  return root;
}

describe("accessible name computation", () => {
  beforeEach(() => {
    // jsdom does not implement getClientRects; mock it so isVisible() returns true
    Element.prototype.getClientRects = function () {
      return [{ width: 1, height: 1 } as DOMRect];
    } as unknown as typeof Element.prototype.getClientRects;
  });

  it("prefers aria-label", () => {
    const root = mount('<button aria-label="Add to wishlist"></button>');
    const info = computeName(root.querySelector("button")!);
    expect(info.name).toBe("Add to wishlist");
    expect(info.source).toBe("aria-label");
  });

  it("reports missing name for empty icon button", () => {
    const root = mount("<button><svg></svg></button>");
    expect(computeName(root.querySelector("button")!).name).toBe("");
  });

  it("uses associated label for inputs", () => {
    const root = mount(
      '<label for="email">Email</label><input id="email" />'
    );
    const info = computeName(root.querySelector("input")!);
    expect(info.name).toBe("Email");
    expect(info.source).toBe("label");
  });

  it("treats placeholder-only as weak", () => {
    const root = mount('<input id="x" placeholder="Email" />');
    const info = computeName(root.querySelector("input")!);
    expect(info.weak).toBe(true);
  });
});

describe("keyboard audit", () => {
  beforeEach(() => {
    Element.prototype.getClientRects = function () {
      return [{ width: 1, height: 1 } as DOMRect];
    } as unknown as typeof Element.prototype.getClientRects;
  });

  it("flags interactive roles that are not focusable", () => {
    const root = mount('<div role="radio" aria-checked="false">9</div>');
    const result = auditKeyboardNavigation(root);
    expect(result.pass).toBe(false);
    expect(result.violations[0].rule).toBe("interactive-not-focusable");
  });

  it("passes focusable radios", () => {
    const root = mount(
      '<div role="radio" tabindex="0" aria-checked="false">9</div>'
    );
    expect(auditKeyboardNavigation(root).pass).toBe(true);
  });
});

describe("form audit", () => {
  beforeEach(() => {
    Element.prototype.getClientRects = function () {
      return [{ width: 1, height: 1 } as DOMRect];
    } as unknown as typeof Element.prototype.getClientRects;
  });

  it("flags placeholder-only fields and unassociated errors", () => {
    const root = mount(
      '<input id="email" placeholder="Email" /><p id="email-error">Bad</p>'
    );
    const result = auditFormAssociations(root);
    const rules = result.violations.map((v) => v.rule);
    expect(rules).toContain("input-missing-label");
    expect(rules).toContain("placeholder-as-label");
    expect(rules).toContain("error-not-associated");
  });

  it("passes labeled, associated fields", () => {
    const root = mount(
      '<label for="email">Email</label><input id="email" aria-describedby="email-error" /><p id="email-error">Bad</p>'
    );
    expect(auditFormAssociations(root).pass).toBe(true);
  });
});

describe("names audit", () => {
  beforeEach(() => {
    Element.prototype.getClientRects = function () {
      return [{ width: 1, height: 1 } as DOMRect];
    } as unknown as typeof Element.prototype.getClientRects;
  });

  it("flags unnamed controls", () => {
    const root = mount("<button><span></span></button>");
    expect(auditAccessibleNames(root).pass).toBe(false);
  });
});

describe("focusability", () => {
  beforeEach(() => {
    Element.prototype.getClientRects = function () {
      return [{ width: 1, height: 1 } as DOMRect];
    } as unknown as typeof Element.prototype.getClientRects;
  });

  it("respects tabindex", () => {
    const root = mount('<div tabindex="0">x</div><div>y</div>');
    expect(isFocusable(root.children[0])).toBe(true);
    expect(isFocusable(root.children[1])).toBe(false);
  });
});