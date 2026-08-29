import type { AgentEventInput } from "@/lib/webmcp/tools";

export interface LoggedEvent extends AgentEventInput {
  id: string;
  timestamp: string;
}

let events: LoggedEvent[] = [];
const listeners = new Set<() => void>();
let counter = 0;

export function subscribeEventLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getEventLog(): LoggedEvent[] {
  return events;
}

export function pushEventLog(event: AgentEventInput): void {
  counter += 1;
  events = [
    ...events,
    { ...event, id: `log-${counter}`, timestamp: new Date().toISOString() },
  ].slice(-200);
  listeners.forEach((listener) => listener());
}