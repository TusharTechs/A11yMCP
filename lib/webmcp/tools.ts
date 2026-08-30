import {
  auditAccessibleNames,
  auditFocusVisibility,
  auditFormAssociations,
  auditKeyboardNavigation,
} from "@/lib/accessibility/audits";
import { SITE_MANIFEST } from "@/lib/accessibility/manifest";
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
      "Returns the accessibility capabilities declared by this site's A11yMCP manifest, including support status, known unsupported needs, and commerce task tools.",
    inputSchema: emptyInputJsonSchema,
    annotations: { readOnlyHint: true },
    schema: EmptyInputSchema,
    run: async () => {
      logEvent(
        "TOOL_INVOKED",
        "get_accessibility_capabilities",
        "Capability discovery requested."
      );
      return {
        protocol: "a11ymcp/0.4",
        site: SITE_MANIFEST.site,
        generatedAt: new Date().toISOString(),
        capabilities: SITE_MANIFEST.capabilities,
        notCurrentlyDeclared: ["high_contrast", "reduced_motion", "large_targets"],
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
      "Returns applied remediations, violation count, last negotiated profile, and commerce task state.",
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
      "Returns a normalized accessibility tree for the fixture with current violations attached.",
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
      "Matches the user's accessibility needs against the site's declared capabilities. Returns accepted, partial, and rejected capabilities with reasons.",
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
      "Detects interactive elements that are not keyboard focusable and positive tabindex issues.",
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
    description: "Detects interactive controls that have no accessible name.",
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
      "Detects form fields missing labels, placeholder-only labels, and unassociated error messages.",
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
      "Probes each focusable control and detects missing visible focus indicators.",
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
      "Applies the site-declared accessible name remediation (reversible). Requires user approval.",
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
      "Applies the site-declared keyboard remediation for the size selector (reversible). Requires user approval.",
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
      "Applies the site-declared label and error association remediation (reversible). Requires user approval.",
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
      "Applies the site-declared visible focus remediation (reversible). Requires user approval.",
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
    name: "verify_accessibility_profile",
    title: "Verify accessibility profile",
    description:
      "Runs all audits and reports whether the task-critical accessibility state passes.",
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
      "Reverts every applied remediation and returns the fixture to its original state.",
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

  /* Phase 4 — commerce task tools */

  registerA11yTool({
    name: "search_products",
    title: "Search products",
    description:
      "Searches the deterministic NOMA catalog and updates the visible product results.",
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
      "Selects a product and size, then adds it to the cart. Reversible until checkout.",
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
        return { success: false, message: `Unknown product: ${input.productId}` };
      }
      if (!product.sizes.includes(input.variantId)) {
        return { success: false, message: `Unknown size: ${input.variantId}` };
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
      "Starts a checkout session for the current cart. Required before filling the checkout form.",
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
      "Fills and validates the checkout form for an active checkout session. Returns per-field errors when validation fails.",
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
      "Places the order for a filled checkout session. Consequential: requires confirmation to be true.",
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