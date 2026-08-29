"use client";

import { CATALOG } from "@/lib/ecommerce/catalog";
import type { CommerceSnapshot } from "@/lib/ecommerce/cart";
import type { RemediationCategory } from "@/types/accessibility";
import StorefrontFixture from "./StorefrontFixture";

const ORIGINAL_COMMERCE: CommerceSnapshot = {
  searchQuery: "",
  searchResults: CATALOG,
  selectedProductId: "noma-runner",
  selectedSize: null,
  items: [],
  checkoutSessionId: null,
  checkoutValues: {
    email: "",
    fullName: "",
    address: "",
    city: "",
    postalCode: "",
  },
  checkoutErrors: {},
  checkoutFilled: false,
  order: null,
  taskState: "idle",
  statusMessage: "",
};

const NO_REMEDIATION: Record<RemediationCategory, boolean> = {
  accessible_names: false,
  keyboard_navigation: false,
  form_association: false,
  focus_management: false,
};

/**
 * Frozen, inert preview of the site's original defective state.
 * aria-hidden + inert keep it out of the accessibility tree and tab order.
 */
export default function OriginalStorefront() {
  return (
    <div aria-hidden="true" inert>
      <StorefrontFixture
        applied={NO_REMEDIATION}
        commerce={ORIGINAL_COMMERCE}
        interactive={false}
        rootId="noma-fixture-original"
      />
    </div>
  );
}