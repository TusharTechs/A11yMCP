import {
  auditAccessibleNames,
  auditFocusVisibility,
  auditFormAssociations,
  auditKeyboardNavigation,
} from "@/lib/accessibility/audits";
import { getCurrentManifest } from "@/lib/accessibility/manifest";
import {
  getNegotiationSnapshot,
  negotiateProfile,
} from "@/lib/accessibility/negotiation";
import {
  applyRemediation,
  getRemediationSnapshot,
  rollbackAll,
  totalViolations,
} from "@/lib/accessibility/remediation";
import { buildAccessibilityTree } from "@/lib/accessibility/tree";
import {
  buildVerification,
  runAllAudits,
} from "@/lib/accessibility/verification";
import {
  addProductToCart,
  beginCheckout,
  fillCheckoutForm,
  getCommerceSnapshot,
  placeOrder,
  searchProducts,
  selectProduct,
  selectSize,
} from "@/lib/ecommerce/cart";
import { findProduct } from "@/lib/ecommerce/catalog";
import type { AccessibilityNeed } from "@/types/accessibility";
import { registerA11yTool } from "./runtime";
import {
  AddToCartInputSchema,
  ApprovalInputSchema,
  EmptyInputSchema,
  FillCheckoutInputSchema,
  NegotiateInputSchema,
  PlaceOrderInputSchema,
  SearchInputSchema,
  addToCartInputJsonSchema,
  approvalInputJsonSchema,
  emptyInputJsonSchema,
  fillCheckoutInputJsonSchema,
  negotiateInputJsonSchema,
  placeOrderInputJsonSchema,
  searchInputJsonSchema,
} from "./schemas";

export type AgentEventType =
  | "TOOL_INVOKED"
  | "AUDIT_COMPLETED"
  | "NEGOTIATION_COMPLETED"
  | "REMEDIATION_APPLIED"
  | "ROLLBACK_APPLIED"
  | "VERIFICATION_COMPLETED"
  | "TASK_COMPLETED";

export interface AgentEventInput {
  type: AgentEventType;
  tool: string;
  message: string;
}

export interface AgentCallbacks {
  logEvent: (event: AgentEventInput) => void;
  getRoot: () => Element | null;
}

type ApprovalInput = { approval: boolean };
type NegotiateInput = { needs: AccessibilityNeed[] };
type SearchInput = { query: string };
type AddToCartInput = { productId: string; variantId: string };
type FillCheckoutInput = {
  sessionId: string;
  values: {
    email: string;
    fullName: string;
    address: string;
    city: string;
    postalCode: string;
  };
};
type PlaceOrderInput = { sessionId: string; confirmation: true };

let callbacks: AgentCallbacks | null = null;
let toolsRegistered = false;

export function setAgentCallbacks(cb: AgentCallbacks): void {
  callbacks = cb;
}

function requireCallbacks(): AgentCallbacks {
  if (!callbacks) {
    throw new Error("A11yMCP callbacks are not initialized.");
  }
  return callbacks;
}

function requireRoot(): Element {
  const root = requireCallbacks().getRoot();
  if (!root) {
    throw new Error("NOMA fixture is not mounted.");
  }
  return root;
}

function logEvent(type: AgentEventType, tool: string, message: string): void {
  requireCallbacks().logEvent({ type, tool, message });
}

export function registerWebMCPToolsOnce(): void {
  if (toolsRegistered) return;
  toolsRegistered = true;

  registerA11yTool({
    name: "get_accessibility_capabilities",
    title: "Get accessibility capabilities",
    description:
      "Returns this site's declared accessibility capabilities (id, status supported|partial, limitations), the needs it cannot currently satisfy (notCurrentlyDeclared), and the commerce task tools. Call FIRST, before auditing, negotiating, or repairing, to learn what the site can adapt. Read-only; no approval required. If a user need appears in notCurrentlyDeclared, do not attempt to remediate it; report it as unsupported.",
    inputSchema: emptyInputJsonSchema,
    annotations: { readOnlyHint: true },
    schema: EmptyInputSchema,
    run: async () => {
      logEvent(
        "TOOL_INVOKED",
        "get_accessibility_capabilities",
        "Capability discovery requested."
      );
      const manifest = getCurrentManifest();
      return {
        protocol: "a11ymcp/0.5",
        site: manifest.site,
        generatedAt: new Date().toISOString(),
        capabilities: manifest.capabilities,
        notCurrentlyDeclared: manifest.notDeclared,
        taskTools: [
          "search_products",
          "add_product_to_cart",
          "begin_checkout",
          "fill_checkout_form",
          "place_order",
        ],
        limitations: [
          "Remediations are site-declared via the manifest; the engine validates and applies them.",
          "Needs without a declared capability are rejected, not faked.",
        ],
      };
    },
  });

  registerA11yTool({
    name: "get_accessibility_state",
    title: "Get accessibility state",
    description:
      "Returns live session state: applied remediations, total violation count, last negotiated profile, and commerce task state (cart items, checkout session, order). Call to re-inspect after any failure, before choosing a next action, or to confirm whether remediation is active. Read-only; no approval required.",
    inputSchema: emptyInputJsonSchema,
    annotations: { readOnlyHint: true },
    schema: EmptyInputSchema,
    run: async () => {
      const root = requireRoot();
      logEvent(
        "TOOL_INVOKED",
        "get_accessibility_state",
        "Accessibility state requested."
      );
      const applied = getRemediationSnapshot().applied;
      const commerce = getCommerceSnapshot();
      return {
        mode: "phase-4",
        generatedAt: new Date().toISOString(),
        applied,
        totalViolations: totalViolations(root),
        rollbackAvailable: Object.values(applied).some(Boolean),
        negotiatedProfile: getNegotiationSnapshot().lastNegotiation,
        commerce: {
          taskState: commerce.taskState,
          cartItems: commerce.items.length,
          checkoutSessionId: commerce.checkoutSessionId,
          orderId: commerce.order?.id ?? null,
        },
      };
    },
  });

  registerA11yTool({
    name: "inspect_accessibility_tree",
    title: "Inspect accessibility tree",
    description:
      "Returns the normalized accessibility tree of the storefront (roles, names, focusability) with current violations attached per node. Call when you need node-level detail rather than audit totals, e.g. to explain a specific barrier to the user. Read-only; no approval required. Use the audit tools for category totals.",
    inputSchema: emptyInputJsonSchema,
    annotations: { readOnlyHint: true },
    schema: EmptyInputSchema,
    run: async () => {
      const root = requireRoot();
      logEvent(
        "TOOL_INVOKED",
        "inspect_accessibility_tree",
        "Accessibility tree inspection requested."
      );
      const violations = runAllAudits(root).flatMap((r) => r.violations);
      return buildAccessibilityTree(root, violations);
    },
  });

  registerA11yTool({
    name: "negotiate_accessibility_profile",
    title: "Negotiate accessibility profile",
        description:
          "Maps the user's accessibility needs against this site's declared capabilities. Returns accepted capabilities (supported, or partial with a stated limitation) and rejected needs with reasons. Call after get_accessibility_capabilities and BEFORE any repair tool. Mutates session state only (stores the profile); does not change the page. No approval required; it only records the negotiated profile. Never call a repair tool for a need this tool rejected.",
    inputSchema: negotiateInputJsonSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    schema: NegotiateInputSchema,
    run: async (input: NegotiateInput) => {
      logEvent(
        "TOOL_INVOKED",
        "negotiate_accessibility_profile",
        `Negotiating for needs: ${input.needs.join(", ")}.`
      );
      const profile = negotiateProfile(input.needs);
      logEvent(
        "NEGOTIATION_COMPLETED",
        "negotiate_accessibility_profile",
        `${profile.accepted.length} accepted, ${profile.rejected.length} rejected.`
      );
      return profile;
    },
  });

  registerA11yTool({
    name: "audit_keyboard_navigation",
    title: "Audit keyboard navigation",
    description:
      "Detects interactive elements that are not keyboard focusable and positive-tabindex ordering issues, each tagged blocking|degrading|informational for the checkout task. Call after discovery and before negotiation to quantify keyboard barriers. Read-only; safe to repeat. pass=true with an empty violations array means this category cannot block the task.",
    inputSchema: emptyInputJsonSchema,
    annotations: { readOnlyHint: true },
    schema: EmptyInputSchema,
    run: async () => {
      const root = requireRoot();
      const result = auditKeyboardNavigation(root);
      logEvent(
        "AUDIT_COMPLETED",
        "audit_keyboard_navigation",
        `${result.violations.length} violation(s) found.`
      );
      return result;
    },
  });

  registerA11yTool({
    name: "audit_accessible_names",
    title: "Audit accessible names",
    description:
      "Detects interactive controls that have no accessible name, tagged by task impact. Call after discovery and before negotiation. Read-only; safe to repeat. Pair with repair_accessible_names only if the site declares that capability.",
    inputSchema: emptyInputJsonSchema,
    annotations: { readOnlyHint: true },
    schema: EmptyInputSchema,
    run: async () => {
      const root = requireRoot();
      const result = auditAccessibleNames(root);
      logEvent(
        "AUDIT_COMPLETED",
        "audit_accessible_names",
        `${result.violations.length} violation(s) found.`
      );
      return result;
    },
  });

  registerA11yTool({
    name: "audit_form_associations",
    title: "Audit form associations",
    description:
      "Detects form fields missing labels, placeholder-only labels, and error messages not associated with their field, tagged by task impact. Call before negotiation when the task involves forms. Read-only; safe to repeat.",
    inputSchema: emptyInputJsonSchema,
    annotations: { readOnlyHint: true },
    schema: EmptyInputSchema,
    run: async () => {
      const root = requireRoot();
      const result = auditFormAssociations(root);
      logEvent(
        "AUDIT_COMPLETED",
        "audit_form_associations",
        `${result.violations.length} violation(s) found.`
      );
      return result;
    },
  });

  registerA11yTool({
    name: "audit_focus_visibility",
    title: "Audit focus visibility",
    description:
      "Probes each focusable control and detects missing visible focus indicators, tagged blocking for keyboard tasks. Supports AbortSignal cancellation. Call before negotiation for keyboard users. Read-only; safe to repeat.",
    inputSchema: emptyInputJsonSchema,
    annotations: { readOnlyHint: true },
    schema: EmptyInputSchema,
    run: async (_input: unknown, context?: { signal?: AbortSignal }) => {
      const root = requireRoot();
      const result = auditFocusVisibility(root, context?.signal);
      logEvent(
        "AUDIT_COMPLETED",
        "audit_focus_visibility",
        `${result.violations.length} violation(s) found.`
      );
      return result;
    },
  });

  registerA11yTool({
    name: "repair_accessible_names",
    title: "Repair accessible names",
    description:
      "Applies the site-declared, reversible accessible-name remediation. Requires input.approval=true (explicit user consent); the schema rejects missing or false approval. Precondition: the site must declare the accessible_names capability (check get_accessibility_capabilities). Mutates the live page; reversible via rollback_all_remediations. Verify afterwards with verify_accessibility_profile.",
    inputSchema: approvalInputJsonSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    schema: ApprovalInputSchema,
    run: async () => {
      const root = requireRoot();
      logEvent(
        "TOOL_INVOKED",
        "repair_accessible_names",
        "Requested accessible name remediation."
      );
      const result = await applyRemediation("accessible_names", root);
      logEvent(
        "REMEDIATION_APPLIED",
        "repair_accessible_names",
        `Violations ${result.beforeViolations} -> ${result.afterViolations}.`
      );
      return result;
    },
  });

  registerA11yTool({
    name: "repair_keyboard_navigation",
    title: "Repair keyboard navigation",
    description:
      "Applies the site-declared, reversible keyboard remediation for the size selector (focusability plus Enter/Space/arrow handlers). Requires input.approval=true. Precondition: the site must declare keyboard_navigation. Mutates the live page; reversible via rollback_all_remediations. Verify afterwards with verify_accessibility_profile.",
    inputSchema: approvalInputJsonSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    schema: ApprovalInputSchema,
    run: async () => {
      const root = requireRoot();
      logEvent(
        "TOOL_INVOKED",
        "repair_keyboard_navigation",
        "Requested keyboard navigation remediation."
      );
      const result = await applyRemediation("keyboard_navigation", root);
      logEvent(
        "REMEDIATION_APPLIED",
        "repair_keyboard_navigation",
        `Violations ${result.beforeViolations} -> ${result.afterViolations}.`
      );
      return result;
    },
  });

  registerA11yTool({
    name: "repair_form_associations",
    title: "Repair form associations",
    description:
      "Applies the site-declared, reversible label and error-association remediation for checkout fields. Requires input.approval=true. Precondition: the site must declare form_association and the checkout form may need to be mounted; if a related call fails with 'not mounted', call begin_checkout first where applicable. Mutates the live page; reversible via rollback_all_remediations.",
    inputSchema: approvalInputJsonSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    schema: ApprovalInputSchema,
    run: async () => {
      const root = requireRoot();
      logEvent(
        "TOOL_INVOKED",
        "repair_form_associations",
        "Requested form association remediation."
      );
      const result = await applyRemediation("form_association", root);
      logEvent(
        "REMEDIATION_APPLIED",
        "repair_form_associations",
        `Violations ${result.beforeViolations} -> ${result.afterViolations}.`
      );
      return result;
    },
  });

  registerA11yTool({
    name: "repair_focus_management",
    title: "Repair focus management",
    description:
      "Applies the site-declared, reversible visible-focus remediation. Requires input.approval=true. Precondition: the site must declare focus_management. Mutates the live page; reversible via rollback_all_remediations. Verify afterwards with verify_accessibility_profile.",
    inputSchema: approvalInputJsonSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    schema: ApprovalInputSchema,
    run: async () => {
      const root = requireRoot();
      logEvent(
        "TOOL_INVOKED",
        "repair_focus_management",
        "Requested focus management remediation."
      );
      const result = await applyRemediation("focus_management", root);
      logEvent(
        "REMEDIATION_APPLIED",
        "repair_focus_management",
        `Violations ${result.beforeViolations} -> ${result.afterViolations}.`
      );
      return result;
    },
  });

  registerA11yTool({
    name: "repair_reduced_motion",
    title: "Repair reduced motion",
        description:
          "Applies the site-declared, reversible motion reduction. Precondition: the site must declare the reduced_motion capability; call after negotiate_accessibility_profile accepts it. Requires input.approval=true. On sites that do not declare it, returns success:false with an evidence chain explaining the refusal. Mutates the live page; reversible via rollback_all_remediations.",
    inputSchema: approvalInputJsonSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    schema: ApprovalInputSchema,
    run: async () => {
      const root = requireRoot();
      logEvent(
        "TOOL_INVOKED",
        "repair_reduced_motion",
        "Requested motion reduction."
      );
      const result = await applyRemediation("reduced_motion", root);
      logEvent(
        "REMEDIATION_APPLIED",
        "repair_reduced_motion",
        `Violations ${result.beforeViolations} -> ${result.afterViolations}.`
      );
      return result;
    },
  });

  registerA11yTool({
    name: "verify_accessibility_profile",
    title: "Verify accessibility profile",
    description:
      "Re-runs all task-critical audits and returns PASS|BLOCKED plus per-check results. Call after every remediation batch and before proceeding to commerce; also call it to confirm a rollback restored the original state. Read-only; no approval required. If a check fails, call the matching audit tool for violation details.",
    inputSchema: emptyInputJsonSchema,
    annotations: { readOnlyHint: true },
    schema: EmptyInputSchema,
    run: async () => {
      const root = requireRoot();
      logEvent(
        "TOOL_INVOKED",
        "verify_accessibility_profile",
        "Verification requested."
      );
      const result = buildVerification(root);
      logEvent(
        "VERIFICATION_COMPLETED",
        "verify_accessibility_profile",
        result.summary === "pass"
          ? "Verification passed."
          : "Verification failed."
      );
      return result;
    },
  });

  registerA11yTool({
    name: "rollback_all_remediations",
    title: "Rollback all remediations",
    description:
      "Reverts every applied remediation and restores the original experience. Call when the user withdraws consent or to reset between scenarios. Idempotent and safe when nothing is applied. No approval required (it removes changes, never adds them).",
    inputSchema: emptyInputJsonSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    schema: EmptyInputSchema,
    run: async () => {
      const root = requireRoot();
      logEvent(
        "TOOL_INVOKED",
        "rollback_all_remediations",
        "Requested rollback of all remediations."
      );
      const result = await rollbackAll(root);
      logEvent(
        "ROLLBACK_APPLIED",
        "rollback_all_remediations",
        `Rolled back: ${result.rolledBack.join(", ") || "none"}.`
      );
      return result;
    },
  });

  registerA11yTool({
    name: "search_products",
    title: "Search products",
    description:
      "Searches the deterministic NOMA catalog and updates the visible results. Call at the start of a purchase task; the returned product ids and sizes are the valid inputs for add_product_to_cart. Mutates UI state only; no approval required.",
    inputSchema: searchInputJsonSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    schema: SearchInputSchema,
    run: async (input: SearchInput) => {
      logEvent("TOOL_INVOKED", "search_products", `Query: "${input.query}".`);
      const results = searchProducts(input.query);
      return {
        success: true,
        count: results.length,
        products: results.map((product) => ({
          id: product.id,
          name: product.name,
          priceCents: product.priceCents,
          sizes: product.sizes,
        })),
      };
    },
  });

  registerA11yTool({
    name: "add_product_to_cart",
    title: "Add product to cart",
    description:
      "Selects a product and size, then adds it to the cart. Preconditions: productId from search_products and variantId within that product's sizes. Returns success:false with a message (and nextAction search_products) for unknown ids instead of throwing. Reversible until checkout; no approval required.",
    inputSchema: addToCartInputJsonSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    schema: AddToCartInputSchema,
    run: async (input: AddToCartInput) => {
      logEvent(
        "TOOL_INVOKED",
        "add_product_to_cart",
        `Product ${input.productId}, size ${input.variantId}.`
      );
      const product = findProduct(input.productId);
      if (!product) {
        return {
          success: false,
          message: `Unknown product: ${input.productId}`,
          nextAction: "search_products",
        };
      }
      if (!product.sizes.includes(input.variantId)) {
        return {
          success: false,
          message: `Unknown size: ${input.variantId}`,
          nextAction: "search_products",
        };
      }
      selectProduct(input.productId);
      selectSize(input.variantId);
      const result = addProductToCart();
      return {
        ...result,
        cartItems: getCommerceSnapshot().items.length,
      };
    },
  });

  registerA11yTool({
    name: "begin_checkout",
    title: "Begin checkout",
    description:
      "Creates a checkout session for a non-empty cart and returns the sessionId required by fill_checkout_form and place_order. Precondition: at least one cart item; on an empty cart it fails with nextAction add_product_to_cart. Call before filling the form. No approval required.",
    inputSchema: emptyInputJsonSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    schema: EmptyInputSchema,
    run: async () => {
      logEvent("TOOL_INVOKED", "begin_checkout", "Checkout requested.");
      return beginCheckout();
    },
  });

  registerA11yTool({
    name: "fill_checkout_form",
    title: "Fill checkout form",
    description:
      "Fills and validates the active checkout form. Precondition: an active sessionId from begin_checkout; without one it fails with nextAction begin_checkout. On validation failure returns success:false with per-field errors; correct the values and retry. Mutates form state only; no approval required.",
    inputSchema: fillCheckoutInputJsonSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    schema: FillCheckoutInputSchema,
    run: async (input: FillCheckoutInput) => {
      logEvent(
        "TOOL_INVOKED",
        "fill_checkout_form",
        `Session ${input.sessionId}.`
      );
      return fillCheckoutForm(input.sessionId, input.values);
    },
  });

  registerA11yTool({
    name: "place_order",
    title: "Place order",
        description:
          "Consequential action: places the order. Precondition: a filled checkout session; call only after the user explicitly confirms. Requires input.confirmation to be the literal true (explicit human confirmation); the schema rejects confirmation:false. Returns the order id on success. A second call for the same session fails with 'Order already placed'.",
    inputSchema: placeOrderInputJsonSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    schema: PlaceOrderInputSchema,
    run: async (input: PlaceOrderInput) => {
      logEvent("TOOL_INVOKED", "place_order", `Session ${input.sessionId}.`);
      const result = placeOrder(input.sessionId);
      if (result.success && result.order) {
        logEvent(
          "TASK_COMPLETED",
          "place_order",
          `Order ${result.order.id} placed. Task completed successfully.`
        );
      }
      return result;
    },
  });
}