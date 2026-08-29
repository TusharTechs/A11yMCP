import type {
  AcceptedCapability,
  AccessibilityNeed,
  NegotiatedProfile,
  RejectedNeed,
} from "@/types/accessibility";
import { SITE_MANIFEST } from "./manifest";
import { NEED_TO_CAPABILITY } from "./profiles";

interface NegotiationSnapshot {
  lastNegotiation: NegotiatedProfile | null;
}

let snapshot: NegotiationSnapshot = { lastNegotiation: null };
const listeners = new Set<() => void>();
let negotiationCounter = 0;

export function subscribeNegotiation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getNegotiationSnapshot(): NegotiationSnapshot {
  return snapshot;
}

export function negotiateProfile(
  needs: AccessibilityNeed[]
): NegotiatedProfile {
  const accepted: AcceptedCapability[] = [];
  const rejected: RejectedNeed[] = [];

  for (const need of needs) {
    const capabilityId = NEED_TO_CAPABILITY[need];
    const capability = capabilityId
      ? SITE_MANIFEST.capabilities.find((c) => c.id === capabilityId)
      : undefined;

    if (!capabilityId || !capability) {
      rejected.push({
        need,
        reason:
          "This site does not declare that capability in its A11yMCP manifest.",
      });
      continue;
    }

    accepted.push({
      need,
      capability: capability.id,
      status: capability.status,
      limitation: capability.limitation,
      remediationTool: capability.repairTool,
    });
  }

  negotiationCounter += 1;

  const profile: NegotiatedProfile = {
    id: `neg-${negotiationCounter}`,
    requestedNeeds: needs,
    accepted,
    rejected,
    generatedAt: new Date().toISOString(),
  };

  snapshot = { lastNegotiation: profile };
  listeners.forEach((listener) => listener());

  return profile;
}