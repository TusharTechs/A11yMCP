/**
 * A live browser-actuation baseline, run in the page against the real
 * storefront DOM.
 *
 * The benchmark in `tests/eval/benchmark.spec.ts` measures this over six
 * tasks and writes `public/eval-results.json`. This module exists so the
 * same comparison can be *watched*, on the same fixture, in the time it
 * takes to read a sentence — no JSON, no replay, no scripted failure.
 *
 * It models a competent DOM+a11y agent operating on behalf of a
 * keyboard-only user: it reads roles and names, walks the real tab order,
 * probes the computed focus style, and — having no contract to consult —
 * falls back to the only adaptation strategy it has, injecting attributes
 * the site never authorized. Every mutation it makes is undone before the
 * function returns, so the lane leaves the fixture exactly as it found it.
 */

export type LaneStepStatus = "pass" | "fail" | "warn" | "info";

export interface LaneStep {
  label: string;
  status: LaneStepStatus;
  detail: string;
}

export interface ActuationMetrics {
  steps: number;
  failedActions: number;
  unauthorizedMutations: number;
  siteVerifications: number;
}

export interface ActuationOutcome {
  steps: LaneStep[];
  metrics: ActuationMetrics;
  /** Reachable only by mutating the page without the site's consent. */
  verdict: "BLOCKED" | "UNAUTHORIZED_WORKAROUND";
  headline: string;
}

const INTERACTIVE_SELECTOR =
  "a[href],button,input,select,textarea,[role='radio'],[role='checkbox'],[role='button']";

const TABBABLE_SELECTOR = "a[href],button,input,select,textarea,[tabindex]";

function isVisible(element: HTMLElement): boolean {
  return element.offsetParent !== null || element.getClientRects().length > 0;
}

/**
 * The elements a keyboard user can actually reach with Tab. An element with
 * `role="radio"` and no tabindex is interactive to a mouse and invisible to
 * a keyboard — which is the entire barrier this lane runs into.
 */
function tabbables(root: Element): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR))
    .filter((element) => {
      if (element.hasAttribute("disabled")) return false;
      const tabindex = element.getAttribute("tabindex");
      if (tabindex !== null) return Number.parseInt(tabindex, 10) >= 0;
      return true;
    })
    .filter(isVisible);
}

function hasVisibleFocusIndicator(element: HTMLElement): boolean {
  const previous = document.activeElement as HTMLElement | null;
  element.focus();
  const style = window.getComputedStyle(element);
  const outlineVisible =
    style.outlineStyle !== "none" &&
    Number.parseFloat(style.outlineWidth || "0") > 0;
  const ringVisible = style.boxShadow !== "none" && style.boxShadow !== "";
  previous?.focus?.();
  return outlineVisible || ringVisible;
}

/**
 * Runs the keyboard-only actuation attempt against `root`.
 *
 * `onStep` is invoked as each step resolves so the UI can render the lane
 * progressively rather than all at once when it finishes.
 */
export async function runActuationLane(
  root: Element,
  onStep?: (step: LaneStep) => void,
  pace: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms))
): Promise<ActuationOutcome> {
  const steps: LaneStep[] = [];
  const metrics: ActuationMetrics = {
    steps: 0,
    failedActions: 0,
    unauthorizedMutations: 0,
    siteVerifications: 0,
  };

  const record = async (step: LaneStep): Promise<void> => {
    metrics.steps += 1;
    if (step.status === "fail") metrics.failedActions += 1;
    steps.push(step);
    onStep?.(step);
    await pace(420);
  };

  // 1. Read the rendered accessibility tree — what a good actuation agent does.
  const interactive = Array.from(
    root.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR)
  ).filter(isVisible);
  await record({
    label: "Read the rendered accessibility tree",
    status: "info",
    detail: `${interactive.length} interactive elements found by role and name. Meaning is inferred from the DOM — there is nothing to ask.`,
  });

  // 2. Ask the site what it can adapt. There is no such channel.
  await record({
    label: "Ask the site which adaptations it supports",
    status: "fail",
    detail:
      "No capability contract exists to query. The agent cannot discover what this site is willing to change, so anything it does next is a guess.",
  });

  // 3. Walk the real tab order looking for the size selector.
  const reachable = tabbables(root);
  const radios = Array.from(
    root.querySelectorAll<HTMLElement>('[role="radio"]')
  ).filter(isVisible);
  const reachableRadios = radios.filter((radio) => reachable.includes(radio));

  await record({
    label: "Tab to the size selector",
    status: reachableRadios.length > 0 ? "pass" : "fail",
    detail:
      reachableRadios.length > 0
        ? `${reachableRadios.length} of ${radios.length} size options are in the tab order.`
        : `${radios.length} size options exist, and none are in the tab order (${reachable.length} elements are reachable by Tab). A keyboard-only user cannot select a size — the task stops here.`,
  });

  // 4. Probe the focus indicator the way an agent without a contract must:
  //    focus something and read the computed style back.
  const probeTarget = reachable[0];
  const focusVisible = probeTarget
    ? hasVisibleFocusIndicator(probeTarget)
    : false;
  await record({
    label: "Probe for a visible focus indicator",
    status: focusVisible ? "pass" : "fail",
    detail: focusVisible
      ? "A focus style is computed on the first reachable control."
      : "No outline or ring is computed on focus. Even reachable controls give the user no indication of where they are.",
  });

  // 5. The only remaining strategy: mutate the page the site never
  //    authorized. Actually do it, so the claim is demonstrated rather than
  //    asserted — then undo it.
  const mutated: HTMLElement[] = [];
  if (reachableRadios.length === 0 && radios.length > 0) {
    radios.forEach((radio) => {
      radio.setAttribute("tabindex", "0");
      radio.setAttribute("data-a11ymcp-unauthorized", "true");
      mutated.push(radio);
    });
    metrics.unauthorizedMutations += mutated.length;

    const nowReachable = tabbables(root).filter((element) =>
      radios.includes(element)
    ).length;

    await record({
      label: "Inject tabindex the site never authorized",
      status: "warn",
      detail: `Worked: ${nowReachable} size options are now reachable. But the site was never asked, never consented, and has no idea this happened. An overlay does exactly this.`,
    });
  }

  // 6. Verify the fix — against what? There is no site-provided definition
  //    of done, only the agent's own heuristic marking its own homework.
  await record({
    label: "Verify the adaptation worked",
    status: "fail",
    detail:
      "The site offers no verification tool, so the agent can only re-run the heuristic it just used. It cannot know whether this site considers the result correct, safe, or complete.",
  });

  // Leave the fixture exactly as we found it.
  mutated.forEach((element) => {
    element.removeAttribute("tabindex");
    element.removeAttribute("data-a11ymcp-unauthorized");
  });

  const verdict: ActuationOutcome["verdict"] =
    metrics.unauthorizedMutations > 0 ? "UNAUTHORIZED_WORKAROUND" : "BLOCKED";

  return {
    steps,
    metrics,
    verdict,
    headline:
      verdict === "BLOCKED"
        ? "BLOCKED — the size selector is unreachable by keyboard"
        : `Reachable only after ${metrics.unauthorizedMutations} unauthorized mutations, with 0 site verification`,
  };
}
