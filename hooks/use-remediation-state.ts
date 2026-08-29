import { useSyncExternalStore } from "react";
import {
  getRemediationSnapshot,
  subscribeRemediation,
} from "@/lib/accessibility/remediation";

export function useRemediationState() {
  return useSyncExternalStore(
    subscribeRemediation,
    getRemediationSnapshot,
    getRemediationSnapshot
  );
}