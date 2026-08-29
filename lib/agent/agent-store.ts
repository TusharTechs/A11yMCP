import type {
  AgentPhase,
  ScenarioId,
  StreamEntry,
  StreamKind,
} from "@/types/agent";

export interface AgentSnapshot {
  phase: AgentPhase;
  running: boolean;
  awaiting: "remediation" | "order" | null;
  scenarioId: ScenarioId | null;
  stream: StreamEntry[];
  lastOrderId: string | null;
}

let snapshot: AgentSnapshot = {
  phase: "idle",
  running: false,
  awaiting: null,
  scenarioId: null,
  stream: [],
  lastOrderId: null,
};

const listeners = new Set<() => void>();
let entryCounter = 0;

export function subscribeAgent(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAgentSnapshot(): AgentSnapshot {
  return snapshot;
}

export function agentSet(partial: Partial<AgentSnapshot>): void {
  snapshot = { ...snapshot, ...partial };
  listeners.forEach((listener) => listener());
}

export function agentPush(
  kind: StreamKind,
  text: string,
  tool?: string
): void {
  entryCounter += 1;
  const entry: StreamEntry = {
    id: `entry-${entryCounter}`,
    kind,
    text,
    tool,
    timestamp: new Date().toISOString(),
  };
  snapshot = {
    ...snapshot,
    stream: [...snapshot.stream, entry].slice(-200),
  };
  listeners.forEach((listener) => listener());
}