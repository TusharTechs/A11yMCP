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

  it("does not report PASS when the site accepted none of the user's needs", () => {
    // Found by a third-party agent driving the live site: asking only for a
    // capability this site does not declare produced an empty scope, and an
    // empty scope has nothing in it to fail — so verification said PASS
    // immediately after the negotiation had said "I cannot help you".
    const profile = negotiateProfile(["high_contrast"]);
    expect(profile.accepted).toHaveLength(0);
    expect(profile.rejected.length).toBeGreaterThan(0);

    const result = buildVerification(document.querySelector("#noma-fixture")!);
    expect(result.taskAccessibility).toBe("BLOCKED");
  });

  it("still scopes normally when the site accepted at least one need", () => {
    // The empty-scope guard must not swallow the ordinary case: a profile
    // with something accepted is judged on that something, and unrelated
    // issues stay advisories.
    const profile = negotiateProfile(["screen_reader_labels"]);
    expect(profile.accepted.length).toBeGreaterThan(0);

    const result = buildVerification(document.querySelector("#noma-fixture")!);
    const names = result.checks.find((check) => check.id === "accessible_names");
    expect(names?.inScope).toBe(true);
    // and the guard has not simply forced everything to BLOCKED: the verdict
    // is still decided by whether the in-scope checks pass.
    expect(result.taskAccessibility).toBe(names?.pass ? "PASS" : "BLOCKED");
  });
});
