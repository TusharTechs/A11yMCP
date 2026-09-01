"use client";

import { useEffect } from "react";
import { useCommerceState } from "@/hooks/use-commerce-state";
import { useRemediationState } from "@/hooks/use-remediation-state";
import {
  registerCommerceA11yTools,
  unregisterCommerceA11yTools,
} from "@/lib/webmcp/tools";
import StorefrontFixture from "./StorefrontFixture";

export default function LiveStorefront() {
  const remediation = useRemediationState();
  const commerce = useCommerceState();

  // Commerce tools exist only while this storefront is on the page.
  useEffect(() => {
    registerCommerceA11yTools();
    return () => unregisterCommerceA11yTools();
  }, []);

  return (
    <StorefrontFixture
      applied={remediation.applied}
      commerce={commerce}
      interactive
      rootId="noma-fixture"
    />
  );
}
