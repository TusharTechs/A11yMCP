import { useSyncExternalStore } from "react";
import {
  getNegotiationSnapshot,
  subscribeNegotiation,
} from "@/lib/accessibility/negotiation";

export function useNegotiationState() {
  return useSyncExternalStore(
    subscribeNegotiation,
    getNegotiationSnapshot,
    getNegotiationSnapshot
  );
}