import type { AccessibilityNeed } from "./accessibility";
import type { CheckoutValues } from "./ecommerce";

export type ScenarioId =
  | "keyboard-checkout"
  | "screen-reader-checkout"
  | "low-vision-checkout"
  /** Judge mode only — not listed in the scenario picker. */
  | "judge-run";

export type AgentPhase =
  | "idle"
  | "discovering"
  | "auditing"
  | "negotiating"
  | "awaiting_approval"
  | "remediating"
  | "verifying"
  | "executing_task"
  | "recovery"
  | "completed"
  | "cancelled";

export type StreamKind =
  | "user"
  | "agent"
  | "tool"
  | "result"
  | "failure"
  | "status";

export interface StreamEntry {
  id: string;
  kind: StreamKind;
  text: string;
  tool?: string;
  timestamp: string;
}

export interface ScenarioIntent {
  id: ScenarioId;
  label: string;
  utterance: string;
  needs: AccessibilityNeed[];
  productQuery: string;
  productId: string;
  size: string;
  checkoutValues: CheckoutValues;
}