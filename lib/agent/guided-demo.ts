import { APPLY_ORDER } from "@/lib/accessibility/profiles";
import {
  getCommerceSnapshot,
  resetCommerce,
} from "@/lib/ecommerce/cart";
import {
  invokeTool,
  type ToolResult,
} from "@/lib/webmcp/runtime";
import type {
  AuditResult,
  NegotiatedProfile,
  VerificationResult,
} from "@/types/accessibility";
import type { AgentPhase, ScenarioId } from "@/types/agent";
import { agentPush, agentSet, getAgentSnapshot } from "./agent-store";
import { getScenario } from "./intent-parser";

const STEP_DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let decisionResolver: ((decision: "approved" | "denied") => void) | null =
  null;

export function resolveDecision(decision: "approved" | "denied"): void {
  const resolver = decisionResolver;
  decisionResolver = null;
  if (resolver) resolver(decision);
}

function waitForDecision(): Promise<"approved" | "denied"> {
  return new Promise((resolve) => {
    decisionResolver = resolve;
  });
}

function setPhase(phase: AgentPhase): void {
  agentSet({ phase });
  agentPush("status", `phase: ${phase}`);
}

function summarize(tool: string, data: unknown): string {
  switch (tool) {
    case "get_accessibility_capabilities": {
      const caps =
        (data as { capabilities?: Array<{ id: string; status: string }> })
          .capabilities ?? [];
      return `Capabilities: ${caps
        .map((cap) => `${cap.id} (${cap.status})`)
        .join(", ")}`;
    }
    case "audit_keyboard_navigation":
    case "audit_accessible_names":
    case "audit_form_associations":
    case "audit_focus_visibility": {
      const audit = data as AuditResult;
      return `${audit.title}: ${
        audit.pass ? "pass" : `${audit.violations.length} violation(s)`
      }`;
    }
    case "negotiate_accessibility_profile": {
      const profile = data as NegotiatedProfile;
      return `Negotiation: ${profile.accepted.length} accepted, ${profile.rejected.length} rejected.`;
    }
    case "verify_accessibility_profile": {
      const verification = data as VerificationResult;
      return `Verification: ${verification.taskAccessibility}.`;
    }
    case "search_products": {
      const search = data as { count?: number };
      return `${search.count ?? 0} product(s) found.`;
    }
    case "add_product_to_cart": {
      const added = data as { success?: boolean; cartItems?: number };
      return `Added to cart (${added.cartItems ?? 0} item(s)).`;
    }
    case "begin_checkout": {
      const begun = data as { success?: boolean; sessionId?: string };
      return `Checkout session ${begun.sessionId ?? "none"}.`;
    }
    case "fill_checkout_form": {
      const filled = data as { success?: boolean };
      return filled.success
        ? "Checkout form completed."
        : "Checkout form rejected.";
    }
    case "place_order": {
      const placed = data as { success?: boolean; order?: { id: string } };
      return placed.success
        ? `Order ${placed.order?.id ?? "unknown"} placed.`
        : "Order not placed.";
    }
    default:
      return JSON.stringify(data).slice(0, 140);
  }
}

async function callTool(name: string, input: unknown): Promise<ToolResult> {
  agentPush("tool", `${name} ${JSON.stringify(input)}`, name);
  const result = await invokeTool(name, input);

  if (result.ok) {
    agentPush("result", summarize(name, result.data), name);
  } else {
    agentPush("failure", `${name}: ${result.error.message}`, name);
  }

  await delay(STEP_DELAY_MS);
  return result;
}

export async function runGuidedAgent(scenarioId: ScenarioId): Promise<void> {
  if (getAgentSnapshot().running) return;

  agentSet({
    running: true,
    scenarioId,
    stream: [],
    lastOrderId: null,
    phase: "idle",
    awaiting: null,
  });

  const intent = getScenario(scenarioId);
  agentPush("user", intent.utterance);
  await delay(STEP_DELAY_MS);

  // Deterministic clean start.
  resetCommerce();
  await invokeTool("rollback_all_remediations", {});
  agentPush("status", "Reset to original site state for a deterministic run.");
  await delay(STEP_DELAY_MS);

  setPhase("discovering");
  agentPush(
    "agent",
    "I will check whether this website exposes accessibility capabilities."
  );
  const capsResult = await callTool("get_accessibility_capabilities", {});
  if (capsResult.ok) {
    const caps =
      (capsResult.data as { capabilities?: Array<{ id: string }> })
        .capabilities ?? [];
    agentPush(
      "agent",
      `This site declares: ${caps.map((cap) => cap.id).join(", ")}.`
    );
  }

  setPhase("auditing");
  agentPush("agent", "Auditing the task-critical controls for your profile.");
  let barrierCount = 0;
  for (const auditTool of [
    "audit_keyboard_navigation",
    "audit_accessible_names",
    "audit_form_associations",
    "audit_focus_visibility",
  ]) {
    const auditResult = await callTool(auditTool, {});
    if (auditResult.ok) {
      barrierCount += (auditResult.data as AuditResult).violations.length;
    }
  }
  agentPush(
    "agent",
    `I found ${barrierCount} barriers that could block this task.`
  );

  setPhase("negotiating");
  const negResult = await callTool("negotiate_accessibility_profile", {
    needs: intent.needs,
  });
  let profile: NegotiatedProfile | null = null;
  if (negResult.ok) {
    profile = negResult.data as NegotiatedProfile;
    if (profile.rejected.length > 0) {
      agentPush(
        "agent",
        `Note: ${profile.rejected
          .map((item) => item.need)
          .join(", ")} cannot be satisfied by this site. I will not fake them.`
      );
    }
    if (profile.accepted.length === 0) {
      agentPush(
        "agent",
        "The site cannot support this profile. I will attempt the task without remediation."
      );
    }
  }

  setPhase("awaiting_approval");
  agentSet({ awaiting: "remediation" });
  agentPush(
    "agent",
    "I can apply reversible fixes to this session. Shall I proceed?"
  );
  const remediationDecision = await waitForDecision();
  agentSet({ awaiting: null });

  if (remediationDecision === "denied") {
    agentPush("agent", "Understood. I will not change the site.");
    setPhase("cancelled");
    agentSet({ running: false });
    return;
  }

  setPhase("remediating");
  if (profile) {
    for (const category of APPLY_ORDER) {
      const item = profile.accepted.find((a) => a.capability === category);
      if (item) {
        await callTool(item.remediationTool, { approval: true });
      }
    }
  }

  setPhase("verifying");
  agentPush("agent", "All fixes applied. Verifying now.");
  await callTool("verify_accessibility_profile", {});

  setPhase("executing_task");
  agentPush("agent", "Continuing with your purchase.");

  const searchResult = await callTool("search_products", {
    query: intent.productQuery,
  });
  let productId = intent.productId;
  if (searchResult.ok) {
    const first = (
      searchResult.data as { products?: Array<{ id: string }> }
    ).products?.[0];
    if (first) productId = first.id;
  }

  await callTool("add_product_to_cart", {
    productId,
    variantId: intent.size,
  });

  // Deterministic failure + recovery: optimistic fill before session exists.
  const optimistic = await callTool("fill_checkout_form", {
    sessionId: "checkout-1",
    values: intent.checkoutValues,
  });
  const optimisticOk =
    optimistic.ok &&
    (optimistic.data as { success?: boolean }).success === true;

  if (!optimisticOk) {
    setPhase("recovery");
    agentPush(
      "agent",
      "Checkout session not started. Re-inspecting state and retrying."
    );
    await callTool("get_accessibility_state", {});
  }

  const beginResult = await callTool("begin_checkout", {});
  const sessionId = beginResult.ok
    ? (beginResult.data as { sessionId?: string }).sessionId ?? "none"
    : "none";

  await callTool("fill_checkout_form", {
    sessionId,
    values: intent.checkoutValues,
  });

  setPhase("awaiting_approval");
  agentSet({ awaiting: "order" });
  const commerce = getCommerceSnapshot();
  const totalCents = commerce.items.reduce(
    (sum, item) => sum + item.priceCents * item.quantity,
    0
  );
  agentPush(
    "agent",
    `Order summary: ${commerce.items
      .map((item) => `${item.quantity}x ${item.name} (${item.size})`)
      .join(", ")} - $${(totalCents / 100).toFixed(2)}. Place order?`
  );
  const orderDecision = await waitForDecision();
  agentSet({ awaiting: null });

  if (orderDecision === "denied") {
    agentPush("agent", "Order cancelled. No purchase was made.");
    setPhase("cancelled");
    agentSet({ running: false });
    return;
  }

  const placeResult = await callTool("place_order", {
    sessionId,
    confirmation: true,
  });

  if (placeResult.ok && (placeResult.data as { success?: boolean }).success) {
    const orderId =
      (placeResult.data as { order?: { id: string } }).order?.id ?? null;
    setPhase("completed");
    agentSet({ lastOrderId: orderId, running: false });
    agentPush("agent", "Task completed successfully.");
  } else {
    setPhase("cancelled");
    agentSet({ running: false });
    agentPush("failure", "Order could not be placed.");
  }
}