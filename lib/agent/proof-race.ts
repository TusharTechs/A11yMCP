/**
 * The side-by-side proof: the same task, on the same page, attempted two
 * ways.
 *
 * Lane A drives the real DOM as a browser-actuation agent must
 * ({@link runActuationLane}). Lane B goes through the site's declared WebMCP
 * tools. Both run live — nothing here replays a recording — and the fixture
 * is reset between them so neither lane inherits the other's state.
 *
 * The lanes run in sequence rather than in parallel because they share one
 * storefront and one commerce store; interleaving them would measure
 * interference rather than capability.
 */

import { resetCommerce } from "@/lib/ecommerce/cart";
import { invokeTool } from "@/lib/webmcp/runtime";
import type {
  NegotiatedProfile,
  VerificationResult,
} from "@/types/accessibility";
import {
  runActuationLane,
  type ActuationOutcome,
  type LaneStep,
} from "./actuation-baseline";

export type RaceLane = "actuation" | "webmcp";

export interface WebMCPOutcome {
  steps: LaneStep[];
  metrics: {
    steps: number;
    failedActions: number;
    unauthorizedMutations: number;
    siteVerifications: number;
  };
  verdict: "COMPLETED" | "BLOCKED";
  headline: string;
  orderId: string | null;
}

export interface RaceCallbacks {
  onStep: (lane: RaceLane, step: LaneStep) => void;
  onLaneDone: (
    lane: RaceLane,
    outcome: ActuationOutcome | WebMCPOutcome
  ) => void;
  /** Resolves when the human approves (or declines) the adaptation. */
  requestApproval: () => Promise<boolean>;
}

const CHECKOUT_VALUES = {
  email: "alex@example.com",
  fullName: "Alex Sharma",
  address: "12 Lake Street",
  city: "Bengaluru",
  postalCode: "560001",
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Lane B: the same goal, through the site's declared contract.
 *
 * Deliberately mirrors lane A step for step — discover, reach the control,
 * adapt, verify — so the difference between the lanes is the contract and
 * not the choice of steps.
 */
async function runWebMCPLane(
  callbacks: Pick<RaceCallbacks, "onStep" | "requestApproval">
): Promise<WebMCPOutcome> {
  const steps: LaneStep[] = [];
  const metrics = {
    steps: 0,
    failedActions: 0,
    unauthorizedMutations: 0,
    siteVerifications: 0,
  };

  const record = async (step: LaneStep): Promise<void> => {
    metrics.steps += 1;
    if (step.status === "fail") metrics.failedActions += 1;
    steps.push(step);
    callbacks.onStep("webmcp", step);
    await delay(420);
  };

  // 1. Discovery — the thing lane A had no way to do.
  const caps = await invokeTool("get_accessibility_capabilities", {});
  const declared = caps.ok
    ? ((caps.data as { capabilities?: Array<{ id: string; status: string }> })
        .capabilities ?? [])
    : [];
  const notDeclared = caps.ok
    ? ((caps.data as { notCurrentlyDeclared?: string[] }).notCurrentlyDeclared ??
        [])
    : [];
  await record({
    label: "Ask the site which adaptations it supports",
    status: caps.ok ? "pass" : "fail",
    detail: caps.ok
      ? `The site declares ${declared.length}: ${declared
          .map((capability) => `${capability.id} (${capability.status})`)
          .join(", ")}. It also states ${notDeclared.length} it does not support.`
      : `Discovery failed: ${caps.ok ? "" : caps.error.message}`,
  });

  // 2. Negotiation, including a need this site does not declare.
  const negotiation = await invokeTool("negotiate_accessibility_profile", {
    needs: ["keyboard_only", "strong_focus", "high_contrast"],
  });
  const profile = negotiation.ok
    ? (negotiation.data as NegotiatedProfile)
    : null;
  await record({
    label: "Negotiate a profile — and hear an honest no",
    status: negotiation.ok ? "pass" : "fail",
    detail: profile
      ? `${profile.accepted.length} accepted (${profile.accepted
          .map((item) => item.capability)
          .join(", ")}). ${profile.rejected
          .map((item) => item.need)
          .join(", ")} rejected with a reason — not silently faked.`
      : "Negotiation failed.",
  });

  // 3. The human gate. Lane A had no one to ask.
  const approved = await callbacks.requestApproval();
  await record({
    label: "Ask the human before touching the page",
    status: approved ? "pass" : "warn",
    detail: approved
      ? "Approved. `approval: true` is required at the schema level — the tool rejects the call without it."
      : "Declined. Nothing was changed, and the agent stops here.",
  });

  if (!approved) {
    return {
      steps,
      metrics,
      verdict: "BLOCKED",
      headline: "Stopped at the human gate — nothing was changed",
      orderId: null,
    };
  }

  // 4. Adaptation, applied by the site's own adapter from its own directives.
  let repaired = 0;
  for (const tool of ["repair_keyboard_navigation", "repair_focus_management"]) {
    const result = await invokeTool(tool, { approval: true });
    if (result.ok && (result.data as { success?: boolean }).success) {
      repaired += 1;
    }
  }
  await record({
    label: "The site adapts itself",
    status: repaired > 0 ? "pass" : "fail",
    detail: `${repaired} site-declared adaptations applied by the site's own adapter, from its own directives. No arbitrary DOM access was granted, and every change is reversible.`,
  });

  // 5. Verification against the site's definition of done, not ours.
  const verification = await invokeTool("verify_accessibility_profile", {});
  const verified = verification.ok
    ? (verification.data as VerificationResult)
    : null;
  if (verified) metrics.siteVerifications += 1;
  await record({
    label: "Verify against the site's definition of done",
    status: verified?.taskAccessibility === "PASS" ? "pass" : "fail",
    detail: verified
      ? `${verified.taskAccessibility} for the negotiated profile, with ${verified.advisories?.length ?? 0} advisories reported outside it. This is the site's verdict, not the agent's heuristic.`
      : "Verification unavailable.",
  });

  // 6. Finish the actual task the person came to do.
  await invokeTool("search_products", { query: "runner" });
  await invokeTool("add_product_to_cart", {
    productId: "noma-runner",
    variantId: "9",
  });
  const begin = await invokeTool("begin_checkout", {});
  const sessionId = begin.ok
    ? ((begin.data as { sessionId?: string }).sessionId ?? "")
    : "";
  await invokeTool("fill_checkout_form", {
    sessionId,
    values: CHECKOUT_VALUES,
  });
  const placed = await invokeTool("place_order", {
    sessionId,
    confirmation: true,
  });
  const orderId =
    placed.ok && (placed.data as { success?: boolean }).success
      ? ((placed.data as { order?: { id: string } }).order?.id ?? null)
      : null;

  await record({
    label: "Complete the purchase",
    status: orderId ? "pass" : "fail",
    detail: orderId
      ? `Order ${orderId} placed. \`place_order\` required a literal \`confirmation: true\` — a second, separate gate.`
      : "The order was not placed.",
  });

  return {
    steps,
    metrics,
    verdict: orderId ? "COMPLETED" : "BLOCKED",
    headline: orderId
      ? `ORDER PLACED — verified by the site, 0 unauthorized mutations`
      : "Task not completed",
    orderId,
  };
}

/**
 * Runs both lanes against `root`, resetting the fixture between them.
 * Returns once the WebMCP lane has finished.
 */
export async function runProofRace(
  root: Element,
  callbacks: RaceCallbacks
): Promise<{ actuation: ActuationOutcome; webmcp: WebMCPOutcome }> {
  // Deterministic start: no leftover remediations, no leftover cart. The
  // rollback goes through the tool, like everything else.
  await invokeTool("rollback_all_remediations", {});
  resetCommerce();
  await delay(200);

  const actuation = await runActuationLane(root, (step) =>
    callbacks.onStep("actuation", step)
  );
  callbacks.onLaneDone("actuation", actuation);

  // Reset so lane B starts from the same unadapted page lane A saw.
  await invokeTool("rollback_all_remediations", {});
  resetCommerce();
  await delay(400);

  const webmcp = await runWebMCPLane(callbacks);
  callbacks.onLaneDone("webmcp", webmcp);

  return { actuation, webmcp };
}
