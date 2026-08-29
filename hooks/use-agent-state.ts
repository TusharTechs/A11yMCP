import { useSyncExternalStore } from "react";
import {
  getAgentSnapshot,
  subscribeAgent,
} from "@/lib/agent/agent-store";

export function useAgentState() {
  return useSyncExternalStore(
    subscribeAgent,
    getAgentSnapshot,
    getAgentSnapshot
  );
}