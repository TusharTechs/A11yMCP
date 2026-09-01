// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyRemediation, rollbackAll } from "@/lib/accessibility/remediation";

/**
 * Remediation must not depend on a frame being painted.
 *
 * `applyRemediation` waits for a render before it re-audits, and browsers do
 * not fire `requestAnimationFrame` in a hidden or backgrounded tab. Without
 * a timer fallback every `repair_*` tool hangs forever — silently, with no
 * error and no timeout — the moment the page is not the foreground tab.
 *
 * That is not a hypothetical: an agent driving this page from a side panel,
 * an extension, or a tab the user has switched away from sees exactly that.
 * These tests pin the fallback by removing `requestAnimationFrame` entirely.
 */
function mount(): HTMLElement {
  Element.prototype.getClientRects = function () {
    return [{ width: 1, height: 1 } as DOMRect];
  } as unknown as typeof Element.prototype.getClientRects;

  const root = document.createElement("div");
  root.id = "noma-fixture";
  root.innerHTML = `
    <button><svg></svg></button>
    <div class="size-group">
      <div role="radio" aria-checked="false">9</div>
      <div role="radio" aria-checked="false">10</div>
    </div>
  `;
  document.body.innerHTML = "";
  document.body.appendChild(root);
  return root;
}

const originalRaf = globalThis.requestAnimationFrame;

describe("remediation in a tab that never paints", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = mount();
    // A hidden tab: rAF callbacks are queued and never invoked.
    globalThis.requestAnimationFrame = ((): number =>
      0) as unknown as typeof globalThis.requestAnimationFrame;
  });

  afterEach(async () => {
    globalThis.requestAnimationFrame = originalRaf;
    await rollbackAll(root);
  });

  it("applies a remediation without waiting for a frame that never comes", async () => {
    const result = await Promise.race([
      applyRemediation("keyboard_navigation", root),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("repair hung: rAF never fired")), 3_000)
      ),
    ]);

    expect((result as { success: boolean }).success).toBe(true);
  });

  it("rolls back without waiting for a frame that never comes", async () => {
    await applyRemediation("keyboard_navigation", root);

    const result = await Promise.race([
      rollbackAll(root),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("rollback hung: rAF never fired")),
          3_000
        )
      ),
    ]);

    expect((result as { success: boolean }).success).toBe(true);
  });

  it("still uses requestAnimationFrame when the tab is painting", async () => {
    const raf = vi.fn((callback: FrameRequestCallback) => {
      setTimeout(() => callback(performance.now()), 0);
      return 1;
    });
    globalThis.requestAnimationFrame =
      raf as unknown as typeof globalThis.requestAnimationFrame;

    await applyRemediation("keyboard_navigation", root);

    expect(raf).toHaveBeenCalled();
  });
});
