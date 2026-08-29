"use client";

import { useEffect, useRef } from "react";
import { useAgentState } from "@/hooks/use-agent-state";
import {
  resolveDecision,
  runGuidedAgent,
} from "@/lib/agent/guided-demo";
import { SCENARIOS } from "@/lib/agent/intent-parser";

export default function AgentPanel() {
  const agent = useAgentState();
  const streamRef = useRef<HTMLOListElement | null>(null);

  useEffect(() => {
    const element = streamRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [agent.stream.length]);

  return (
    <section className="panel" aria-label="Guided agent">
      <h2>Guided agent — WebMCP action stream</h2>

      <div className="chips">
        <span className="chip">phase: {agent.phase}</span>
        {agent.running ? <span className="chip chip-partial">running</span> : null}
        {agent.lastOrderId ? (
          <span className="chip chip-pass">order {agent.lastOrderId}</span>
        ) : null}
      </div>

      <p className="group-label">Scenarios</p>
      <div className="button-row">
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            disabled={agent.running}
            onClick={() => {
              void runGuidedAgent(scenario.id);
            }}
          >
            {scenario.label}
          </button>
        ))}
      </div>
      <p className="muted">
        The guided agent invokes the same registered WebMCP tools a browser
        agent would use. No arbitrary DOM access, no invented capabilities.
      </p>

      {agent.awaiting === "remediation" ? (
        <div className="trust-box" role="alertdialog" aria-label="Approval requested">
          <h3>Approval requested</h3>
          <p>WHAT: apply the accepted accessibility remediations</p>
          <p>WHY: required for the user's negotiated profile</p>
          <p>SCOPE: NOMA fixture session</p>
          <p>RISK: low · REVERSIBLE: yes</p>
          <div className="button-row">
            <button type="button" onClick={() => resolveDecision("approved")}>
              Approve
            </button>
            <button type="button" onClick={() => resolveDecision("denied")}>
              Deny
            </button>
          </div>
        </div>
      ) : null}

      {agent.awaiting === "order" ? (
        <div className="trust-box" role="alertdialog" aria-label="Order confirmation">
          <h3>Order confirmation</h3>
          <p>
            Placing the order is consequential and requires explicit
            confirmation.
          </p>
          <div className="button-row">
            <button type="button" onClick={() => resolveDecision("approved")}>
              Confirm order
            </button>
            <button type="button" onClick={() => resolveDecision("denied")}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <ol className="agent-stream" ref={streamRef} aria-live="polite">
        {agent.stream.map((entry) => (
          <li key={entry.id} className={`stream-${entry.kind}`}>
            <span className="stream-kind">{entry.kind}</span>
            {entry.text}
          </li>
        ))}
      </ol>
    </section>
  );
}