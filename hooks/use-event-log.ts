import { useSyncExternalStore } from "react";
import {
  getEventLog,
  subscribeEventLog,
} from "@/lib/observability/event-log";

export function useEventLog() {
  return useSyncExternalStore(subscribeEventLog, getEventLog, getEventLog);
}