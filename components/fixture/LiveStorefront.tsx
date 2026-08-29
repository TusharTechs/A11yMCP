"use client";

import { useCommerceState } from "@/hooks/use-commerce-state";
import { useRemediationState } from "@/hooks/use-remediation-state";
import StorefrontFixture from "./StorefrontFixture";

export default function LiveStorefront() {
  const remediation = useRemediationState();
  const commerce = useCommerceState();

  return (
    <StorefrontFixture
      applied={remediation.applied}
      commerce={commerce}
      interactive
      rootId="noma-fixture"
    />
  );
}