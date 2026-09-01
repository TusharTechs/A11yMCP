// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { negotiateProfile } from "@/lib/accessibility/negotiation";
import { buildVerification } from "@/lib/accessibility/verification";

/**
 * A page with an unnamed control (fails accessible_names) and a
 * non-focusable custom radio (fails keyboard_navigation).
 */
function mount(): HTMLElement {
  Element.prototype.getClientRects = function () {
    return [{ width: 1, height: 1 } as DOMRect];
  } as unknown as typeof Element.prototype.getClientRects;

  const root = document.createElement("div");
  root.id = "noma-fixture";
  root.innerHTML = `
    <button><svg></svg></button>
    <div role="radio" aria-checked="false">9</div>
  `;
  document.body.innerHTML = "";
  document.body.appendChild(root);
  return root;
}

describe("verification is scoped to the negotiated profile", () => {
  beforeEach(() => {
    mount();
  });

  it("does not BLOCK on issues outside the negotiated profile", () => {
    // Keyboard-only user: keyboard + focus negotiated on site-a. The
    // unnamed button is a names issue — out of scope — so it must not
    // gate, but it must still be reported as an advisory.
    negotiateProfile(["keyboard_only", "strong_focus"]);
    const result = buildVerification(document.querySelector("#noma-fixture")!);

    const namesCheck = result.checks.find((c) => c.id === "accessible_names");
    expect(namesCheck?.inScope).toBe(false);
    expect((result.advisories ?? []).length).toBeGreaterThan(0);
  });

  it("BLOCKS when an in-scope audit has a blocking violation", () => {
    negotiateProfile(["keyboard_only", "strong_focus"]);
    const result = buildVerification(document.querySelector("#noma-fixture")!);

    const keyboardCheck = result.checks.find(
      (c) => c.id === "keyboard_navigation"
    );
    expect(keyboardCheck?.inScope).toBe(true);
    // the custom radio is not focusable -> blocking -> BLOCKED
    expect(result.taskAccessibility).toBe("BLOCKED");
  });

  it("full-scope check (no profile) considers every category", () => {
    const result = buildVerification(
      document.querySelector("#noma-fixture")!,
      { profile: null }
    );
    expect(result.checks.every((c) => c.inScope)).toBe(true);
  });
});
